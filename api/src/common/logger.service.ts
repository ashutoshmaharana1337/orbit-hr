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

import { Injectable, Logger, Optional } from '@nestjs/common';
import { LogShipperService } from './log-shipper.service.js';
import { getRequestContext } from './request-context.js';

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
  constructor(@Optional() private readonly logShipper?: LogShipperService) {
    super();
  }

  /** Nest's base Logger passes a string context as the trailing arg; fold it into the entry. */
  private normalizeExtra(extra?: LogContext | string): LogContext | undefined {
    return typeof extra === 'string' ? { context: extra } : extra;
  }

  private requestFields(): LogContext {
    const ctx = getRequestContext();
    if (!ctx) return {};
    return {
      requestId: ctx.requestId,
      ...(ctx.tenantId && { tenantId: ctx.tenantId }),
      ...(ctx.userId && { userId: ctx.userId }),
      ...(ctx.userRole && { userRole: ctx.userRole }),
    };
  }

  private formatLog(message: string, level: string, extra?: LogContext | string): LogEntry {
    return {
      message,
      level: level as any,
      timestamp: new Date().toISOString(),
      // Per-request fields come from AsyncLocalStorage, never from mutable
      // state on this singleton — concurrent requests would bleed into each
      // other's log lines otherwise.
      ...this.requestFields(),
      ...this.normalizeExtra(extra),
    };
  }

  debug(message: string, extra?: LogContext | string) {
    const entry = this.formatLog(message, 'debug', extra);
    console.log(JSON.stringify(entry));
    // Ship log to aggregation service if available
    if (this.logShipper) {
      this.logShipper.queueLog(entry);
    }
    super.debug(message);
  }

  info(message: string, extra?: LogContext) {
    const entry = this.formatLog(message, 'info', extra);
    console.log(JSON.stringify(entry));
    // Ship log to aggregation service if available
    if (this.logShipper) {
      this.logShipper.queueLog(entry);
    }
    super.log(message);
  }

  warn(message: string, extra?: LogContext | string) {
    const entry = this.formatLog(message, 'warn', extra);
    console.warn(JSON.stringify(entry));
    // Ship log to aggregation service if available
    if (this.logShipper) {
      this.logShipper.queueLog(entry);
    }
    super.warn(message);
  }

  error(message: string, trace?: string, extra?: LogContext | string) {
    const entry = this.formatLog(message, 'error', extra);
    if (trace) {
      entry['stack'] = trace;
    }
    console.error(JSON.stringify(entry));
    // Ship log to aggregation service if available
    if (this.logShipper) {
      this.logShipper.queueLog(entry);
    }
    super.error(message, trace);
  }

  async logSystemEvent(event: { action: string; details?: Record<string, any> }) {
    const entry = this.formatLog(`System: ${event.action}`, 'info', {
      action: event.action,
      ...event.details,
    });
    console.log(JSON.stringify(entry));
    // Ship log to aggregation service if available
    if (this.logShipper) {
      this.logShipper.queueLog(entry);
    }
  }
}
