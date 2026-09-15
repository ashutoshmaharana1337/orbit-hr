import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoftDeleteService } from '../common/soft-delete.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { businessDateUTC, minutesSinceLocalMidnight } from './business-time.js';
import type { UpsertAttendanceDto } from './dto/upsert-attendance.dto.js';
import type { JwtPayload } from '../auth/auth.types.js';

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

  /**
   * Which employees' records the requester may see: everyone for ADMIN/HR,
   * self + direct reports for MANAGER, self only for EMPLOYEE.
   */
  private async visibleEmployeeFilter(
    tenantId: string,
    requester: JwtPayload | undefined,
  ): Promise<{ employeeId?: string; employee?: { OR: { id?: string; managerId?: string }[] } }> {
    if (!requester || requester.role === 'ADMIN' || requester.role === 'HR') return {};
    const self = await this.employees.findByUserId(tenantId, requester.sub);
    if (requester.role === 'MANAGER') {
      return { employee: { OR: [{ id: self.id }, { managerId: self.id }] } };
    }
    return { employeeId: self.id };
  }

  async today(tenantId: string, requester: JwtPayload) {
    const [{ timezone }, scope] = await Promise.all([
      this.getTenantTimeSettings(tenantId),
      this.visibleEmployeeFilter(tenantId, requester),
    ]);
    return this.prisma.attendanceRecord.findMany({
      where: {
        tenantId,
        date: businessDateUTC(timezone),
        ...scope,
        employee: SoftDeleteService.whereActive(scope.employee ?? {}),
      },
      include: { employee: { select: { id: true, name: true, departmentId: true } } },
      orderBy: { employee: { name: 'asc' } },
    });
  }

  /** Omit `requester` for tenant-wide aggregates (dashboard stats); HTTP callers always pass it. */
  async summary(tenantId: string, requester?: JwtPayload) {
    const [{ timezone }, scope] = await Promise.all([
      this.getTenantTimeSettings(tenantId),
      this.visibleEmployeeFilter(tenantId, requester),
    ]);
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { tenantId, date: businessDateUTC(timezone), ...scope },
      _count: true,
    });
    return grouped.map((g) => ({ status: g.status, count: g._count }));
  }

  async trend(tenantId: string, days: number, requester: JwtPayload) {
    const [{ timezone }, scope] = await Promise.all([
      this.getTenantTimeSettings(tenantId),
      this.visibleEmployeeFilter(tenantId, requester),
    ]);
    const today = businessDateUTC(timezone);

    const dates: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(d);
    }
    const rangeStart = dates[0];
    const rangeEnd = dates[dates.length - 1];

    const [attendanceGroups, approvedLeaves] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['date', 'status'],
        where: { tenantId, date: { gte: rangeStart, lte: rangeEnd }, ...scope },
        _count: true,
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          ...scope,
          status: 'APPROVED',
          startDate: { lte: rangeEnd },
          endDate: { gte: rangeStart },
        },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
    ]);

    // WFH still counts as "present" for this chart — it's ABSENT/on-leave
    // that "not at work" is tracking, not remote-vs-office.
    const PRESENT_STATUSES = new Set(['PRESENT', 'LATE', 'WFH']);

    return dates.map((date) => {
      const key = date.toISOString().slice(0, 10);
      const present = attendanceGroups
        .filter((g) => g.date.toISOString().slice(0, 10) === key && PRESENT_STATUSES.has(g.status))
        .reduce((sum, g) => sum + g._count, 0);

      // Distinct employees, not raw row count — an employee can't be "more
      // than once" on leave on a given day even if data were ever duplicated.
      const onLeaveEmployeeIds = new Set(
        approvedLeaves
          .filter((l) => l.startDate.getTime() <= date.getTime() && l.endDate.getTime() >= date.getTime())
          .map((l) => l.employeeId),
      );

      return {
        day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        present,
        onLeave: onLeaveEmployeeIds.size,
      };
    });
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

  async upsert(tenantId: string, requester: JwtPayload, dto: UpsertAttendanceDto) {
    await this.employees.assertBelongsToTenant(tenantId, dto.employeeId);
    if (requester.role === 'MANAGER') {
      const self = await this.employees.findByUserId(tenantId, requester.sub);
      const target = await this.prisma.employee.findFirst({
        where: { id: dto.employeeId, tenantId },
        select: { managerId: true },
      });
      if (target?.managerId !== self.id) {
        throw new ForbiddenException('You can only record attendance for your direct reports');
      }
    }

    const date = new Date(dto.date);
    const clockIn = dto.clockIn ? new Date(dto.clockIn) : undefined;
    const clockOut = dto.clockOut ? new Date(dto.clockOut) : undefined;
    let hours = dto.hours;
    if (clockIn && clockOut) {
      if (clockOut.getTime() <= clockIn.getTime()) {
        throw new BadRequestException('clockOut must be after clockIn');
      }
      if (hours === undefined || hours === null) {
        hours = Math.round(((clockOut.getTime() - clockIn.getTime()) / 3_600_000) * 100) / 100;
      }
    }

    return this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: {
        tenantId,
        employeeId: dto.employeeId,
        date,
        status: dto.status,
        clockIn,
        clockOut,
        hours: hours ?? 0,
      },
      update: {
        status: dto.status,
        clockIn,
        clockOut,
        hours: hours ?? undefined,
      },
    });
  }
}
