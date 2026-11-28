import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../../database/database.module';
import { AdminAuthModule } from '../admin_auth/admin_auth.module';
import { AdminJwtAuthGuard } from '../admin_auth/admin-jwt-auth.guard';

import { AdminGovernanceController } from './admin_governance.controller';
import { AdminGovernanceService } from './admin_governance.service';

@Module({
  imports: [
    DatabaseModule,
    AdminAuthModule,
    JwtModule.register({}),
  ],
  controllers: [AdminGovernanceController],
  providers: [
    AdminGovernanceService,
    AdminJwtAuthGuard,
  ],
  exports: [AdminGovernanceService],
})
export class AdminGovernanceModule {}