import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { DispatchModule } from '../dispatch/dispatch.module';
import { DatabaseModule } from '../../database/database.module';
import { RatingService } from './rating.service';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    DispatchModule,
    DatabaseModule,
  ],
  controllers: [
    TripsController,
  ],
  providers: [
    RatingService,
    AnalyticsService,
  ],
  exports: [
    RatingService,
    AnalyticsService,
  ],
})
export class TripsModule {}
