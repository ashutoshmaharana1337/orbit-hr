import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LeavePolicesService } from './leave-policies.service.js';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto.js';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto.js';
import { ListLeavePoliciesQuery } from './dto/list-leave-policies.query.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';

@Controller('leave-policies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeavePolicesController {
  constructor(private readonly leavePolicies: LeavePolicesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.leavePolicies.list(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.leavePolicies.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'HR')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLeavePolicyDto) {
    return this.leavePolicies.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HR')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateLeavePolicyDto) {
    return this.leavePolicies.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'HR')
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.leavePolicies.delete(user.tenantId, id);
  }
}
