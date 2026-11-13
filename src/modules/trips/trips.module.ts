import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [DispatchModule],
  controllers: [TripsController],
})
export class TripsModule {}

