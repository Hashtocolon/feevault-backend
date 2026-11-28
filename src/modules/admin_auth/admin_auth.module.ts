
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../../database/database.module';
import { AdminAuthController } from './admin_auth.controller';
import { AdminAuthService } from './admin_auth.service';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({}),
  ],
  controllers: [
    AdminAuthController,
  ],
  providers: [
    AdminAuthService,
    AdminJwtAuthGuard,
  ],
  exports: [
    AdminAuthService,
    AdminJwtAuthGuard,
  ],
})
export class AdminAuthModule {}
