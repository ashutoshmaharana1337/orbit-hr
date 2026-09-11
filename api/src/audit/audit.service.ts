import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuditAction } from '@prisma/client';

export interface AuditLogEntry {
  tenantId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId?: string;
  userRole?: string;
  beforeValues?: Record<string, unknown>;
  afterValues?: Record<string, unknown>;
  changeDescription?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a write operation to the audit log.
   * This is typically called by the audit interceptor after successful mutations.
   */
  async logWrite(entry: AuditLogEntry) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        userId: entry.userId,
        userRole: entry.userRole,
        beforeValues: entry.beforeValues ? JSON.parse(JSON.stringify(entry.beforeValues)) : null,
        afterValues: entry.afterValues ? JSON.parse(JSON.stringify(entry.afterValues)) : null,
        changeDescription: entry.changeDescription,
      },
    });
  }

  /**
   * Retrieve audit log entries for a specific entity.
   * Includes pagination and filtering.
   */
  async getAuditHistory(
    tenantId: string,
    entityType: string,
    entityId: string,
    limit: number = 100,
    skip: number = 0,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip,
    });
  }

  /**
   * Retrieve all audit logs for a tenant within a date range.
   * Useful for generating audit reports.
   */
  async getTenantAuditHistory(
    tenantId: string,
    filters: {
      entityType?: string;
      userId?: string;
      action?: AuditAction;
      startDate?: Date;
      endDate?: Date;
    },
    limit: number = 100,
    skip: number = 0,
  ) {
    const where: any = { tenantId };

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Safely serialize values to JSON, handling special types like Dates and Decimals.
   * This prevents JSON serialization errors.
   */
  static serializeValues(obj: unknown): Record<string, unknown> | null {
    if (obj === null || obj === undefined) {
      return null;
    }

    try {
      return JSON.parse(
        JSON.stringify(obj, (_key, value) => {
          // Handle Decimal types
          if (value && typeof value === 'object' && 'toJSON' in value) {
            return value.toJSON();
          }
          // Handle Date types
          if (value instanceof Date) {
            return value.toISOString();
          }
          return value;
        }),
      ) as Record<string, unknown>;
    } catch (error) {
      // Fallback: return string representation
      return { _error: `Failed to serialize: ${String(error)}` };
    }
  }

  /**
   * Generate a human-readable change description for common field changes.
   * This helps in quickly understanding what changed without parsing JSON.
   */
  static generateChangeDescription(
    entityType: string,
    action: AuditAction,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ): string | null {
    if (action === 'CREATE') {
      return `Created new ${entityType}`;
    }

    if (action === 'DELETE') {
      return `Deleted ${entityType}`;
    }

    if (action === 'UPDATE' && before && after) {
      const changes: string[] = [];

      // Compare fields and collect changes
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const key of allKeys) {
        if (before[key] !== after[key]) {
          const beforeVal = String(before[key] ?? 'null').substring(0, 20);
          const afterVal = String(after[key] ?? 'null').substring(0, 20);
          changes.push(`${key}: ${beforeVal} → ${afterVal}`);
        }
      }

      if (changes.length > 0) {
        const changeStr = changes.slice(0, 3).join('; ');
        return changes.length > 3 ? `${changeStr}... (and ${changes.length - 3} more)` : changeStr;
      }
    }

    return null;
  }
}
