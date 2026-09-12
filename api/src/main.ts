import * as Sentry from '@sentry/nestjs';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { PinoLoggerService } from './common/pino-logger.service.js';

// Tenant-timezone math (see attendance/business-time.ts) relies on the
// process's own local timezone being UTC — pin it explicitly rather than
// hoping the deployment environment defaults to UTC.
process.env.TZ = 'UTC';

// Initialize Sentry at the very top of the application.
// This must happen before any other code that might throw errors.
if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Sample 10% of transactions in production to balance cost vs visibility
    tracesSampleRate: (process.env.NODE_ENV || 'development') === 'production' ? 0.1 : 1.0,
    attachStacktrace: true,
    // Integrations are added automatically by @sentry/nestjs
    // You can customize them here if needed
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Use Pino logger globally
    logger: new PinoLoggerService('NestFactory'),
    bufferLogs: true,
  });

  // Set Pino logger as global logger
  const pinoLogger = app.get(PinoLoggerService);
  app.useLogger(pinoLogger);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  pinoLogger.log(`Application running on port ${port}`);
}
await bootstrap();
