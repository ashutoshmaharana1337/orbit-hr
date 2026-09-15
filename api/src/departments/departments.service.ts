import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateDepartmentDto } from './dto/create-department.dto.js';
import type { UpdateDepartmentDto } from './dto/update-department.dto.js';
import type { ListDepartmentsQuery } from './dto/list-departments.query.js';
import { toCursor, fromCursor, type CursorPaginatedResponse } from '../common/pagination.js';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Confirms `id` names a Department in `tenantId`. Throws 404 otherwise. */
  async assertBelongsToTenant(tenantId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async list(tenantId: string, query: ListDepartmentsQuery): Promise<CursorPaginatedResponse<any>> {
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

    const where = {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      // Cursor condition: fetch records with ID > cursor ID
      ...(cursorId ? { id: { gt: cursorId } } : {}),
    };

    const items = await this.prisma.department.findMany({
      where,
      include: {
        _count: {
          select: { employees: true },
        },
      },
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

  async findOne(tenantId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, tenantId },
      include: {
        employees: {
          select: { id: true, name: true, title: true, email: true },
        },
        _count: {
          select: { employees: true },
        },
      },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async create(tenantId: string, dto: CreateDepartmentDto) {
    // Check for duplicate name within the tenant
    const existing = await this.prisma.department.findFirst({
      where: {
        tenantId,
        name: { equals: dto.name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Department with name "${dto.name}" already exists in this organization`,
      );
    }

    return this.prisma.department.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
      },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    await this.assertBelongsToTenant(tenantId, id);

    // If updating name, check for duplicates
    if (dto.name) {
      const existing = await this.prisma.department.findFirst({
        where: {
          tenantId,
          id: { not: id },
          name: { equals: dto.name, mode: 'insensitive' },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Department with name "${dto.name}" already exists in this organization`,
        );
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });
  }

  async delete(tenantId: string, id: string) {
    await this.assertBelongsToTenant(tenantId, id);

    // Check if department has any employees
    const department = await this.prisma.department.findFirst({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });

    if (department && department._count.employees > 0) {
      throw new ConflictException(
        `Cannot delete department "${department.name}" as it has ${department._count.employees} employee(s). Please reassign employees first.`,
      );
    }

    return this.prisma.department.delete({
      where: { id },
    });
  }
}
