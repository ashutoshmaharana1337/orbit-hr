import { PartialType } from '@nestjs/mapped-types';
import { CreateLeavePolicyDto } from './create-leave-policy.dto.js';

export class UpdateLeavePolicyDto extends PartialType(CreateLeavePolicyDto) {}
