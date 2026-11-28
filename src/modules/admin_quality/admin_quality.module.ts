import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../../database/database.module';
import { AdminAuthModule } from '../admin_auth/admin_auth.module';
import { AdminJwtAuthGuard } from '../admin_auth/admin-jwt-auth.guard';

import { AdminQualityController } from './admin_quality.controller';
import { AdminQualityService } from './admin_quality.service';

@Module({
  imports: [
    DatabaseModule,
    AdminAuthModule,
    JwtModule.register({}),
  ],
  controllers: [
    AdminQualityController,
  ],
  providers: [
    AdminQualityService,
    AdminJwtAuthGuard,
  ],
  exports: [
    AdminQualityService,
  ],
})
export class AdminQualityModule {}