import { Module } from '@nestjs/common';

import { PickupArrivalController } from './pickup_arrival.controller';
import { PickupArrivalService } from './pickup_arrival.service';

@Module({
  controllers: [PickupArrivalController],
  providers: [PickupArrivalService],
  exports: [PickupArrivalService],
})
export class PickupArrivalModule {}