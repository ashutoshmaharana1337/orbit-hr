/**
 * Request ID Interceptor
 *
 * Generates a unique requestId (UUID v4) for every incoming request
 * and stores it in AsyncLocalStorage for access throughout the request lifecycle.
 * Also adds the requestId to response headers.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { generateRequestId, runWithRequestContext } from './request-context.js';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = generateRequestId();
    const tenantId = (req as any).tenantId; // Set by auth/tenant context
    const userId = (req as any).user?.id; // Set by JWT guard
    const userRole = (req as any).user?.role; // Set by JWT guard

    // Add requestId to response headers
    res.setHeader('X-Request-ID', requestId);

    // Store context and continue with next middleware
    runWithRequestContext(
      {
        requestId,
        tenantId,
        userId,
        userRole,
      },
      () => next(),
    );
  }
}
