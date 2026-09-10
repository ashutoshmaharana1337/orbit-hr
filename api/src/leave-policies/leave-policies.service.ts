import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLeavePolicyDto } from './dto/create-leave-policy.dto.js';
import type { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto.js';

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

  async list(tenantId: string) {
    return this.prisma.leavePolicy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
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
