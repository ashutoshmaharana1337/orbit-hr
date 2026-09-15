import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';

@Controller('leave-balances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveBalancesController {
  constructor(private readonly leaveBalances: LeaveBalancesService) {}

  /**
   * Get leave balance for an employee in a specific year.
   * GET /leave-balances/:employeeId?year=2026
   * If year is not provided, defaults to current year.
   */
  @Get(':employeeId')
  getBalance(
    @CurrentUser() user: JwtPayload,
    @Param('employeeId') employeeId: string,
    @Query('year') year?: string,
  ) {
    const queryYear = year ? parseInt(year) : new Date().getFullYear();
    return this.leaveBalances.getByEmployeeAndYear(user.tenantId, employeeId, queryYear, user);
  }

  /**
   * Get current year leave balance for an employee.
   * GET /leave-balances/:employeeId/current
   */
  @Get(':employeeId/current')
  getCurrentBalance(@CurrentUser() user: JwtPayload, @Param('employeeId') employeeId: string) {
    return this.leaveBalances.getCurrentBalance(user.tenantId, employeeId, user);
  }
}
