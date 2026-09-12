/**
 * Request context middleware for distributed tracing and log correlation
 *
 * Responsibilities:
 * - Generate unique request ID for each request
 * - Extract tenant ID, user ID, and user role from JWT
 * - Store context in AsyncLocalStorage for access throughout request lifecycle
 * - Set up logger context for the duration of the request
 * - Pass context through to all logs within the request
 * - Add X-Request-ID to response headers
 *
 * All logs generated within this request will include:
 * - requestId: unique identifier for this request
 * - tenantId: tenant the request is for (if authenticated)
 * - userId: user making the request (if authenticated)
 * - userRole: role of the user (if authenticated)
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { LoggerService } from './logger.service.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { runWithRequestContext } from './request-context.js';

export interface RequestWithContext extends Request {
  requestId?: string;
  user?: JwtPayload;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    // Generate unique request ID
    const requestId = req.headers['x-request-id'] as string || randomUUID();
    req.requestId = requestId;

    // Add to response headers
    res.setHeader('X-Request-ID', requestId);

    // Extract user context if authenticated
    const user = req.user as JwtPayload | undefined;
    const tenantId = user?.tenantId;
    const userId = user?.sub;
    const userRole = user?.role;

    // Set up logger context for this request
    this.logger.setContext({
      requestId,
      ...(tenantId && { tenantId }),
      ...(userId && { userId }),
      ...(userRole && { userRole }),
    });

    // Log request start (only for non-health-check requests)
    if (!req.originalUrl.startsWith('/api/health')) {
      this.logger.debug('Request received', {
        method: req.method,
        path: req.originalUrl,
      });
    }

    // Capture response timing
    const startTime = Date.now();

    // Store context in AsyncLocalStorage for access in nested async operations
    const context = {
      requestId,
      ...(tenantId && { tenantId }),
      ...(userId && { userId }),
      ...(userRole && { userRole }),
    };

    // Clear context when response finishes
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      // Log request completion (only for non-health-check requests)
      if (!req.originalUrl.startsWith('/api/health')) {
        this.logger.debug('Request completed', {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          duration,
        });
      }

      // Clear context after response
      this.logger.clearContext();
    });

    // Run remaining middleware chain in request context
    runWithRequestContext(context, () => {
      next();
    });
  }
}
