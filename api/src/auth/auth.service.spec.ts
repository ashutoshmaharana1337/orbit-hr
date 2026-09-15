import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AuthService - Core Logic', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let mailService: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: vi.fn(),
              findUniqueOrThrow: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              updateMany: vi.fn(),
            },
            tenant: {
              findUnique: vi.fn(),
              create: vi.fn(),
            },
            employee: {
              create: vi.fn(),
            },
            refreshToken: {
              findUnique: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              updateMany: vi.fn(),
            },
            passwordSetToken: {
              findUnique: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
            },
            $executeRaw: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: vi.fn().mockReturnValue('mock-jwt-token'),
            verify: vi.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            send: vi.fn().mockResolvedValue({ success: true }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    mailService = module.get<MailService>(MailService);
  });

  describe('Duplicate Email Prevention', () => {
    it('should throw ConflictException if email already exists during registration', async () => {
      const existingUser = { id: 'user-1', email: 'test@company.com' };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(existingUser);

      const registerDto = {
        email: 'test@company.com',
        password: 'Password123!',
        fullName: 'John Doe',
        companyName: 'Test Corp',
      };

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@company.com' },
      });
    });
  });

  describe('Login Validation', () => {
    it('should throw UnauthorizedException for non-existent email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const loginDto = {
        email: 'nonexistent@company.com',
        password: 'Password123!',
      };

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should call findUnique with email during login', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      try {
        await service.login({
          email: 'test@company.com',
          password: 'Password123!',
        });
      } catch {
        // Expected to fail
      }

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@company.com' },
      });
    });
  });

  describe('Token Refresh', () => {
    it('should throw UnauthorizedException when refresh token is missing', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(UnauthorizedException);
    });

    it('should check refresh token in database', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(null);

      try {
        await service.refresh('some-token');
      } catch {
        // Expected to fail
      }

      expect(prisma.refreshToken.findUnique).toHaveBeenCalled();
    });

    it('should reject expired refresh tokens', async () => {
      const expiredToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed',
        expiresAt: new Date(Date.now() - 1000), // Expired
        revokedAt: null,
      };

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(expiredToken);

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should detect and reject replayed refresh tokens', async () => {
      const revokedToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(), // Already revoked
      };

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(revokedToken);
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValueOnce({ count: 3 });

      await expect(service.refresh('replayed-token')).rejects.toThrow('Refresh token has already been used');

      // Should revoke all other sessions for this user
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('Logout', () => {
    it('should handle logout without token gracefully', async () => {
      await expect(service.logout(undefined)).resolves.not.toThrow();
    });

    it('should revoke refresh token on logout', async () => {
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValueOnce({ count: 1 });

      await service.logout('valid-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('Email Validation', () => {
    it('should prevent duplicate employee email during employee creation in registration', async () => {
      const existingEmployee = { id: 'emp-1', email: 'admin@company.com' };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(existingEmployee);

      const registerDto = {
        email: 'admin@company.com',
        password: 'Password123!',
        fullName: 'Admin',
        companyName: 'Company',
      };

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('Tenant Creation', () => {
    it('should auto-increment slug if tenant name conflict exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      // First slug attempt exists, second one doesn't
      vi.mocked(prisma.tenant.findUnique)
        .mockResolvedValueOnce({ id: 'tenant-1', slug: 'test-company' }) // First exists
        .mockResolvedValueOnce(null); // Second doesn't exist

      vi.mocked(prisma.tenant.create).mockResolvedValueOnce({
        id: 'tenant-2',
        name: 'Test Company',
        slug: 'test-company-2',
      });

      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'user-1',
        email: 'admin@company.com',
        passwordHash: 'hashed',
        role: 'ADMIN',
        tenantId: 'tenant-2',
      });

      vi.mocked(prisma.employee.create).mockResolvedValueOnce({
        id: 'emp-1',
        tenantId: 'tenant-2',
        userId: 'user-1',
        name: 'Admin',
        email: 'admin@company.com',
        title: 'Administrator',
        status: 'ACTIVE',
        joinDate: new Date(),
        phone: '',
        departmentId: null,
        location: 'Unspecified',
        managerId: null,
        deletedAt: null,
      });

      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      });

      vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValueOnce({
        id: 'user-1',
        email: 'admin@company.com',
        passwordHash: 'hashed',
        role: 'ADMIN',
        tenantId: 'tenant-2',
        tenant: {
          id: 'tenant-2',
          name: 'Test Company',
          slug: 'test-company-2',
        },
        employee: {
          id: 'emp-1',
          name: 'Admin',
        },
      });

      const registerDto = {
        email: 'admin@company.com',
        password: 'Password123!',
        fullName: 'Admin',
        companyName: 'Test Company',
      };

      const result = await service.register(registerDto);

      expect(result.profile.tenant.slug).toBe('test-company-2');
      expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should use base slug if no conflicts exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null); // No conflict

      vi.mocked(prisma.tenant.create).mockResolvedValueOnce({
        id: 'tenant-1',
        name: 'My Company',
        slug: 'my-company',
      });

      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'user-1',
        email: 'admin@company.com',
        passwordHash: 'hashed',
        role: 'ADMIN',
        tenantId: 'tenant-1',
      });

      vi.mocked(prisma.employee.create).mockResolvedValueOnce({
        id: 'emp-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        name: 'Admin',
        email: 'admin@company.com',
        title: 'Administrator',
        status: 'ACTIVE',
        joinDate: new Date(),
        phone: '',
        departmentId: null,
        location: 'Unspecified',
        managerId: null,
        deletedAt: null,
      });

      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      });

      vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValueOnce({
        id: 'user-1',
        email: 'admin@company.com',
        passwordHash: 'hashed',
        role: 'ADMIN',
        tenantId: 'tenant-1',
        tenant: {
          id: 'tenant-1',
          name: 'My Company',
          slug: 'my-company',
        },
        employee: {
          id: 'emp-1',
          name: 'Admin',
        },
      });

      const registerDto = {
        email: 'admin@company.com',
        password: 'Password123!',
        fullName: 'Admin',
        companyName: 'My Company',
      };

      const result = await service.register(registerDto);

      expect(result.profile.tenant.slug).toBe('my-company');
    });
  });
});
