
import { Module } from '@nestjs/common';

import { DispatchOffersController } from './dispatch_offers.controller';
import { DispatchOffersService } from './dispatch_offers.service';

@Module({
  controllers: [DispatchOffersController],
  providers: [DispatchOffersService],
  exports: [DispatchOffersService],
})
export class DispatchOffersModule {}
