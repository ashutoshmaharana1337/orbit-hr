import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoftDeleteService } from '../common/soft-delete.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service.js';
import type { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import type { ListLeaveQuery } from './dto/list-leave.query.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { toCursor, fromCursor, type CursorPaginatedResponse } from '../common/pagination.js';

function daysBetweenInclusive(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly leaveBalances: LeaveBalancesService,
  ) {}

  async list(tenantId: string, requester: JwtPayload, query: ListLeaveQuery): Promise<CursorPaginatedResponse<any>> {
    const limit = query.limit ?? 20;
    // Decode cursor if provided
    let cursorId: string | undefined;
    if (query.cursor) {
      try {
        cursorId = fromCursor(query.cursor);
      } catch {
        throw new Error('Invalid cursor');
      }
    }

    const include = { employee: { select: { id: true, name: true, departmentId: true } } };

    if (requester.role === 'ADMIN' || requester.role === 'HR') {
      const items = await this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          status: query.status || undefined,
          employeeId: query.employeeId || undefined,
          employee: SoftDeleteService.whereActive({}),
          ...(cursorId ? { id: { gt: cursorId } } : {}),
        },
        include,
        orderBy: { id: 'asc' },
        take: limit + 1,
      });

      const hasMore = items.length > limit;
      const returnItems = items.slice(0, limit);
      const nextCursor = hasMore ? toCursor(returnItems[returnItems.length - 1].id) : null;

      return {
        items: returnItems,
        nextCursor,
        hasMore,
      };
    }

    const self = await this.employees.findByUserId(tenantId, requester.sub);

    if (requester.role === 'MANAGER') {
      const items = await this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          status: query.status || undefined,
          employee: SoftDeleteService.whereActive({ OR: [{ id: self.id }, { managerId: self.id }] }),
          ...(cursorId ? { id: { gt: cursorId } } : {}),
        },
        include,
        orderBy: { id: 'asc' },
        take: limit + 1,
      });

      const hasMore = items.length > limit;
      const returnItems = items.slice(0, limit);
      const nextCursor = hasMore ? toCursor(returnItems[returnItems.length - 1].id) : null;

      return {
        items: returnItems,
        nextCursor,
        hasMore,
      };
    }

    // EMPLOYEE: own requests only. A colleague's leave reason is not this role's business.
    const items = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: query.status || undefined,
        employeeId: self.id,
        ...(cursorId ? { id: { gt: cursorId } } : {}),
      },
      include,
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const returnItems = items.slice(0, limit);
    const nextCursor = hasMore ? toCursor(returnItems[returnItems.length - 1].id) : null;

    return {
      items: returnItems,
      nextCursor,
      hasMore,
    };
  }

  async create(tenantId: string, userId: string, dto: CreateLeaveRequestDto) {
    const employee = await this.employees.findByUserId(tenantId, userId);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const days = daysBetweenInclusive(startDate, endDate);

    if (days <= 0) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    return this.prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId: employee.id,
        type: dto.type,
        startDate,
        endDate,
        days,
        reason: dto.reason,
      },
    });
  }

  async decide(tenantId: string, id: string, approver: JwtPayload, approve: boolean) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      include: { employee: { select: { id: true, managerId: true, userId: true } } },
    });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('This request has already been decided');
    }
    if (request.employee.userId === approver.sub) {
      throw new ForbiddenException('You cannot approve or reject your own leave request');
    }
    if (approver.role === 'MANAGER') {
      const approverEmployee = await this.employees.findByUserId(tenantId, approver.sub);
      if (request.employee.managerId !== approverEmployee.id) {
        throw new ForbiddenException('You can only decide requests for your direct reports');
      }
    }

    // For tracked leave types, validate and update balance
    if (approve && (request.type === 'ANNUAL' || request.type === 'SICK')) {
      // Map LeaveType to LeavePolicy name
      const policyNameMap = {
        ANNUAL: 'Annual Leave',
        SICK: 'Sick Leave',
      };
      const policyName = policyNameMap[request.type];

      // Find the corresponding leave policy
      const leavePolicy = await this.prisma.leavePolicy.findFirst({
        where: { tenantId, name: policyName },
      });

      if (!leavePolicy) {
        throw new BadRequestException(`Leave policy "${policyName}" not found for this tenant`);
      }

      // Get or create balance for this employee, policy, and year
      const currentYear = new Date().getFullYear();
      const balance = await this.prisma.leaveBalance.findFirst({
        where: {
          tenantId,
          employeeId: request.employeeId,
          leavePolicyId: leavePolicy.id,
          year: currentYear,
        },
      });

      if (!balance) {
        throw new BadRequestException(`Leave balance not found for this employee in ${currentYear}`);
      }

      // Check if approval would exceed balance
      const newUsedDays = Number(balance.usedDays) + request.days;
      if (newUsedDays > Number(balance.entitledDays)) {
        throw new BadRequestException('Approving this request would exceed the remaining leave balance');
      }

      // Deduct days from balance
      await this.leaveBalances.deductDays(
        tenantId,
        request.employeeId,
        leavePolicy.id,
        currentYear,
        request.days,
      );
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        decidedAt: new Date(),
        decidedBy: approver.sub,
      },
    });
  }

  async balance(tenantId: string, employeeId: string, requester: JwtPayload) {
    const employee = await this.prisma.employee.findFirst({
      where: SoftDeleteService.whereActive({ id: employeeId, tenantId }),
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (requester.role !== 'ADMIN' && requester.role !== 'HR') {
      const self = await this.employees.findByUserId(tenantId, requester.sub);
      const allowed = self.id === employeeId || (requester.role === 'MANAGER' && employee.managerId === self.id);
      if (!allowed) throw new ForbiddenException("You cannot view this employee's leave balance");
    }

    return this.prisma.leaveBalance.findUniqueOrThrow({ where: { employeeId } });
  }
}
