import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateLeavePolicyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  workingDaysPerWeek?: number = 5;

  @IsOptional()
  @IsInt()
  @Min(0)
  publicHolidaysPerYear?: number = 0;

  @IsInt()
  @Min(0)
  entitlementDays!: number;
}
