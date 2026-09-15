import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoftDeleteService } from '../common/soft-delete.service.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { businessDateUTC } from '../attendance/business-time.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
  ) {}

  async stats(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const today = businessDateUTC(tenant.timezone);

    const [totalEmployees, activeEmployeeCount, onLeaveRows, pendingLeaveRequests, headcountGroups, attendanceSummary] =
      await Promise.all([
        this.prisma.employee.count({ where: SoftDeleteService.whereActive({ tenantId }) }),
        this.prisma.employee.count({
          where: SoftDeleteService.whereActive({ tenantId, status: 'ACTIVE' }),
        }),
        this.prisma.leaveRequest.findMany({
          where: {
            tenantId,
            status: 'APPROVED',
            startDate: { lte: today },
            endDate: { gte: today },
            employee: SoftDeleteService.whereActive({}),
          },
          select: { employeeId: true },
          distinct: ['employeeId'],
        }),
        this.prisma.leaveRequest.count({
          where: {
            tenantId,
            status: 'PENDING',
            employee: SoftDeleteService.whereActive({}),
          },
        }),
        this.prisma.employee.groupBy({
          by: ['departmentId'],
          where: SoftDeleteService.whereActive({ tenantId }),
          _count: true,
        }),
        this.attendance.summary(tenantId),
      ]);

    const presentCount = attendanceSummary
      .filter((s) => s.status === 'PRESENT' || s.status === 'LATE')
      .reduce((sum, s) => sum + s.count, 0);
    const attendanceRate = activeEmployeeCount === 0 ? 0 : Math.round((presentCount / activeEmployeeCount) * 100);

    return {
      totalEmployees,
      onLeaveToday: onLeaveRows.length,
      pendingLeaveRequests,
      attendanceRate,
      headcountByDepartment: headcountGroups.map((g) => ({ departmentId: g.departmentId, count: g._count })),
    };
  }
}
