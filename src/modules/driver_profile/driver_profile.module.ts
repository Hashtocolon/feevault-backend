
import { Module } from '@nestjs/common';

import { DriverProfileController } from './driver_profile.controller';
import { DriverProfileService } from './driver_profile.service';

import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DriverProfileController],
  providers: [DriverProfileService],
  exports: [DriverProfileService],
})
export class DriverProfileModule {}
