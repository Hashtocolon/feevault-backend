import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../../database/database.module';
import { AdminAuthModule } from '../admin_auth/admin_auth.module';
import { AdminJwtAuthGuard } from '../admin_auth/admin-jwt-auth.guard';

import { AdminFinanceController } from './admin_finance.controller';
import { AdminFinanceService } from './admin_finance.service';

@Module({
  imports: [
    DatabaseModule,
    AdminAuthModule,
    JwtModule.register({}),
  ],
  controllers: [
    AdminFinanceController,
  ],
  providers: [
    AdminFinanceService,
    AdminJwtAuthGuard,
  ],
  exports: [
    AdminFinanceService,
  ],
})
export class AdminFinanceModule {}