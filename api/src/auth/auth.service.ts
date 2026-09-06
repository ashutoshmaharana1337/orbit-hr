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

    return this.issueToken({ sub: user.id, tenantId: tenant.id, email: user.email, role: user.role });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    return this.issueToken({ sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role });
  }

  async me(payload: JwtPayload) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
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

  private issueToken(payload: JwtPayload) {
    return { accessToken: this.jwt.sign(payload) };
  }
}
