import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import type { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import type { ListLeaveQuery } from './dto/list-leave.query.js';

function daysBetweenInclusive(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
  ) {}

  list(tenantId: string, query: ListLeaveQuery) {
    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: query.status || undefined,
        employeeId: query.employeeId || undefined,
      },
      include: { employee: { select: { id: true, name: true, department: true } } },
      orderBy: { appliedOn: 'desc' },
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

  async decide(tenantId: string, id: string, decidedByUserId: string, approve: boolean) {
    const request = await this.prisma.leaveRequest.findFirst({ where: { id, tenantId } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('This request has already been decided');
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        decidedAt: new Date(),
        decidedBy: decidedByUserId,
      },
    });

    if (approve && (request.type === 'ANNUAL' || request.type === 'SICK')) {
      const field = request.type === 'ANNUAL' ? 'annualUsed' : 'sickUsed';
      await this.prisma.leaveBalance.update({
        where: { employeeId: request.employeeId },
        data: { [field]: { increment: request.days } },
      });
    }

    return updated;
  }

  async balance(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.leaveBalance.findUniqueOrThrow({ where: { employeeId } });
  }
}
