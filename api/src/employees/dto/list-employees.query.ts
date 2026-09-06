import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class ListEmployeesQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}
