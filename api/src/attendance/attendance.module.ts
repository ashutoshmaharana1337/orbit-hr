import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { AttendanceController } from './attendance.controller.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [EmployeesModule, AuthModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
