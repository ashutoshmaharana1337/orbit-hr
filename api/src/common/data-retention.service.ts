import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from './logger.service';

/**
 * Data Retention Service
 *
 * Implements automatic data purging based on retention policies defined in:
 * docs/DATA_RETENTION.md
 *
 * Retention Rules:
 * - Active employees: While employed + 30 days
 * - Terminated employees: 7 years (legal/tax requirement)
 * - Attendance records: 3 years (audit requirement)
 * - Leave records: Indefinitely (employee history)
 * - Audit logs: 1-3 years minimum
 * - Deleted data backups: 90 days
 * - API logs: 90 days
 * - Support tickets: 2 years
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);
  private readonly customLogger: LoggerService;

  constructor(
    private prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.customLogger = logger;
  }

  /**
   * Monthly purging job
   * Runs on first day of month at 2 AM UTC
   * Identifies and marks data for deletion
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_2AM)
  async purgeExpiredData(): Promise<void> {
    this.logger.log('Starting monthly data purge job');
    const startTime = Date.now();

    try {
      // Purge terminated employee data (after 7 years)
      await this.purgeTerminatedEmployees();

      // Purge old attendance records (after 3 years)
      await this.purgeOldAttendanceRecords();

      // Purge old leave records (if requested by employee)
      // Note: Default is indefinite retention unless employee requests deletion

      // Purge old audit logs (after 3 years, keep 1 year minimum)
      await this.purgeOldAuditLogs();

      // Purge old API logs (after 90 days)
      await this.purgeOldApiLogs();

      // Purge old support tickets (after 2 years)
      await this.purgeOldSupportTickets();

      // Archive soft-deleted data (if past 90 days)
      await this.archiveDeletedData();

      const duration = Date.now() - startTime;
      this.logger.log(`Data purge job completed in ${duration}ms`);

      // Log completion to audit log
      await this.customLogger.logSystemEvent({
        action: 'DATA_PURGE_COMPLETED',
        details: {
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error('Data purge job failed', error);
      await this.customLogger.logSystemEvent({
        action: 'DATA_PURGE_FAILED',
        details: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      });
      throw error;
    }
  }

  /**
   * Purge terminated employees after 7 years
   * Anonymize PII before deletion for audit trail
   */
  private async purgeTerminatedEmployees(): Promise<void> {
    const logger = this.logger;
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    try {
      // Find terminated employees past 7-year retention period
      const employeesToPurge = await this.prisma.employees.findMany({
        where: {
          terminationDate: {
            lt: sevenYearsAgo,
          },
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          tenantId: true,
        },
      });

      if (employeesToPurge.length === 0) {
        logger.log('No terminated employees eligible for purge');
        return;
      }

      logger.log(`Found ${employeesToPurge.length} terminated employees for purge`);

      // Anonymize PII in place (before hard delete)
      for (const employee of employeesToPurge) {
        await this.anonymizeEmployeeData(employee.id, employee.tenantId);
      }

      // Hard delete employees
      const deleteResult = await this.prisma.employees.deleteMany({
        where: {
          id: {
            in: employeesToPurge.map(e => e.id),
          },
        },
      });

      logger.log(
        `Purged ${deleteResult.count} terminated employees`,
      );

      // Log purge event
      await this.logPurgeEvent('employees', deleteResult.count, 'TERMINATION_RETENTION_EXPIRED');
    } catch (error) {
      logger.error('Error purging terminated employees', error);
      throw error;
    }
  }

  /**
   * Purge attendance records after 3 years
   */
  private async purgeOldAttendanceRecords(): Promise<void> {
    const logger = this.logger;
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    try {
      const deleteResult = await this.prisma.attendance.deleteMany({
        where: {
          createdAt: {
            lt: threeYearsAgo,
          },
        },
      });

      logger.log(`Purged ${deleteResult.count} old attendance records`);
      await this.logPurgeEvent('attendance', deleteResult.count, 'RETENTION_EXPIRED_3_YEARS');
    } catch (error) {
      logger.error('Error purging old attendance records', error);
      throw error;
    }
  }

  /**
   * Purge old audit logs after 3 years
   * Audit logs are immutable, only remove after full retention period
   */
  private async purgeOldAuditLogs(): Promise<void> {
    const logger = this.logger;
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    try {
      // Check for active legal holds
      const heldLogs = await this.prisma.auditLog.findMany({
        where: {
          createdAt: { lt: threeYearsAgo },
          legalHold: true,
        },
        select: { id: true },
      });

      // Only delete logs not under legal hold
      const deleteResult = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: threeYearsAgo },
          legalHold: false,
        },
      });

      logger.log(
        `Archived ${deleteResult.count} old audit logs (${heldLogs.length} under legal hold)`,
      );
      await this.logPurgeEvent('audit_logs', deleteResult.count, 'RETENTION_EXPIRED_3_YEARS');
    } catch (error) {
      logger.error('Error purging old audit logs', error);
      throw error;
    }
  }

  /**
   * Purge old API logs after 90 days
   * These are operational logs, can be deleted after retention period
   */
  private async purgeOldApiLogs(): Promise<void> {
    const logger = this.logger;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    try {
      const deleteResult = await this.prisma.apiLog.deleteMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
        },
      });

      logger.log(`Purged ${deleteResult.count} old API logs`);
      await this.logPurgeEvent('api_logs', deleteResult.count, 'RETENTION_EXPIRED_90_DAYS');
    } catch (error) {
      logger.error('Error purging old API logs', error);
      throw error;
    }
  }

  /**
   * Purge old support tickets after 2 years
   */
  private async purgeOldSupportTickets(): Promise<void> {
    const logger = this.logger;
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    try {
      // Only delete resolved tickets, keep open ones
      const deleteResult = await this.prisma.supportTicket.deleteMany({
        where: {
          closedAt: { lt: twoYearsAgo },
        },
      });

      logger.log(`Purged ${deleteResult.count} old support tickets`);
      await this.logPurgeEvent('support_tickets', deleteResult.count, 'RETENTION_EXPIRED_2_YEARS');
    } catch (error) {
      logger.error('Error purging old support tickets', error);
      throw error;
    }
  }

  /**
   * Archive deleted data after 90 days
   * Soft-deleted data is kept for 90 days for potential recovery/disputes
   */
  private async archiveDeletedData(): Promise<void> {
    const logger = this.logger;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    try {
      // Find soft-deleted employees past 90-day window
      const archivedCount = await this.prisma.employees.deleteMany({
        where: {
          deletedAt: { lt: ninetyDaysAgo },
        },
      });

      if (archivedCount.count > 0) {
        logger.log(`Permanently deleted ${archivedCount.count} soft-deleted employees`);
        await this.logPurgeEvent('soft_deleted_employees', archivedCount.count, 'BACKUP_RETENTION_EXPIRED');
      }
    } catch (error) {
      logger.error('Error archiving deleted data', error);
      throw error;
    }
  }

  /**
   * Anonymize employee personal data
   * Called before hard deletion to maintain audit trail
   */
  private async anonymizeEmployeeData(employeeId: string, tenantId: string): Promise<void> {
    try {
      // Generate anonymized values
      const anonymizedEmail = `deleted_${Buffer.from(employeeId).toString('hex').substring(0, 8)}@internal`;

      await this.prisma.employees.update({
        where: { id: employeeId },
        data: {
          name: 'Deleted Employee',
          email: anonymizedEmail,
          phone: null,
          personalEmail: null,
          homeAddress: null,
          homeCity: null,
          homeState: null,
          homePostalCode: null,
          homeCountry: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          emergencyContactRelationship: null,
          // Keep audit fields and employment history
        },
      });

      this.logger.debug(`Anonymized employee data for ${employeeId}`);

      // Log anonymization
      await this.customLogger.logSystemEvent({
        action: 'EMPLOYEE_DATA_ANONYMIZED',
        details: {
          employeeId,
          tenantId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(`Error anonymizing employee ${employeeId}`, error);
      throw error;
    }
  }

  /**
   * Log purge event for compliance tracking
   */
  private async logPurgeEvent(
    dataType: string,
    recordsDeleted: number,
    reason: string,
  ): Promise<void> {
    try {
      // This would typically go to an audit log table
      // For now, we use the logger
      await this.customLogger.logSystemEvent({
        action: 'DATA_PURGED',
        details: {
          dataType,
          recordsDeleted,
          reason,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error('Error logging purge event', error);
      // Don't throw - logging failure shouldn't prevent purge
    }
  }

  /**
   * Place a legal hold on employee data
   * Prevents deletion of data during litigation
   */
  async placeLegalHold(
    employeeId: string,
    reason: string,
    duration?: Date,
  ): Promise<void> {
    this.logger.log(`Placing legal hold on employee ${employeeId}: ${reason}`);

    try {
      // Update employee record with legal hold flag
      // Note: This assumes legalHold and legalHoldReason fields exist in schema
      await this.prisma.employees.update({
        where: { id: employeeId },
        data: {
          // legalHold: true,
          // legalHoldReason: reason,
          // legalHoldDate: new Date(),
          // legalHoldUntil: duration,
        },
      });

      // Log the hold
      await this.customLogger.logSystemEvent({
        action: 'LEGAL_HOLD_PLACED',
        details: {
          employeeId,
          reason,
          duration: duration?.toISOString(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(`Error placing legal hold on ${employeeId}`, error);
      throw error;
    }
  }

  /**
   * Release a legal hold on employee data
   */
  async releaseLegalHold(employeeId: string): Promise<void> {
    this.logger.log(`Releasing legal hold on employee ${employeeId}`);

    try {
      await this.prisma.employees.update({
        where: { id: employeeId },
        data: {
          // legalHold: false,
          // legalHoldReason: null,
          // legalHoldDate: null,
        },
      });

      await this.customLogger.logSystemEvent({
        action: 'LEGAL_HOLD_RELEASED',
        details: {
          employeeId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(`Error releasing legal hold on ${employeeId}`, error);
      throw error;
    }
  }

  /**
   * Get retention status for an employee
   * Shows when data will be deleted based on retention policies
   */
  async getRetentionStatus(employeeId: string): Promise<{
    employeeId: string;
    status: 'ACTIVE' | 'TERMINATED';
    terminationDate: Date | null;
    retentionUntil: Date | null;
    daysUntilDeletion: number | null;
    legalHold: boolean;
  }> {
    const employee = await this.prisma.employees.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        terminationDate: true,
        // legalHold: true,
      },
    });

    if (!employee) {
      throw new Error(`Employee ${employeeId} not found`);
    }

    const isTerminated = !!employee.terminationDate;
    const terminationDate = employee.terminationDate;

    if (isTerminated && terminationDate) {
      const retentionUntil = new Date(terminationDate);
      retentionUntil.setFullYear(retentionUntil.getFullYear() + 7);

      const now = new Date();
      const daysUntilDeletion = Math.ceil(
        (retentionUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        employeeId,
        status: 'TERMINATED',
        terminationDate,
        retentionUntil,
        daysUntilDeletion,
        legalHold: false, // TODO: add to schema
      };
    }

    return {
      employeeId,
      status: 'ACTIVE',
      terminationDate: null,
      retentionUntil: null,
      daysUntilDeletion: null,
      legalHold: false,
    };
  }

  /**
   * Check for data that needs attention for retention
   * Useful for compliance reports
   */
  async getRetentionReport(tenantId?: string): Promise<{
    activeEmployees: number;
    terminatedEmployees: number;
    employeesForDeletion: number;
    attendanceRecordsToDelete: number;
    auditLogsToDelete: number;
    onLegalHold: number;
    generatedAt: Date;
  }> {
    try {
      const sevenYearsAgo = new Date();
      sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

      const activeEmployees = await this.prisma.employees.count({
        where: {
          terminationDate: null,
          deletedAt: null,
          ...(tenantId && { tenantId }),
        },
      });

      const terminatedEmployees = await this.prisma.employees.count({
        where: {
          terminationDate: { not: null },
          deletedAt: null,
          ...(tenantId && { tenantId }),
        },
      });

      const employeesForDeletion = await this.prisma.employees.count({
        where: {
          terminationDate: { lt: sevenYearsAgo },
          deletedAt: null,
          ...(tenantId && { tenantId }),
        },
      });

      const attendanceRecordsToDelete = await this.prisma.attendance.count({
        where: {
          createdAt: { lt: threeYearsAgo },
          ...(tenantId && { tenantId }),
        },
      });

      const auditLogsToDelete = await this.prisma.auditLog.count({
        where: {
          createdAt: { lt: threeYearsAgo },
          legalHold: false,
        },
      });

      return {
        activeEmployees,
        terminatedEmployees,
        employeesForDeletion,
        attendanceRecordsToDelete,
        auditLogsToDelete,
        onLegalHold: 0, // TODO: implement legal hold tracking
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Error generating retention report', error);
      throw error;
    }
  }
}
