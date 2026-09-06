import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEmployeeDto } from './dto/create-employee.dto.js';
import type { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import type { ListEmployeesQuery } from './dto/list-employees.query.js';
import type { JwtPayload } from '../auth/auth.types.js';

const PUBLIC_DIRECTORY_FIELDS = {
  id: true,
  name: true,
  title: true,
  department: true,
  status: true,
  managerId: true,
} as const;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Confirms `id` names an Employee in `tenantId`. Throws 404 otherwise (never leaks cross-tenant existence). */
  async assertBelongsToTenant(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async list(tenantId: string, requester: JwtPayload, query: ListEmployeesQuery) {
    const where = {
      tenantId,
      department: query.department || undefined,
      status: query.status || undefined,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    if (requester.role === 'ADMIN' || requester.role === 'HR') {
      return this.prisma.employee.findMany({
        where,
        include: { manager: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      });
    }

    const self = await this.findByUserId(tenantId, requester.sub);

    if (requester.role === 'MANAGER') {
      return this.prisma.employee.findMany({
        where: { ...where, OR: [{ id: self.id }, { managerId: self.id }] },
        include: { manager: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      });
    }

    // EMPLOYEE: full record for self, public directory subset for everyone else.
    const [own, directory] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { ...where, id: self.id },
        include: { manager: { select: { id: true, name: true } } },
      }),
      this.prisma.employee.findMany({
        where: { ...where, id: { not: self.id } },
        select: PUBLIC_DIRECTORY_FIELDS,
        orderBy: { name: 'asc' },
      }),
    ]);
    return [...(own ? [own] : []), ...directory];
  }

  async findOne(tenantId: string, id: string, requester?: JwtPayload) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        manager: { select: { id: true, name: true } },
        reports: { select: { id: true, name: true, title: true } },
        leaveBalance: true,
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (!requester || requester.role === 'ADMIN' || requester.role === 'HR') return employee;

    const self = await this.findByUserId(tenantId, requester.sub);
    if (self.id === employee.id) return employee;
    if (requester.role === 'MANAGER' && employee.managerId === self.id) return employee;

    const { phone: _phone, leaveBalance: _leaveBalance, reports: _reports, ...publicFields } = employee;
    return publicFields;
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    if (dto.managerId) {
      await this.assertBelongsToTenant(tenantId, dto.managerId);
    }
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
    if (dto.managerId) {
      await this.assertBelongsToTenant(tenantId, dto.managerId);
    }
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
      },
    });
  }
}
