import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service.js';
import { LeaveController } from './leave.controller.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module.js';

@Module({
  imports: [EmployeesModule, AuthModule, LeaveBalancesModule],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
