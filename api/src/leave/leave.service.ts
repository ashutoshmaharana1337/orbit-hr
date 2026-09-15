import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoftDeleteService } from '../common/soft-delete.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service.js';
import type { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import type { ListLeaveQuery } from './dto/list-leave.query.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { toCursor, fromCursor, type CursorPaginatedResponse } from '../common/pagination.js';
import { businessDateUTC } from '../attendance/business-time.js';

/** Inclusive count of working days (Mon-Fri) between two UTC-midnight dates. Negative when end < start. */
function daysBetweenInclusive(start: Date, end: Date) {
  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (span < 0) return span;
  let days = 0;
  for (let i = 0; i <= span; i++) {
    const dow = new Date(start.getTime() + i * 86_400_000).getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

/** Leave types that draw down a LeaveBalance, keyed to the seeded LeavePolicy name. */
const BALANCE_POLICY_NAME: Partial<Record<CreateLeaveRequestDto['type'], string>> = {
  ANNUAL: 'Annual Leave',
  SICK: 'Sick Leave',
};

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

    if (days < 0) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    const today = businessDateUTC(tenant?.timezone ?? 'UTC');
    if (startDate.getTime() < today.getTime()) {
      throw new BadRequestException('startDate cannot be in the past');
    }

    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        employeeId: employee.id,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (overlapping) {
      throw new ConflictException('An existing leave request already covers part of this date range');
    }

    if (days === 0) {
      throw new BadRequestException('Range contains no working days');
    }

    // Balance check only applies once the tenant has configured the matching policy;
    // a freshly registered tenant with no policies can still file requests.
    const policyName = BALANCE_POLICY_NAME[dto.type];
    const leavePolicy = policyName
      ? await this.prisma.leavePolicy.findFirst({ where: { tenantId, name: policyName } })
      : null;
    if (leavePolicy) {
      const balance = await this.prisma.leaveBalance.findFirst({
        where: {
          tenantId,
          employeeId: employee.id,
          leavePolicyId: leavePolicy.id,
          year: startDate.getUTCFullYear(),
        },
      });
      const available = balance ? Number(balance.balanceDays) : 0;
      if (available < days) {
        throw new BadRequestException(`Insufficient leave balance (${available} days available)`);
      }
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

  private async findPolicy(tenantId: string, policyName: string) {
    const leavePolicy = await this.prisma.leavePolicy.findFirst({
      where: { tenantId, name: policyName },
    });
    if (!leavePolicy) {
      throw new BadRequestException(`Leave policy "${policyName}" not found for this tenant`);
    }
    return leavePolicy;
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
    const policyName = BALANCE_POLICY_NAME[request.type];
    if (approve && policyName) {
      const leavePolicy = await this.findPolicy(tenantId, policyName);

      // Balance year is the year the leave is taken in, not the year it's approved.
      const year = request.startDate.getUTCFullYear();
      const balance = await this.prisma.leaveBalance.findFirst({
        where: {
          tenantId,
          employeeId: request.employeeId,
          leavePolicyId: leavePolicy.id,
          year,
        },
      });

      if (!balance) {
        throw new BadRequestException(`Leave balance not found for this employee in ${year}`);
      }

      // Check if approval would exceed balance
      const newUsedDays = Number(balance.usedDays) + request.days;
      if (newUsedDays > Number(balance.entitledDays)) {
        throw new BadRequestException('Approving this request would exceed the remaining leave balance');
      }

      // Deduct days from balance (conditional update; throws 400 if it would overdraw)
      await this.leaveBalances.deductDays(
        tenantId,
        request.employeeId,
        leavePolicy.id,
        year,
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

  async balance(tenantId: string, employeeId: string, requester: JwtPayload, year?: number) {
    const employee = await this.prisma.employee.findFirst({
      where: SoftDeleteService.whereActive({ id: employeeId, tenantId }),
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (requester.role !== 'ADMIN' && requester.role !== 'HR') {
      const self = await this.employees.findByUserId(tenantId, requester.sub);
      const allowed = self.id === employeeId || (requester.role === 'MANAGER' && employee.managerId === self.id);
      if (!allowed) throw new ForbiddenException("You cannot view this employee's leave balance");
    }

    // LeaveBalance is unique on [tenantId, employeeId, leavePolicyId, year];
    // return every policy's balance for this employee in the requested year.
    const balances = await this.prisma.leaveBalance.findMany({
      where: { tenantId, employeeId, year: year ?? new Date().getFullYear() },
      include: { leavePolicy: { select: { id: true, name: true } } },
      orderBy: { leavePolicy: { name: 'asc' } },
    });
    return balances.map((b) => ({
      policy: b.leavePolicy,
      year: b.year,
      entitledDays: Number(b.entitledDays),
      usedDays: Number(b.usedDays),
      balanceDays: Number(b.balanceDays),
    }));
  }
}
