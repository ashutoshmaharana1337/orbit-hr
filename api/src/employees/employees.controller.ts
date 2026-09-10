import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { ListEmployeesQuery } from './dto/list-employees.query.js';
import { InviteEmployeeDto } from './dto/invite-employee.dto.js';
import { AuthService } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Auditable } from '../audit/auditable.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { BypassTenantRls } from '../prisma/bypass-tenant-rls.decorator.js';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListEmployeesQuery) {
    return this.employees.list(user.tenantId, user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.employees.findOne(user.tenantId, id, user);
  }

  @Post()
  @Roles('ADMIN', 'HR')
  @Auditable({ entityType: 'Employee' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HR')
  @Auditable({ entityType: 'Employee' })
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(user.tenantId, id, dto);
  }

  @Post(':id/invite')
  @Roles('ADMIN', 'HR')
  @BypassTenantRls() // needs to check the invited email for a login in ANY tenant, not just this one
  invite(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: InviteEmployeeDto) {
    return this.auth.invite(user.tenantId, id, dto.role ?? 'EMPLOYEE');
  }

  @Delete(':id')
  @Roles('ADMIN', 'HR')
  @Auditable({ entityType: 'Employee', action: 'DELETE' })
  softDelete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.employees.softDelete(user.tenantId, id);
  }

  @Patch(':id/restore')
  @Roles('ADMIN', 'HR')
  @Auditable({ entityType: 'Employee', action: 'RESTORE' })
  restore(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.employees.restore(user.tenantId, id);
  }

  @Get('deleted/list')
  @Roles('ADMIN', 'HR')
  listDeleted(@CurrentUser() user: JwtPayload) {
    return this.employees.listDeleted(user.tenantId);
  }
}
