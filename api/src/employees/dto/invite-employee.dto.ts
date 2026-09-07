import { IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';

export class InviteEmployeeDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
