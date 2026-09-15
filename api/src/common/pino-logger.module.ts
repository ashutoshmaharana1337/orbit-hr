/**
 * Pino Logger Module
 *
 * Provides structured JSON logging with Pino.
 * Configuration:
 * - Production: JSON output to stdout (for log drains)
 * - Development: Pretty-printed colorized output
 */

import { Module } from '@nestjs/common';
import { PinoLoggerService } from './pino-logger.service.js';

@Module({
  providers: [PinoLoggerService],
  exports: [PinoLoggerService],
})
export class PinoLoggerModule {}
