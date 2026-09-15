import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerService } from './logger.service.js';
import { LogShipperService } from './log-shipper.service.js';
import { PinoLoggerService } from './pino-logger.service.js';
import { PinoLoggerModule } from './pino-logger.module.js';
import { SentryService } from './sentry.service.js';
import { SentryContextInterceptor } from './sentry-context.interceptor.js';

/**
 * Common module for shared services used across the application
 * Provides:
 * - LoggerService: Structured JSON logging (legacy)
 * - PinoLoggerService: Structured JSON logging with Pino (recommended)
 * - LogShipperService: Log aggregation and shipping
 * - SentryService: Error tracking and monitoring
 * - SentryContextInterceptor: Enriches errors with tenant/user context
 */
@Global()
@Module({
  imports: [PinoLoggerModule],
  providers: [
    LoggerService,
    LogShipperService,
    PinoLoggerService,
    SentryService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryContextInterceptor,
    },
  ],
  exports: [LoggerService, LogShipperService, PinoLoggerService, SentryService],
})
export class CommonModule {}
