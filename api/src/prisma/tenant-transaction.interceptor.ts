import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, from, Observable } from 'rxjs';
import type { Request } from 'express';
import { PrismaService } from './prisma.service.js';
import { BYPASS_TENANT_RLS_KEY } from './bypass-tenant-rls.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

/**
 * Wraps every HTTP request in one Prisma transaction, sets the Postgres
 * session variables the RLS policies check (`app.current_tenant_id` from
 * the JWT, `app.bypass_rls` only where `@BypassTenantRls()` says so), and
 * makes that transaction the active connection for the request's duration
 * via PrismaService — see prisma.service.ts and tenant-context.ts for how
 * existing service code picks this up with no call-site changes.
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request & Partial<AuthenticatedRequest>>();
    const tenantId = req.user?.tenantId ?? null;
    const bypassRls =
      this.reflector.getAllAndOverride<boolean>(BYPASS_TENANT_RLS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    return from(this.prisma.runInTenantContext({ tenantId, bypassRls }, () => firstValueFrom(next.handle())));
  }
}
