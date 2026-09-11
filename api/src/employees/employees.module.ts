import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service.js';
import { EmployeesController } from './employees.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { SoftDeleteService } from '../common/soft-delete.service.js';

@Module({
  imports: [AuthModule],
  controllers: [EmployeesController],
  providers: [SoftDeleteService, EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
