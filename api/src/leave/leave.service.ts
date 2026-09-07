import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import type { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import type { ListLeaveQuery } from './dto/list-leave.query.js';
import type { JwtPayload } from '../auth/auth.types.js';

function daysBetweenInclusive(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
  ) {}

  async list(tenantId: string, requester: JwtPayload, query: ListLeaveQuery) {
    const include = { employee: { select: { id: true, name: true, department: true } } };
    const orderBy = { appliedOn: 'desc' as const };

    if (requester.role === 'ADMIN' || requester.role === 'HR') {
      return this.prisma.leaveRequest.findMany({
        where: { tenantId, status: query.status || undefined, employeeId: query.employeeId || undefined },
        include,
        orderBy,
      });
    }

    const self = await this.employees.findByUserId(tenantId, requester.sub);

    if (requester.role === 'MANAGER') {
      return this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          status: query.status || undefined,
          employee: { OR: [{ id: self.id }, { managerId: self.id }] },
        },
        include,
        orderBy,
      });
    }

    // EMPLOYEE: own requests only. A colleague's leave reason is not this role's business.
    return this.prisma.leaveRequest.findMany({
      where: { tenantId, status: query.status || undefined, employeeId: self.id },
      include,
      orderBy,
    });
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

    if (approve && (request.type === 'ANNUAL' || request.type === 'SICK')) {
      const balance = await this.prisma.leaveBalance.findUniqueOrThrow({ where: { employeeId: request.employeeId } });
      const field = request.type === 'ANNUAL' ? 'annualUsed' : 'sickUsed';
      const total = request.type === 'ANNUAL' ? balance.annualTotal : balance.sickTotal;
      if (balance[field] + request.days > total) {
        throw new BadRequestException('Approving this request would exceed the remaining leave balance');
      }
      await this.prisma.leaveBalance.update({
        where: { employeeId: request.employeeId },
        data: { [field]: { increment: request.days } },
      });
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
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');

    if (requester.role !== 'ADMIN' && requester.role !== 'HR') {
      const self = await this.employees.findByUserId(tenantId, requester.sub);
      const allowed = self.id === employeeId || (requester.role === 'MANAGER' && employee.managerId === self.id);
      if (!allowed) throw new ForbiddenException("You cannot view this employee's leave balance");
    }

    return this.prisma.leaveBalance.findUniqueOrThrow({ where: { employeeId } });
  }
}
