import { Module } from '@nestjs/common';
import {
  DispatchController,
  TripAnalyticsController,
} from './dispatch.controller';
import { DispatchService } from './dispatch.service';

@Module({
  controllers: [
    DispatchController,
    TripAnalyticsController,
  ],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule { }