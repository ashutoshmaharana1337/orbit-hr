import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLeavePolicyDto } from './dto/create-leave-policy.dto.js';
import type { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto.js';
import type { ListLeavePoliciesQuery } from './dto/list-leave-policies.query.js';
import { toCursor, fromCursor, type CursorPaginatedResponse } from '../common/pagination.js';

@Injectable()
export class LeavePolicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateLeavePolicyDto) {
    return this.prisma.leavePolicy.create({
      data: {
        tenantId,
        name: dto.name,
        workingDaysPerWeek: dto.workingDaysPerWeek ?? 5,
        publicHolidaysPerYear: dto.publicHolidaysPerYear ?? 0,
        entitlementDays: dto.entitlementDays,
      },
    });
  }

  async list(tenantId: string, query?: ListLeavePoliciesQuery): Promise<CursorPaginatedResponse<any>> {
    const limit = query?.limit ?? 20;
    // Decode cursor if provided
    let cursorId: string | undefined;
    if (query?.cursor) {
      try {
        cursorId = fromCursor(query.cursor);
      } catch {
        throw new Error('Invalid cursor');
      }
    }

    const where = {
      tenantId,
      // Cursor condition: fetch records with ID > cursor ID
      ...(cursorId ? { id: { gt: cursorId } } : {}),
    };

    const items = await this.prisma.leavePolicy.findMany({
      where,
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
    const policy = await this.prisma.leavePolicy.findFirst({
      where: { id, tenantId },
    });

    if (!policy) {
      throw new NotFoundException('Leave policy not found');
    }

    return policy;
  }

  async update(tenantId: string, id: string, dto: UpdateLeavePolicyDto) {
    await this.findOne(tenantId, id);

    return this.prisma.leavePolicy.update({
      where: { id },
      data: {
        name: dto.name,
        workingDaysPerWeek: dto.workingDaysPerWeek,
        publicHolidaysPerYear: dto.publicHolidaysPerYear,
        entitlementDays: dto.entitlementDays,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.leavePolicy.delete({
      where: { id },
    });
  }
}
