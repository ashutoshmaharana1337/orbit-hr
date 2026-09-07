import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service.js';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';

@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get('settings')
  settings(@CurrentUser() user: JwtPayload) {
    return this.tenant.settings(user.tenantId);
  }

  @Patch('settings')
  @Roles('ADMIN')
  updateSettings(@CurrentUser() user: JwtPayload, @Body() dto: UpdateTenantSettingsDto) {
    return this.tenant.updateSettings(user.tenantId, dto);
  }
}
