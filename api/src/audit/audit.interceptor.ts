import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AuditService } from './audit.service.js';
import { AUDITABLE_KEY, type AuditableOptions } from './auditable.decorator.js';

/**
 * Interceptor that automatically logs write operations to the audit log.
 * Only logs requests marked with @Auditable() decorator.
 *
 * The interceptor:
 * 1. Captures request metadata (user, tenant, role)
 * 2. Executes the handler
 * 3. On success, extracts entity ID from response (or the decorator's extractor)
 * 4. Writes the AuditLog row and only then lets the response through
 *
 * It is registered after TenantTransactionInterceptor, so the write happens
 * inside the request's tenant transaction (same connection, RLS session
 * variables already set). The write is awaited via `mergeMap` — a fire-and-
 * forget `tap` would let the transaction commit before the INSERT ran, and
 * the row was silently lost. A failed audit write fails (and rolls back) the
 * mutation: no audit row, no change.
 *
 * Failed mutations are not logged: the enclosing transaction rolls back, so
 * any row written here would vanish with it.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Check if this endpoint is marked as auditable
    const auditOptions = this.reflector.getAllAndOverride<AuditableOptions | undefined>(AUDITABLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!auditOptions) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request & Partial<AuthenticatedRequest>>();
    const method = req.method.toUpperCase();

    // Only audit mutations (POST, PATCH, PUT, DELETE)
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const tenantId = req.user?.tenantId ?? null;
    const userId = req.user?.sub ?? null;
    const userRole = req.user?.role ?? null;

    if (!tenantId) {
      this.logger.warn('Cannot audit request without tenantId');
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap(async (response) => {
        await this.logAudit(tenantId, userId, userRole, auditOptions, method, req, response);
        return response;
      }),
    );
  }

  private async logAudit(
    tenantId: string,
    userId: string | null,
    userRole: string | null,
    options: AuditableOptions,
    method: string,
    req: Request,
    response: unknown,
  ) {
    // Extract entity ID from custom extractor or response
    let entityId: string | null = options.extractEntityId?.(req, response) ?? null;

    if (!entityId && response && typeof response === 'object' && 'id' in response) {
      entityId = String(response.id);
    }

    if (!entityId) {
      this.logger.debug(`Could not extract entityId for ${options.entityType}:${method}`);
      return;
    }

    // Determine action: use explicit action from decorator if provided, otherwise infer from HTTP method
    let action: string;
    if (options.action) {
      action = options.action;
    } else {
      action = method === 'DELETE' ? 'DELETE' : method === 'POST' ? 'CREATE' : 'UPDATE';
    }

    await this.audit.logWrite({
      tenantId,
      entityType: options.entityType,
      entityId,
      action: action as any, // Type assertion needed for RESTORE custom action
      userId: userId || undefined,
      userRole: userRole || undefined,
      afterValues:
        action !== 'DELETE' && action !== 'RESTORE' && response && typeof response === 'object'
          ? (AuditService.serializeValues(response) ?? undefined)
          : undefined,
      changeDescription: AuditService.generateChangeDescription(options.entityType, action as any) ?? undefined,
    });
  }
}
