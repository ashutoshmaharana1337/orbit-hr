import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  lateCutoffMinutes?: number;
}
