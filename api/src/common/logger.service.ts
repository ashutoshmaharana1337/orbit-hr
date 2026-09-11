/**
 * Structured logging service for NestJS
 *
 * Provides consistent JSON logging with:
 * - Request ID tracking
 * - Tenant ID association
 * - User role context
 * - Log levels: error, warn, info, debug
 * - Output to stdout (for container log drivers)
 *
 * Usage in controllers/services:
 *   constructor(private readonly logger: LoggerService) {}
 *   this.logger.info('User login', { userId: user.id, tenantId: req.tenantId })
 */

import { Injectable, Logger } from '@nestjs/common';

export interface LogContext {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  userRole?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface LogEntry extends LogContext {
  message: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  duration?: number; // milliseconds
  statusCode?: number;
  endpoint?: string;
}

@Injectable()
export class LoggerService extends Logger {
  private context: LogContext = {};

  setContext(context: Partial<LogContext>) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  private formatLog(message: string, level: string, extra?: LogContext): LogEntry {
    return {
      message,
      level: level as any,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...extra,
    };
  }

  debug(message: string, extra?: LogContext) {
    const entry = this.formatLog(message, 'debug', extra);
    console.log(JSON.stringify(entry));
    super.debug(message);
  }

  info(message: string, extra?: LogContext) {
    const entry = this.formatLog(message, 'info', extra);
    console.log(JSON.stringify(entry));
    super.log(message);
  }

  warn(message: string, extra?: LogContext) {
    const entry = this.formatLog(message, 'warn', extra);
    console.warn(JSON.stringify(entry));
    super.warn(message);
  }

  error(message: string, trace?: string, extra?: LogContext) {
    const entry = this.formatLog(message, 'error', extra);
    if (trace) {
      entry['stack'] = trace;
    }
    console.error(JSON.stringify(entry));
    super.error(message, trace);
  }
}
