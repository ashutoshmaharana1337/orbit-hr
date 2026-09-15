import { Module } from '@nestjs/common';
import { LeavePolicesService } from './leave-policies.service.js';
import { LeavePolicesController } from './leave-policies.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [LeavePolicesController],
  providers: [LeavePolicesService],
  exports: [LeavePolicesService],
})
export class LeavePolicesModule {}
