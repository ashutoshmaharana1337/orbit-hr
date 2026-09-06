import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEmployeeDto } from './dto/create-employee.dto.js';
import type { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import type { ListEmployeesQuery } from './dto/list-employees.query.js';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: ListEmployeesQuery) {
    return this.prisma.employee.findMany({
      where: {
        tenantId,
        department: query.department || undefined,
        status: query.status || undefined,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { title: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { manager: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        manager: { select: { id: true, name: true } },
        reports: { select: { id: true, name: true, title: true } },
        leaveBalance: true,
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  create(tenantId: string, dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        title: dto.title,
        department: dto.department,
        location: dto.location,
        status: dto.status ?? 'ACTIVE',
        managerId: dto.managerId,
        joinDate: new Date(dto.joinDate),
        phone: dto.phone,
        leaveBalance: { create: {} },
      },
    });
  }

  async findByUserId(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { tenantId, userId } });
    if (!employee) throw new NotFoundException('No employee record linked to this account');
    return employee;
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findOne(tenantId, id);
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
      },
    });
  }
}
