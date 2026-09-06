import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('today')
  today(@CurrentUser() user: JwtPayload) {
    return this.attendance.today(user.tenantId);
  }

  @Get('summary')
  summary(@CurrentUser() user: JwtPayload) {
    return this.attendance.summary(user.tenantId);
  }

  @Post('clock-in')
  clockIn(@CurrentUser() user: JwtPayload) {
    return this.attendance.clockIn(user.tenantId, user.sub);
  }

  @Patch('clock-out')
  clockOut(@CurrentUser() user: JwtPayload) {
    return this.attendance.clockOut(user.tenantId, user.sub);
  }

  @Post()
  @Roles('ADMIN', 'HR', 'MANAGER')
  upsert(@CurrentUser() user: JwtPayload, @Body() dto: UpsertAttendanceDto) {
    return this.attendance.upsert(user.tenantId, dto);
  }
}
