import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DebugController } from './debug.controller.js';
import { RequestLogService } from './request-log.service.js';
import { RequestLogMiddleware } from './request-log.middleware.js';
import { AuthModule } from '../auth/auth.module.js';

// Registered only outside production (see app.module.ts) — an unauthenticated
// GET/PATCH storm still only reveals method/path/status/timing, but there's
// no reason to expose even that on a real deployment.
@Module({
  imports: [AuthModule],
  controllers: [DebugController],
  providers: [RequestLogService],
})
export class DebugModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLogMiddleware).forRoutes('*');
  }
}
