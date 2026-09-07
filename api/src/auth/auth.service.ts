import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './auth.types.js';

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'workspace'
  );
}

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const baseSlug = slugify(dto.companyName);
    let slug = baseSlug;
    let suffix = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++suffix}`;
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.companyName, slug },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          role: 'ADMIN',
        },
      });

      await tx.employee.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          name: dto.fullName,
          email: dto.email,
          title: 'Administrator',
          department: 'People',
          location: 'Unspecified',
          status: 'ACTIVE',
          joinDate: new Date(),
          phone: '',
          leaveBalance: { create: {} },
        },
      });

      return { tenant, user };
    });

    return this.issueSession({ sub: user.id, tenantId: tenant.id, email: user.email, role: user.role });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    return this.issueSession({ sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role });
  }

  async refresh(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) throw new UnauthorizedException('Missing refresh token');

    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (existing.revokedAt) {
      // This token was already rotated out. Someone is replaying an old
      // refresh token — treat it as theft and kill every active session
      // for this user rather than trusting the presenter.
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token has already been used');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: existing.userId } });
    return this.issueSession({ sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role });
  }

  async logout(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async invite(tenantId: string, employeeId: string, role: UserRole) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.userId) throw new ConflictException('This employee already has a login');

    const existingUser = await this.prisma.user.findUnique({ where: { email: employee.email } });
    if (existingUser) throw new ConflictException('An account with this email already exists');

    // No password is set yet — a random, never-communicated hash keeps
    // this account permanently unable to log in until the invite link
    // (below) is used to set a real one. No special-cased "unactivated"
    // state needed anywhere else.
    const unusablePasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { tenantId, email: employee.email, passwordHash: unusablePasswordHash, role },
      });
      await tx.employee.update({ where: { id: employee.id }, data: { userId: user.id } });
      return user;
    });

    const rawToken = await this.createPasswordSetToken(user.id, 'INVITE', INVITE_TOKEN_TTL_MS);
    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    await this.mail.send({
      to: user.email,
      subject: `You've been invited to Orbit HR`,
      text: `Set your password to activate your account:\n${webOrigin}/set-password?token=${rawToken}\n\nThis link expires in 7 days.`,
    });

    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const rawToken = await this.createPasswordSetToken(user.id, 'RESET', RESET_TOKEN_TTL_MS);
      const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
      await this.mail.send({
        to: user.email,
        subject: 'Reset your Orbit HR password',
        text: `Reset your password:\n${webOrigin}/reset-password?token=${rawToken}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
      });
    }
    // Same response whether or not the email exists — don't let this
    // endpoint be used to enumerate registered accounts.
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.passwordSetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.passwordSetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      const user = await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      // A password set via invite or reset should invalidate any session
      // that predates it.
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return user;
    });

    return this.issueSession({ sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role });
  }

  async me(payload: JwtPayload) {
    return this.buildProfile(payload.sub);
  }

  private async buildProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { employee: true, tenant: true },
    });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
      employee: user.employee,
    };
  }

  private async issueSession(payload: JwtPayload) {
    const accessToken = this.jwt.sign(payload);

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.refreshToken.create({
      data: { userId: payload.sub, tokenHash: hashToken(refreshToken), expiresAt: refreshTokenExpiresAt },
    });

    const profile = await this.buildProfile(payload.sub);
    return { profile, accessToken, refreshToken, refreshTokenExpiresAt };
  }

  private async createPasswordSetToken(userId: string, purpose: 'INVITE' | 'RESET', ttlMs: number) {
    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.passwordSetToken.create({
      data: { userId, tokenHash: hashToken(rawToken), purpose, expiresAt: new Date(Date.now() + ttlMs) },
    });
    return rawToken;
  }
}
