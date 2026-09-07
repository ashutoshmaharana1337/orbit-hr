import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HR')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(user.tenantId, id, dto);
  }

  @Post(':id/invite')
  @Roles('ADMIN', 'HR')
  @BypassTenantRls() // needs to check the invited email for a login in ANY tenant, not just this one
  invite(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: InviteEmployeeDto) {
    return this.auth.invite(user.tenantId, id, dto.role ?? 'EMPLOYEE');
  }
}
