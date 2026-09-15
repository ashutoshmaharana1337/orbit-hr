import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async health() {
    const startTime = Date.now();
    try {
      // Ping the database with a simple query
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        responseTime,
      };
    } catch {
      const responseTime = Date.now() - startTime;

      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        // Deliberately no error text: the raw driver message can include the
        // host, database name, or role. Details go to the log, not the client.
        database: 'disconnected',
        responseTime,
      };
    }
  }
}
