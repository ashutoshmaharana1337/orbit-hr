import { SetMetadata } from '@nestjs/common';
import type { AuditAction } from '@prisma/client';

export interface AuditableOptions {
  entityType: string; // e.g., "Employee", "LeaveRequest"
  action?: AuditAction | 'RESTORE'; // Optional: override action inference from HTTP method; RESTORE is custom action
  extractEntityId?: (request: any, response: any) => string | null; // Optional custom extractor
}

export const AUDITABLE_KEY = 'auditable';

/**
 * Decorator to mark a controller method as auditable.
 * The audit interceptor will automatically log changes to these endpoints.
 *
 * @example
 * @Auditable({ entityType: 'Employee' })
 * @Post()
 * create(@Body() dto: CreateEmployeeDto) { ... }
 *
 * @example
 * @Auditable({ entityType: 'Employee', action: 'DELETE' })
 * @Delete(':id')
 * softDelete(@Param('id') id: string) { ... }
 */
export const Auditable = (options: AuditableOptions) => SetMetadata(AUDITABLE_KEY, options);
