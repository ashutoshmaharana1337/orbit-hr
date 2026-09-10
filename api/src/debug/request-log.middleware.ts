import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestLogService } from './request-log.service.js';

// Skip the debug endpoints themselves, or watching the log fills the log.
const IGNORED_PREFIX = '/api/debug';

@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  constructor(private readonly requestLog: RequestLogService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.originalUrl.startsWith(IGNORED_PREFIX)) return next();

    const start = Date.now();
    res.on('finish', () => {
      this.requestLog.record({
        time: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  }
}
