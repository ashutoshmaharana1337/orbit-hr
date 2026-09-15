/**
 * Pino Logger Service for NestJS
 *
 * Extends NestJS Logger with Pino for structured JSON logging.
 * Auto-captures request context:
 * - requestId (UUID, generated per request)
 * - tenantId (from JWT or request context)
 * - userId (from authenticated user)
 * - userRole (user's role)
 *
 * Log levels: debug, info, warn, error
 * Each log entry includes timestamp, level, message, context
 *
 * Usage:
 *   constructor(private readonly logger: PinoLoggerService) {}
 *   this.logger.info('Employee created', { employeeId: id, duration_ms: 45 });
 */

import { Injectable, LoggerService as NestLoggerService, Optional } from '@nestjs/common';
import pino from 'pino';
import { getRequestContext } from './request-context.js';

export interface LogContext {
  [key: string]: any;
}

@Injectable()
export class PinoLoggerService implements NestLoggerService {
  private logger: pino.Logger;
  private context: string;

  constructor(@Optional() context?: string) {
    this.context = context || 'App';

    // Configure Pino based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isProduction) {
      // Production: JSON output to stdout (for log drains)
      this.logger = pino(
        {
          level: process.env.LOG_LEVEL || 'info',
          timestamp: pino.stdTimeFunctions.isoTime,
          formatters: {
            level: (label) => {
              return { level: label };
            },
          },
        },
        pino.transport({
          target: 'pino/file',
          options: {
            destination: 1, // stdout
            sync: false,
          },
        }),
      );
    } else if (isDevelopment) {
      // Development: Pretty-printed colorized output
      this.logger = pino(
        {
          level: process.env.LOG_LEVEL || 'debug',
          timestamp: pino.stdTimeFunctions.isoTime,
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          },
        },
      );
    } else {
      // Test: Minimal output
      this.logger = pino(
        {
          level: 'silent',
        },
      );
    }
  }

  /**
   * Merge request context with log context
   */
  private mergeContext(extra?: LogContext): LogContext {
    const requestContext = getRequestContext();
    const merged: LogContext = {
      ...(requestContext || {}),
      ...(extra || {}),
      service: this.context,
    };
    return merged;
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: LogContext) {
    const mergedContext = this.mergeContext(context);
    this.logger.debug(mergedContext, message);
  }

  /**
   * Log at info level
   */
  log(message: string, context?: LogContext) {
    const mergedContext = this.mergeContext(context);
    this.logger.info(mergedContext, message);
  }

  /**
   * Log at info level (alias for log)
   */
  info(message: string, context?: LogContext) {
    this.log(message, context);
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: LogContext) {
    const mergedContext = this.mergeContext(context);
    this.logger.warn(mergedContext, message);
  }

  /**
   * Log at error level
   */
  error(message: string, trace?: string | LogContext, context?: LogContext) {
    let errorContext = context || {};
    let errorTrace: string | undefined;

    // Handle overloaded parameters
    if (typeof trace === 'string') {
      errorTrace = trace;
    } else if (typeof trace === 'object') {
      errorContext = trace;
    }

    const mergedContext = this.mergeContext(errorContext);
    if (errorTrace) {
      mergedContext.stack = errorTrace;
    }
    this.logger.error(mergedContext, message);
  }

  /**
   * Set the context name for this logger instance
   */
  setContext(context: string) {
    this.context = context;
  }
}
