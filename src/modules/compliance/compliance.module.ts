import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

import { DriverComplianceController } from './driver-compliance.controller';
import { DriverComplianceService } from './driver-compliance.service';

@Module({
  imports: [
    DatabaseModule,
  ],

  controllers: [
    ComplianceController,
    DriverComplianceController,
  ],

  providers: [
    ComplianceService,
    DriverComplianceService,
  ],

  exports: [
    ComplianceService,
    DriverComplianceService,
  ],
})
export class ComplianceModule {}