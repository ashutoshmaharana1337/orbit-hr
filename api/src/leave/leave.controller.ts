import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LeaveService } from './leave.service.js';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import { ListLeaveQuery } from './dto/list-leave.query.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';

@Controller('leave')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListLeaveQuery) {
    return this.leave.list(user.tenantId, query);
  }

  @Get('balance/:employeeId')
  balance(@CurrentUser() user: JwtPayload, @Param('employeeId') employeeId: string) {
    return this.leave.balance(user.tenantId, employeeId);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLeaveRequestDto) {
    return this.leave.create(user.tenantId, user.sub, dto);
  }

  @Patch(':id/approve')
  @Roles('ADMIN', 'HR', 'MANAGER')
  approve(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.leave.decide(user.tenantId, id, user.sub, true);
  }

  @Patch(':id/reject')
  @Roles('ADMIN', 'HR', 'MANAGER')
  reject(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.leave.decide(user.tenantId, id, user.sub, false);
  }
}
