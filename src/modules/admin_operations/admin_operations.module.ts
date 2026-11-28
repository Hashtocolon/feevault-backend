
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../../database/database.module';
import { AdminAuthModule } from '../admin_auth/admin_auth.module';
import { AdminJwtAuthGuard } from '../admin_auth/admin-jwt-auth.guard';

import { AdminOperationsController } from './admin_operations.controller';
import { AdminOperationsService } from './admin_operations.service';

@Module({
  imports: [
    DatabaseModule,
    AdminAuthModule,
    JwtModule.register({}),
  ],
  controllers: [
    AdminOperationsController,
  ],
  providers: [
    AdminOperationsService,
    AdminJwtAuthGuard,
  ],
  exports: [
    AdminOperationsService,
  ],
})
export class AdminOperationsModule {}
