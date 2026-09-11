import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import type { JwtPayload } from '../auth/auth.types.js';

@Injectable()
export class LeaveBalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
  ) {}

  /**
   * Get leave balance for a specific employee in a specific year.
   * Returns all leave policies and their balances for that employee in that year.
   */
  async getByEmployeeAndYear(
    tenantId: string,
    employeeId: string,
    year: number,
    requester: JwtPayload,
  ) {
    // Verify employee exists in this tenant
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Check authorization: ADMIN/HR can see anyone, MANAGER can see reports, EMPLOYEE can see self
    if (requester.role !== 'ADMIN' && requester.role !== 'HR') {
      const self = await this.employees.findByUserId(tenantId, requester.sub);
      const isOwnBalance = self.id === employeeId;
      const isManager = requester.role === 'MANAGER' && employee.managerId === self.id;
      if (!isOwnBalance && !isManager) {
        throw new ForbiddenException("You cannot view this employee's leave balance");
      }
    }

    // Get all leave balances for this employee in this year
    const balances = await this.prisma.leaveBalance.findMany({
      where: {
        tenantId,
        employeeId,
        year,
      },
      include: {
        leavePolicy: {
          select: {
            id: true,
            name: true,
            workingDaysPerWeek: true,
            publicHolidaysPerYear: true,
            entitlementDays: true,
          },
        },
      },
      orderBy: {
        leavePolicy: {
          name: 'asc',
        },
      },
    });

    return {
      employeeId,
      year,
      balances,
    };
  }

  /**
   * Get the current balance for a specific employee across all leave policies.
   * Uses the current year.
   */
  async getCurrentBalance(
    tenantId: string,
    employeeId: string,
    requester: JwtPayload,
  ) {
    const currentYear = new Date().getFullYear();
    return this.getByEmployeeAndYear(tenantId, employeeId, currentYear, requester);
  }

  /**
   * Create or update leave balance when a new employee is onboarded or a leave policy is added.
   * This is typically called during employee creation or leave policy creation.
   */
  async createBalance(
    tenantId: string,
    employeeId: string,
    leavePolicyId: string,
    year: number,
    entitledDays: number,
  ) {
    return this.prisma.leaveBalance.upsert({
      where: {
        tenantId_employeeId_leavePolicyId_year: {
          tenantId,
          employeeId,
          leavePolicyId,
          year,
        },
      },
      create: {
        tenantId,
        employeeId,
        leavePolicyId,
        year,
        entitledDays: entitledDays,
        usedDays: 0,
        balanceDays: entitledDays,
      },
      update: {
        entitledDays,
        balanceDays: entitledDays, // Reset balance to entitled if entitlement changed
      },
    });
  }

  /**
   * Deduct days from leave balance when a leave request is approved.
   * Updates both usedDays and balanceDays.
   */
  async deductDays(
    tenantId: string,
    employeeId: string,
    leavePolicyId: string,
    year: number,
    daysToDeduct: number,
  ) {
    const balance = await this.prisma.leaveBalance.findFirst({
      where: {
        tenantId,
        employeeId,
        leavePolicyId,
        year,
      },
    });

    if (!balance) {
      throw new NotFoundException('Leave balance not found for this employee in the specified year');
    }

    const newUsedDays = Number(balance.usedDays) + daysToDeduct;
    const newBalanceDays = Number(balance.entitledDays) - newUsedDays;

    return this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        usedDays: newUsedDays,
        balanceDays: newBalanceDays,
      },
    });
  }

  /**
   * Restore days to leave balance when a leave request is cancelled/rejected.
   * Updates both usedDays and balanceDays.
   */
  async restoreDays(
    tenantId: string,
    employeeId: string,
    leavePolicyId: string,
    year: number,
    daysToRestore: number,
  ) {
    const balance = await this.prisma.leaveBalance.findFirst({
      where: {
        tenantId,
        employeeId,
        leavePolicyId,
        year,
      },
    });

    if (!balance) {
      throw new NotFoundException('Leave balance not found for this employee in the specified year');
    }

    const newUsedDays = Math.max(0, Number(balance.usedDays) - daysToRestore);
    const newBalanceDays = Number(balance.entitledDays) - newUsedDays;

    return this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        usedDays: newUsedDays,
        balanceDays: newBalanceDays,
      },
    });
  }
}
