import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { SentryService } from './sentry.service.js';
import * as Sentry from '@sentry/nestjs';

/**
 * Interceptor that enriches all errors with tenant and role context.
 *
 * This interceptor:
 * 1. Generates/extracts request ID for correlation
 * 2. Sets user context (userId, email)
 * 3. Sets tenant context (for multi-tenant debugging)
 * 4. Sets role context (for RBAC debugging)
 * 5. Captures any errors that occur with full context
 *
 * All errors reported to Sentry will include:
 * - tenantId (as tag and context)
 * - userId (as user context)
 * - userRole (as tag)
 * - requestId (for log correlation)
 * - endpoint, method, statusCode
 */
@Injectable()
export class SentryContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SentryContextInterceptor.name);

  constructor(private readonly sentry: SentryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & Partial<AuthenticatedRequest>>();
    const res = context.switchToHttp().getResponse();

    // Generate or extract request ID
    const requestId = this.getOrCreateRequestId(req);

    // Set request ID for correlation
    this.sentry.setRequestId(requestId);

    // Attach request ID to response headers for client-side correlation
    res.setHeader('X-Request-ID', requestId);

    // Extract user context from JWT payload
    if (req.user) {
      const { sub: userId, email, tenantId, role } = req.user;

      // Set user context for Sentry
      this.sentry.setUserContext(userId, email);

      // Set tenant context (critical for multi-tenant debugging)
      if (tenantId) {
        this.sentry.setTenantContext(tenantId);
      }

      // Set role context for RBAC debugging
      if (role) {
        this.sentry.setRoleContext(role);
      }

      // Add custom context with all user-related info
      this.sentry.setCustomContext('user', {
        id: userId,
        email,
        role,
        tenantId,
      });
    }

    // Add request context
    this.sentry.setCustomContext('request', {
      method: req.method,
      path: req.path,
      url: req.originalUrl,
      ip: req.ip,
      requestId,
    });

    return next.handle().pipe(
      tap((response) => {
        // Record successful response
        res.on('finish', () => {
          const statusCode = res.statusCode;

          // Log successful request
          this.logger.debug(
            `Request completed: ${req.method} ${req.path} ${statusCode}`,
          );
        });

        return response;
      }),
      catchError((error: Error) => {
        // Extract status code from response or error
        const statusCode = res.statusCode || 500;

        // Add error context
        this.sentry.setCustomContext('error', {
          statusCode,
          message: error.message,
          name: error.name,
          stack: error.stack,
        });

        // Capture exception in Sentry with all context
        Sentry.captureException(error, {
          level: statusCode >= 500 ? 'error' : 'warning',
          tags: {
            statusCode: String(statusCode),
            endpoint: `${req.method} ${req.path}`,
          },
        });

        // Log error
        this.logger.error(
          `Request failed: ${req.method} ${req.path} ${statusCode}`,
          error,
        );

        // Re-throw the error to let exception handling middleware handle it
        throw error;
      }),
    );
  }

  /**
   * Get existing request ID from header or generate a new one.
   * Request ID is used to correlate logs and errors.
   */
  private getOrCreateRequestId(req: Request): string {
    const existingId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['request-id'] as string);

    if (existingId) {
      return existingId;
    }

    // Generate a new request ID
    // Format: [timestamp]-[uuid]
    const timestamp = Date.now().toString(36);
    const uuid = randomUUID().replace(/-/g, '').substring(0, 8);
    return `${timestamp}-${uuid}`;
  }
}
