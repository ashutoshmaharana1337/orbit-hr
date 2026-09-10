import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoftDeleteService } from '../common/soft-delete.service.js';
import type { CreateEmployeeDto } from './dto/create-employee.dto.js';
import type { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import type { ListEmployeesQuery } from './dto/list-employees.query.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { toCursor, fromCursor, type CursorPaginatedResponse } from '../common/pagination.js';

const PUBLIC_DIRECTORY_FIELDS = {
  id: true,
  name: true,
  title: true,
  departmentId: true,
  status: true,
  managerId: true,
} as const;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly softDelete: SoftDeleteService,
  ) {}

  /** Confirms `id` names an active (non-soft-deleted) Employee in `tenantId`. Throws 404 otherwise (never leaks cross-tenant existence). */
  async assertBelongsToTenant(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: SoftDeleteService.whereActive({ id, tenantId }),
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async list(tenantId: string, requester: JwtPayload, query: ListEmployeesQuery): Promise<CursorPaginatedResponse<any>> {
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

    const baseWhere = SoftDeleteService.whereActive({
      tenantId,
      departmentId: query.departmentId || undefined,
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
      // Cursor condition: fetch records with ID > cursor ID
      ...(cursorId ? { id: { gt: cursorId } } : {}),
    });

    if (requester.role === 'ADMIN' || requester.role === 'HR') {
      const items = await this.prisma.employee.findMany({
        where: baseWhere,
        include: { manager: { select: { id: true, name: true } } },
        orderBy: { id: 'asc' },
        take: limit + 1, // Fetch one extra to determine hasMore
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

    const self = await this.findByUserId(tenantId, requester.sub);

    if (requester.role === 'MANAGER') {
      const items = await this.prisma.employee.findMany({
        where: { ...baseWhere, OR: [{ id: self.id }, { managerId: self.id }] },
        include: { manager: { select: { id: true, name: true } } },
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

    // EMPLOYEE: full record for self, public directory subset for everyone else.
    // Self record is always included (not paginated), only directory is paginated
    const filterWhere = SoftDeleteService.whereActive({
      tenantId,
      departmentId: query.departmentId || undefined,
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
    });

    const [ownRecord, directoryItems] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { ...filterWhere, id: self.id },
        include: { manager: { select: { id: true, name: true } } },
      }),
      this.prisma.employee.findMany({
        where: { ...filterWhere, id: { not: self.id }, ...(cursorId ? { id: { gt: cursorId } } : {}) },
        select: PUBLIC_DIRECTORY_FIELDS,
        orderBy: { id: 'asc' },
        take: limit + 1,
      }),
    ]);

    const hasMore = directoryItems.length > limit;
    const returnDirItems = directoryItems.slice(0, limit);
    const merged = [...(ownRecord ? [ownRecord] : []), ...returnDirItems];

    let nextCursor: string | null = null;
    if (hasMore && merged.length > 0) {
      nextCursor = toCursor(merged[merged.length - 1].id);
    }

    return {
      items: merged,
      nextCursor,
      hasMore,
    };
  }

  async findOne(tenantId: string, id: string, requester?: JwtPayload) {
    const employee = await this.prisma.employee.findFirst({
      where: SoftDeleteService.whereActive({ id, tenantId }),
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
        departmentId: dto.departmentId,
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
    const employee = await this.prisma.employee.findFirst({
      where: SoftDeleteService.whereActive({ tenantId, userId }),
    });
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

  /**
   * Soft-delete an employee (marks as deleted, doesn't remove from DB).
   * Used for offboarding - keeps audit trail and prevents foreign key issues.
   */
  async softDelete(tenantId: string, employeeId: string) {
    // Verify employee exists and is active
    await this.assertBelongsToTenant(tenantId, employeeId);
    return this.softDelete.softDeleteEmployee(tenantId, employeeId);
  }

  /**
   * Restore a soft-deleted employee (clears the deletedAt timestamp).
   */
  async restore(tenantId: string, employeeId: string) {
    return this.softDelete.restoreEmployee(tenantId, employeeId);
  }

  /**
   * List all soft-deleted employees in a tenant (ADMIN only view).
   */
  async listDeleted(tenantId: string) {
    return this.prisma.employee.findMany({
      where: SoftDeleteService.whereDeleted({ tenantId }),
      include: { manager: { select: { id: true, name: true } } },
      orderBy: { deletedAt: 'desc' },
    });
  }
}
