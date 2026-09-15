import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const mockAppService = {
      health: vi.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('health', () => {
    it('should return ok status when database is healthy', async () => {
      const healthResult = {
        status: 'ok',
        timestamp: new Date(),
        database: 'connected',
        responseTime: 50,
      };

      vi.mocked(appService.health).mockResolvedValueOnce(healthResult);

      const result = await appController.health();

      expect(result).toMatchObject({ status: 'ok' });
      expect(result.timestamp).toBeDefined();
      expect(result.database).toBe('connected');
      expect(typeof result.responseTime).toBe('number');
    });

    it('should return ok status with response time', async () => {
      const healthResult = {
        status: 'ok',
        timestamp: new Date(),
        database: 'connected',
        responseTime: 75,
      };

      vi.mocked(appService.health).mockResolvedValueOnce(healthResult);

      const result = await appController.health();

      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.responseTime).toBeLessThan(1000); // Should be < 1s
    });

    it('should throw ServiceUnavailableException when database is unavailable', async () => {
      vi.mocked(appService.health).mockResolvedValueOnce({
        status: 'error',
        timestamp: new Date(),
        database: 'disconnected',
        error: 'Connection timeout',
        responseTime: 5000,
      });

      try {
        await appController.health();
        throw new Error('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
      }
    });

    it('should measure response time performance', async () => {
      const healthResult = {
        status: 'ok',
        timestamp: new Date(),
        database: 'connected',
        responseTime: 25,
      };

      vi.mocked(appService.health).mockResolvedValueOnce(healthResult);

      const startTime = Date.now();
      await appController.health();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Health check should complete within 1 second
    });
  });
});
