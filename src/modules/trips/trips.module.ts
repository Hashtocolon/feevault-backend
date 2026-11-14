import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { RatingService } from './rating.service';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [DispatchModule],
  controllers: [TripsController],
  providers: [RatingService],
  exports: [RatingService],
})
export class TripsModule {}
