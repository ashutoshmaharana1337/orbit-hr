import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequestLogService } from './request-log.service.js';
import { DEBUG_PAGE_HTML, DEBUG_PAGE_SCRIPT } from './debug-page.html.js';

@Controller('debug')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DebugController {
  constructor(private readonly requestLog: RequestLogService) {}

  @Get()
  page(@Res() res: Response) {
    res.type('html').send(DEBUG_PAGE_HTML);
  }

  @Get('script.js')
  script(@Res() res: Response) {
    res.type('application/javascript').send(DEBUG_PAGE_SCRIPT);
  }

  @Get('requests')
  requests() {
    return this.requestLog.list();
  }
}
