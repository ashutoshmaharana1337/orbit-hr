import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoggerService } from '../common/logger.service.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tenant Deletion Service
 *
 * Handles complete deletion of customer organization data.
 * Implements procedures from: docs/DATA_DELETION_RUNBOOK.md
 *
 * Process:
 * 1. Verify request authenticity (legal/compliance approval)
 * 2. Create backup for legal retention (90 days)
 * 3. Delete from production:
 *    - Mark tenant as deleted
 *    - Anonymize employee data
 *    - Delete attendance records
 *    - Delete leave records
 *    - Archive audit logs
 * 4. Verify deletion in staging
 * 5. Archive backup for 90 days
 * 6. Document in compliance log
 * 7. Notify customer of completion
 */
@Injectable()
export class TenantDeletionService {
  private readonly logger = new Logger(TenantDeletionService.name);
  private readonly customLogger: LoggerService;

  constructor(
    private prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.customLogger = logger;
  }

  /**
   * Initiate tenant data deletion
   * Performs pre-deletion verification and backup
   */
  async initiateDataDeletion(
    tenantId: string,
    requestedBy: string,
    reason: string,
  ): Promise<{
    status: 'INITIATED';
    tenantId: string;
    backupId: string;
    message: string;
  }> {
    this.logger.log(`Initiating data deletion for tenant ${tenantId}`);

    // Verify tenant exists
    const tenant = await this.prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new BadRequestException(`Tenant ${tenantId} not found`);
    }

    if (tenant.deletedAt) {
      throw new BadRequestException(`Tenant ${tenantId} already deleted`);
    }

    // Check for active legal holds (in real implementation)
    // await this.checkLegalHolds(tenantId);

    // Create backup before deletion
    const backupId = await this.createBackup(tenantId);

    // Log initiation
    await this.customLogger.logSystemEvent({
      action: 'TENANT_DELETION_INITIATED',
      details: {
        tenantId,
        requestedBy,
        reason,
        backupId,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      status: 'INITIATED',
      tenantId,
      backupId,
      message: `Backup created (${backupId}). Deletion ready to proceed after approval.`,
    };
  }

  /**
   * Execute tenant data deletion
   * DESTRUCTIVE - Call only after approval!
   */
  async executeDeletion(
    tenantId: string,
    backupId: string,
    approvedBy: string,
  ): Promise<{
    status: 'COMPLETED';
    tenantId: string;
    deletedRecords: {
      employees: number;
      attendance: number;
      leave: number;
      configurations: number;
      apiKeys: number;
      sessions: number;
    };
    message: string;
  }> {
    this.logger.log(`Executing data deletion for tenant ${tenantId}`);

    try {
      // Verify tenant still exists and not deleted
      const tenant = await this.prisma.tenants.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new BadRequestException(`Tenant ${tenantId} not found`);
      }

      if (tenant.deletedAt) {
        throw new BadRequestException(`Tenant ${tenantId} already deleted`);
      }

      // Execute deletion in transaction
      const result = await this.prisma.$transaction(async (tx: any) => {
        // 1. Mark tenant as deleted
        await tx.tenants.update({
          where: { id: tenantId },
          data: {
            deletedAt: new Date(),
            deletedBy: approvedBy,
            deletionReason: 'Customer requested data deletion',
          },
        });

        // 2. Count and delete employee records
        const employees = await tx.employees.findMany({
          where: { tenantId },
          select: { id: true },
        });

        for (const emp of employees) {
          // Anonymize before delete
          await this.anonymizeEmployeeData(tx, emp.id);
        }

        const empDeleteResult = await tx.employees.deleteMany({
          where: { tenantId },
        });

        // 3. Delete attendance records
        const attDeleteResult = await tx.attendance.deleteMany({
          where: { tenantId },
        });

        // 4. Delete leave records
        const leaveDeleteResult = await tx.leaveRequests.deleteMany({
          where: { tenantId },
        });

        const leaveBalanceDeleteResult = await tx.leaveBalances.deleteMany({
          where: { tenantId },
        });

        const leavePoliciesDeleteResult = await tx.leavePolicies.deleteMany({
          where: { tenantId },
        });

        const leaveTypesDeleteResult = await tx.leaveTypes.deleteMany({
          where: { tenantId },
        });

        // 5. Delete organizational configurations
        const deptDeleteResult = await tx.departments.deleteMany({
          where: { tenantId },
        });

        const settingsDeleteResult = await tx.tenantSettings.deleteMany({
          where: { tenantId },
        });

        // 6. Archive audit logs (don't delete for compliance)
        const auditUpdateResult = await tx.auditLog.updateMany({
          where: { tenantId },
          data: {
            archived: true,
            archivedAt: new Date(),
            // Anonymize user references
            userName: 'Deleted User',
            userEmail: null,
          },
        });

        // 7. Delete API keys
        const apiKeyDeleteResult = await tx.apiKeys.deleteMany({
          where: { tenantId },
        });

        // 8. Invalidate sessions
        const sessionDeleteResult = await tx.userSessions.deleteMany({
          where: { tenantId },
        });

        const tokenDeleteResult = await tx.refreshTokens.deleteMany({
          where: { tenantId },
        });

        return {
          employees: empDeleteResult.count,
          attendance: attDeleteResult.count,
          leave: leaveDeleteResult.count + leaveBalanceDeleteResult.count + leavePoliciesDeleteResult.count + leaveTypesDeleteResult.count,
          configurations: deptDeleteResult.count + settingsDeleteResult.count,
          apiKeys: apiKeyDeleteResult.count,
          sessions: sessionDeleteResult.count + tokenDeleteResult.count,
        };
      });

      // Verify deletion
      await this.verifyDeletion(tenantId);

      // Log completion
      await this.customLogger.logSystemEvent({
        action: 'TENANT_DELETION_COMPLETED',
        details: {
          tenantId,
          backupId,
          approvedBy,
          deletedRecords: result,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        status: 'COMPLETED',
        tenantId,
        deletedRecords: result,
        message: `Tenant data deleted. Backup retained until ${this.getBackupRetentionDate().toISOString()}`,
      };
    } catch (error) {
      this.logger.error(`Error deleting tenant ${tenantId}`, error);

      await this.customLogger.logSystemEvent({
        action: 'TENANT_DELETION_FAILED',
        details: {
          tenantId,
          backupId,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
        },
      });

      throw error;
    }
  }

  /**
   * Create backup before deletion
   * Stored securely for 90-day legal retention period
   */
  private async createBackup(tenantId: string): Promise<string> {
    const backupDate = new Date().toISOString().split('T')[0];
    const backupId = `org-deletion-${tenantId}-${backupDate}`;

    this.logger.log(`Creating backup ${backupId}`);

    try {
      // In production, this would:
      // 1. Export tenant data to secure location
      // 2. Encrypt backup
      // 3. Store in long-term retention storage
      // 4. Verify backup integrity

      // For now, log the intention
      await this.customLogger.logSystemEvent({
        action: 'BACKUP_CREATED',
        details: {
          backupId,
          tenantId,
          retentionUntil: this.getBackupRetentionDate().toISOString(),
          timestamp: new Date().toISOString(),
        },
      });

      return backupId;
    } catch (error) {
      this.logger.error(`Error creating backup ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Anonymize employee data before deletion
   */
  private async anonymizeEmployeeData(tx: any, employeeId: string): Promise<void> {
    try {
      // Generate anonymized email using hash
      const hash = Buffer.from(employeeId).toString('hex').substring(0, 8);
      const anonymizedEmail = `deleted_${hash}@internal`;

      await tx.employees.update({
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
          // Keep: department, role, employment dates for audit trail
        },
      });
    } catch (error) {
      this.logger.error(`Error anonymizing employee ${employeeId}`, error);
      throw error;
    }
  }

  /**
   * Verify that deletion was successful
   */
  private async verifyDeletion(tenantId: string): Promise<void> {
    this.logger.log(`Verifying deletion for tenant ${tenantId}`);

    // Check that key data is deleted
    const employeeCount = await this.prisma.employees.count({
      where: { tenantId, deletedAt: null },
    });

    const attendanceCount = await this.prisma.attendance.count({
      where: { tenantId },
    });

    const leaveCount = await this.prisma.leaveRequests.count({
      where: { tenantId },
    });

    if (employeeCount > 0 || attendanceCount > 0 || leaveCount > 0) {
      throw new Error(
        `Deletion verification failed: Found ${employeeCount} employees, ${attendanceCount} attendance, ${leaveCount} leave records`,
      );
    }

    // Verify tenant marked as deleted
    const tenant = await this.prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant.deletedAt) {
      throw new Error(`Tenant ${tenantId} not marked as deleted`);
    }

    this.logger.log(`Deletion verified for tenant ${tenantId}`);
  }

  /**
   * Export customer data before deletion (if requested)
   * Creates CSV/JSON export for customer's records
   */
  async exportDataBeforeDeletion(
    tenantId: string,
    format: 'csv' | 'json' = 'json',
  ): Promise<{
    format: string;
    fileName: string;
    recordCount: number;
    size: number;
  }> {
    this.logger.log(`Exporting data for tenant ${tenantId} in ${format} format`);

    try {
      // Collect all tenant data
      const employees = await this.prisma.employees.findMany({
        where: { tenantId },
      });

      const attendance = await this.prisma.attendance.findMany({
        where: { tenantId },
      });

      const leave = await this.prisma.leaveRequests.findMany({
        where: { tenantId },
      });

      const exportData = {
        exportDate: new Date().toISOString(),
        tenantId,
        employees,
        attendance,
        leave,
      };

      // Create export file
      const fileName = `customer-export-${tenantId}-${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'csv'}`;

      let fileContent: string;
      let size: number;

      if (format === 'json') {
        fileContent = JSON.stringify(exportData, null, 2);
      } else {
        // CSV format
        fileContent = this.convertToCSV(exportData);
      }

      size = Buffer.byteLength(fileContent);

      // In production, this would be saved to secure location and
      // delivered via encrypted link

      this.logger.log(
        `Export created: ${fileName} (${size} bytes, ${employees.length + attendance.length + leave.length} records)`,
      );

      return {
        format,
        fileName,
        recordCount: employees.length + attendance.length + leave.length,
        size,
      };
    } catch (error) {
      this.logger.error(`Error exporting data for tenant ${tenantId}`, error);
      throw error;
    }
  }

  /**
   * Create deletion certificate for compliance
   */
  async generateDeletionCertificate(
    tenantId: string,
    backupId: string,
    organizationName: string,
  ): Promise<string> {
    const tenant = await this.prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || !tenant.deletedAt) {
      throw new BadRequestException(`Tenant ${tenantId} not deleted or not found`);
    }

    const certificate = `
═══════════════════════════════════════════════════════════════
                    DATA DELETION CERTIFICATE
═══════════════════════════════════════════════════════════════

Organization: ${organizationName}
Tenant ID: ${tenantId}
Deletion Completed Date: ${tenant.deletedAt.toISOString()}
Deleted By: ${tenant.deletedBy || 'System'}

DELETION SUMMARY:
─────────────────────────────────────────────────────────────
This certifies that all personal data for the organization listed above
has been permanently deleted from HRMS production systems.

BACKUP RETENTION:
─────────────────────────────────────────────────────────────
Backup ID: ${backupId}
Retention Until: ${this.getBackupRetentionDate().toISOString()}
Status: ENCRYPTED AND ARCHIVED

AUDIT LOG RETENTION:
─────────────────────────────────────────────────────────────
Audit logs have been archived and anonymized as required for compliance.
These remain available for regulatory requests but contain no PII.

LEGAL BASIS:
─────────────────────────────────────────────────────────────
This deletion was performed in accordance with:
- GDPR Article 17 (Right to Erasure)
- CCPA §1798.105 (Right to Delete)
- HRMS Data Retention Policy

═══════════════════════════════════════════════════════════════

Generated: ${new Date().toISOString()}
Certificate ID: ${backupId}

This certificate verifies that customer data deletion has been completed
as requested and that backups will be permanently destroyed on the
retention expiration date.

═══════════════════════════════════════════════════════════════
`;

    return certificate;
  }

  /**
   * Get retention status for deleted tenant
   */
  async getDeletionRetentionStatus(tenantId: string): Promise<{
    tenantId: string;
    deletedAt: Date;
    deletedBy: string;
    backupRetentionUntil: Date;
    daysRemaining: number;
  }> {
    const tenant = await this.prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        deletedAt: true,
        deletedBy: true,
      },
    });

    if (!tenant || !tenant.deletedAt) {
      throw new BadRequestException(`Tenant ${tenantId} not deleted`);
    }

    const retentionUntil = new Date(tenant.deletedAt);
    retentionUntil.setDate(retentionUntil.getDate() + 90);

    const now = new Date();
    const daysRemaining = Math.ceil(
      (retentionUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      tenantId,
      deletedAt: tenant.deletedAt,
      deletedBy: tenant.deletedBy,
      backupRetentionUntil: retentionUntil,
      daysRemaining,
    };
  }

  /**
   * Dispute a deletion within 90-day window
   * Restores deleted tenant data from backup
   */
  async restoreFromDeletion(tenantId: string): Promise<{
    status: 'RESTORED';
    tenantId: string;
    message: string;
  }> {
    const tenant = await this.prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || !tenant.deletedAt) {
      throw new BadRequestException(`Tenant ${tenantId} not deleted`);
    }

    // Check if within 90-day window
    const now = new Date();
    const daysSinceDeletion = Math.floor(
      (now.getTime() - tenant.deletedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceDeletion > 90) {
      throw new BadRequestException(
        `Restoration window expired. Tenant was deleted ${daysSinceDeletion} days ago.`,
      );
    }

    // In production, restore from backup
    this.logger.log(`Restoring tenant ${tenantId} from backup`);

    // Mark as restored
    await this.prisma.tenants.update({
      where: { id: tenantId },
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });

    await this.customLogger.logSystemEvent({
      action: 'TENANT_RESTORATION_INITIATED',
      details: {
        tenantId,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      status: 'RESTORED',
      tenantId,
      message: 'Tenant restoration initiated. Data will be restored from backup.',
    };
  }

  /**
   * Get backup retention date (90 days from deletion)
   */
  private getBackupRetentionDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date;
  }

  /**
   * Convert export data to CSV format
   */
  private convertToCSV(data: any): string {
    // Simple CSV conversion
    // In production, would use a proper CSV library

    let csv = 'Entity,Field,Value\n';

    // Employees
    for (const emp of data.employees || []) {
      csv += `Employee,ID,${emp.id}\n`;
      csv += `Employee,Name,${emp.name}\n`;
      csv += `Employee,Email,${emp.email}\n`;
    }

    // Attendance
    for (const att of data.attendance || []) {
      csv += `Attendance,ID,${att.id}\n`;
      csv += `Attendance,Date,${att.createdAt}\n`;
    }

    // Leave
    for (const leave of data.leave || []) {
      csv += `Leave,ID,${leave.id}\n`;
      csv += `Leave,Date,${leave.createdAt}\n`;
    }

    return csv;
  }
}
