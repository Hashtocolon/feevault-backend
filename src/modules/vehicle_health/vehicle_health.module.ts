import { Module } from '@nestjs/common';

import { VehicleHealthController } from './vehicle_health.controller';
import { VehicleHealthService } from './vehicle_health.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [VehicleHealthController],
  providers: [VehicleHealthService],
  exports: [VehicleHealthService],
})
export class VehicleHealthModule {}