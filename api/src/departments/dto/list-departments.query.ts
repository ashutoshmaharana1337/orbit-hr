import { IsOptional, IsString, Min, Max, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ListDepartmentsQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
