import { Module } from '@nestjs/common';

import { TripSettlementController } from './trip_settlement.controller';
import { TripSettlementService } from './trip_settlement.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TripSettlementController],
  providers: [TripSettlementService],
  exports: [TripSettlementService],
})
export class TripSettlementModule {}