import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../../database/database.module';
import { AdminAuthModule } from '../admin_auth/admin_auth.module';
import { AdminJwtAuthGuard } from '../admin_auth/admin-jwt-auth.guard';

import { AdminOnboardingController } from './admin_onboarding.controller';
import { AdminOnboardingService } from './admin_onboarding.service';

@Module({
  imports: [
    DatabaseModule,
    AdminAuthModule,
    JwtModule.register({}),
  ],
  controllers: [
    AdminOnboardingController,
  ],
  providers: [
    AdminOnboardingService,
    AdminJwtAuthGuard,
  ],
  exports: [
    AdminOnboardingService,
  ],
})
export class AdminOnboardingModule {}