import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async health() {
    try {
      // Ping the database with a simple query
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', timestamp: new Date().toISOString(), database: 'healthy' };
    } catch (error) {
      return { status: 'degraded', timestamp: new Date().toISOString(), database: 'unhealthy', error: (error as Error).message };
    }
  }
}
