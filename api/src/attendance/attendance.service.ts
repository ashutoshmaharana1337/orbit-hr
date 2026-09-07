import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { businessDateUTC, minutesSinceLocalMidnight } from './business-time.js';
import type { UpsertAttendanceDto } from './dto/upsert-attendance.dto.js';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
  ) {}

  private async getTenantTimeSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true, lateCutoffMinutes: true },
    });
    return tenant;
  }

  async today(tenantId: string) {
    const { timezone } = await this.getTenantTimeSettings(tenantId);
    return this.prisma.attendanceRecord.findMany({
      where: { tenantId, date: businessDateUTC(timezone) },
      include: { employee: { select: { id: true, name: true, department: true } } },
      orderBy: { employee: { name: 'asc' } },
    });
  }

  async summary(tenantId: string) {
    const { timezone } = await this.getTenantTimeSettings(tenantId);
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { tenantId, date: businessDateUTC(timezone) },
      _count: true,
    });
    return grouped.map((g) => ({ status: g.status, count: g._count }));
  }

  async clockIn(tenantId: string, userId: string) {
    const { timezone, lateCutoffMinutes } = await this.getTenantTimeSettings(tenantId);
    const employee = await this.employees.findByUserId(tenantId, userId);
    const now = new Date();
    const date = businessDateUTC(timezone, now);

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date } },
    });
    if (existing) throw new ConflictException('Already clocked in today');

    const status = minutesSinceLocalMidnight(timezone, now) >= lateCutoffMinutes ? 'LATE' : 'PRESENT';

    return this.prisma.attendanceRecord.create({
      data: { tenantId, employeeId: employee.id, date, status, clockIn: now, hours: 0 },
    });
  }

  async clockOut(tenantId: string, userId: string) {
    const { timezone } = await this.getTenantTimeSettings(tenantId);
    const employee = await this.employees.findByUserId(tenantId, userId);
    const date = businessDateUTC(timezone);

    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date } },
    });
    if (!record || !record.clockIn) throw new NotFoundException('No clock-in found for today');
    if (record.clockOut) throw new ConflictException('Already clocked out today');

    const clockOut = new Date();
    const hours = Math.round(((clockOut.getTime() - record.clockIn.getTime()) / 3_600_000) * 100) / 100;

    return this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { clockOut, hours },
    });
  }

  async upsert(tenantId: string, dto: UpsertAttendanceDto) {
    await this.employees.assertBelongsToTenant(tenantId, dto.employeeId);
    const date = new Date(dto.date);
    return this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: {
        tenantId,
        employeeId: dto.employeeId,
        date,
        status: dto.status,
        clockIn: dto.clockIn ? new Date(dto.clockIn) : undefined,
        clockOut: dto.clockOut ? new Date(dto.clockOut) : undefined,
        hours: dto.hours ?? 0,
      },
      update: {
        status: dto.status,
        clockIn: dto.clockIn ? new Date(dto.clockIn) : undefined,
        clockOut: dto.clockOut ? new Date(dto.clockOut) : undefined,
        hours: dto.hours ?? undefined,
      },
    });
  }
}
