import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertValidTimeZone } from '../attendance/business-time.js';
import type { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto.js';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  settings(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, timezone: true, lateCutoffMinutes: true },
    });
  }

  updateSettings(tenantId: string, dto: UpdateTenantSettingsDto) {
    if (dto.timezone) {
      try {
        assertValidTimeZone(dto.timezone);
      } catch {
        throw new BadRequestException(`Unknown time zone: ${dto.timezone}`);
      }
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { timezone: dto.timezone, lateCutoffMinutes: dto.lateCutoffMinutes },
      select: { id: true, name: true, slug: true, timezone: true, lateCutoffMinutes: true },
    });
  }
}
