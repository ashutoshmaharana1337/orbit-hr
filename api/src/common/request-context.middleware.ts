/**
 * Request context middleware for distributed tracing and log correlation
 *
 * Responsibilities:
 * - Generate unique request ID for each request
 * - Store it in AsyncLocalStorage for access throughout request lifecycle
 * - Add X-Request-ID to response headers
 *
 * Middleware runs before Passport, so no user is known here. JwtStrategy
 * fills in tenantId/userId/userRole on the same store once the token is
 * verified; LoggerService reads the store on every log line.
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
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.requestId = requestId;

    // Add to response headers
    res.setHeader('X-Request-ID', requestId);

    // Capture response timing
    const startTime = Date.now();

    // Run remaining middleware chain in request context
    runWithRequestContext({ requestId }, () => {
      // Log request start (only for non-health-check requests)
      if (!req.originalUrl.startsWith('/api/health')) {
        this.logger.debug('Request received', {
          method: req.method,
          path: req.originalUrl,
        });
      }

      // Log request completion (only for non-health-check requests).
      // Registered inside the ALS scope so the listener sees this request's store.
      res.on('finish', () => {
        if (!req.originalUrl.startsWith('/api/health')) {
          this.logger.debug('Request completed', {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            duration: Date.now() - startTime,
          });
        }
      });

      next();
    });
  }
}
