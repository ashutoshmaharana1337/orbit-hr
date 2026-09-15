import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { PinoLoggerService } from './common/pino-logger.service.js';

// Tenant-timezone math (see attendance/business-time.ts) relies on the
// process's own local timezone being UTC — pin it explicitly rather than
// hoping the deployment environment defaults to UTC.
process.env.TZ = 'UTC';

// Sentry is initialised exactly once, by SentryService (common/sentry.service.ts),
// when the DI container constructs it.

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Use Pino logger globally
    logger: new PinoLoggerService('NestFactory'),
    bufferLogs: true,
    // Register only the JSON body parser below: the API never accepts form
    // posts, and leaving urlencoded parsing off closes the classic
    // <form>-based CSRF vector (see common/origin-check.middleware.ts).
    bodyParser: false,
  });
  app.useBodyParser('json');

  // Behind a reverse proxy / load balancer, trust X-Forwarded-* so req.ip,
  // secure-cookie detection and throttling see the real client.
  if (process.env.TRUST_PROXY) {
    app.getHttpAdapter().getInstance().set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  }

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
