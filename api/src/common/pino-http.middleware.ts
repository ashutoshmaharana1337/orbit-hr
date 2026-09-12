/**
 * Pino HTTP Request Logging Middleware
 *
 * Logs all HTTP requests and responses with timing information.
 * Skips health check endpoints to reduce log verbosity.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class PinoHttpMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    // Skip health check endpoints
    if (req.path === '/api/health' || req.path === '/api/readiness') {
      return next();
    }

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `${req.method} ${req.path}`,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration_ms: duration,
        remoteAddress: req.ip,
      };
      console.log(JSON.stringify(logEntry));
    });

    next();
  }
}
