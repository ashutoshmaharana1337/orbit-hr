import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { ListDepartmentsQuery } from './dto/list-departments.query.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListDepartmentsQuery) {
    return this.departments.list(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.departments.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'HR')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HR')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'HR')
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.departments.delete(user.tenantId, id);
  }
}
