import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '@prisma/client';

/**
 * Service for handling soft deletes across the application.
 * Soft deletes work by setting a deletedAt timestamp instead of removing records.
 * This allows for recovery, audit trails, and prevents foreign key conflicts.
 */
@Injectable()
export class SoftDeleteService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Soft-delete an Employee by setting its deletedAt timestamp.
   * Verifies the employee belongs to the tenant before deleting.
   */
  async softDeleteEmployee(tenantId: string, employeeId: string) {
    // Verify employee belongs to this tenant
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft-deleted Employee by clearing its deletedAt timestamp.
   */
  async restoreEmployee(tenantId: string, employeeId: string) {
    // Verify employee belongs to this tenant
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { id: true, deletedAt: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee.deletedAt) {
      throw new Error('Employee is not soft-deleted');
    }

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { deletedAt: null },
    });
  }

  /**
   * Helper function to build a "active records only" filter for employee queries.
   * Returns a Prisma where condition that excludes soft-deleted records.
   *
   * Usage:
   *   const where = this.softDelete.whereActive({ tenantId: '123' });
   *   const employees = await this.prisma.employee.findMany({ where });
   */
  static whereActive(baseWhere: Record<string, any> = {}): Record<string, any> {
    return {
      ...baseWhere,
      deletedAt: null,
    };
  }

  /**
   * Helper function to build a "deleted records only" filter for employee queries.
   * Returns a Prisma where condition that includes only soft-deleted records.
   *
   * Usage:
   *   const where = this.softDelete.whereDeleted({ tenantId: '123' });
   *   const deletedEmployees = await this.prisma.employee.findMany({ where });
   */
  static whereDeleted(baseWhere: Record<string, any> = {}): Record<string, any> {
    return {
      ...baseWhere,
      deletedAt: { not: null },
    };
  }
}
