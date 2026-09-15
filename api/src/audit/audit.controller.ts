import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuditService } from './audit.service.js';
import type { JwtPayload } from '../auth/auth.types.js';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /**
   * GET /audit?entityType=Employee&entityId=uuid&limit=100
   * Retrieve audit history for a specific entity.
   * Only ADMIN and HR can access this endpoint.
   */
  @Get('history')
  @Roles('ADMIN', 'HR')
  async getHistory(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limitStr?: string,
    @Query('skip') skipStr?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!entityType || !entityId) {
      throw new ForbiddenException('entityType and entityId query parameters are required');
    }

    const limit = Math.min(parseInt(limitStr || '100'), 500); // Max 500 per request
    const skip = parseInt(skipStr || '0');

    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    return this.audit.getAuditHistory(user.tenantId, entityType, entityId, limit, skip);
  }

  /**
   * GET /audit/tenant?entityType=Employee&userId=uuid&action=CREATE&limit=100
   * Retrieve all audit logs for a tenant with optional filters.
   * Only ADMIN and HR can access this endpoint.
   */
  @Get('tenant')
  @Roles('ADMIN', 'HR')
  async getTenantHistory(
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: 'CREATE' | 'UPDATE' | 'DELETE',
    @Query('limit') limitStr?: string,
    @Query('skip') skipStr?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const limit = Math.min(parseInt(limitStr || '100'), 500); // Max 500 per request
    const skip = parseInt(skipStr || '0');

    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    const { logs, total } = await this.audit.getTenantAuditHistory(
      user.tenantId,
      {
        entityType: entityType || undefined,
        userId: userId || undefined,
        action: action || undefined,
      },
      limit,
      skip,
    );

    return { logs, total, limit, skip };
  }
}
