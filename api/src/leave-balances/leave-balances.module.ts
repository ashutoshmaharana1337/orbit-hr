import { Module } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service.js';
import { LeaveBalancesController } from './leave-balances.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmployeesModule } from '../employees/employees.module.js';

@Module({
  imports: [AuthModule, EmployeesModule],
  controllers: [LeaveBalancesController],
  providers: [LeaveBalancesService],
  exports: [LeaveBalancesService],
})
export class LeaveBalancesModule {}
