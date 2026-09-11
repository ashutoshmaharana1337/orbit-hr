import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @HttpCode(200)
  async health() {
    const result = await this.appService.health();

    // Return 503 if database is not connected
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
