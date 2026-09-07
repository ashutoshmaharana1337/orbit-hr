import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
}
