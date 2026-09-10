import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
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
 * 3. On success, extracts entity ID from response
 * 4. Logs the write operation to AuditLog
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
      tap((response) => {
        this.logAudit(
          tenantId,
          userId,
          userRole,
          auditOptions,
          method,
          response,
        ).catch((error) => {
          this.logger.error(`Failed to log audit: ${error.message}`, error);
        });
      }),
      catchError((error) => {
        // Log failed mutations too (but with error indicator)
        this.logAudit(
          tenantId,
          userId,
          userRole,
          auditOptions,
          method,
          null,
          error,
        ).catch((logError) => {
          this.logger.error(`Failed to log audit error: ${logError.message}`, logError);
        });
        throw error;
      }),
    );
  }

  private async logAudit(
    tenantId: string,
    userId: string | null,
    userRole: string | null,
    options: AuditableOptions,
    method: string,
    response: unknown,
    error?: Error,
  ) {
    // Extract entity ID from response or custom extractor
    let entityId: string | null = null;

    if (response && typeof response === 'object' && 'id' in response) {
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

    try {
      await this.audit.logWrite({
        tenantId,
        entityType: options.entityType,
        entityId,
        action: action as any, // Type assertion needed for RESTORE custom action
        userId: userId || undefined,
        userRole: userRole || undefined,
        afterValues:
          action !== 'DELETE' && action !== 'RESTORE' && response && typeof response === 'object'
            ? AuditService.serializeValues(response)
            : undefined,
        changeDescription: AuditService.generateChangeDescription(options.entityType, action as any),
      });
    } catch (err) {
      this.logger.error(`Failed to audit log ${options.entityType}:${action}:${entityId}`, err);
    }
  }
}
