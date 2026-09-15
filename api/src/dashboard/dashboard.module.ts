import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { DashboardController } from './dashboard.controller.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AttendanceModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
