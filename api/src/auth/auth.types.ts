import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export type JwtPayload = {
  sub: string; // user id
  tenantId: string;
  email: string;
  role: UserRole;
};

export type AuthenticatedRequest = Request & { user: JwtPayload };
