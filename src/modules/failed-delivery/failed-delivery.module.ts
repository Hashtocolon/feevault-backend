import { Module } from '@nestjs/common';
import { FailedDeliveryController } from './failed-delivery.controller';
import { FailedDeliveryService } from './failed-delivery.service';

@Module({
  controllers: [FailedDeliveryController],
  providers: [FailedDeliveryService],
  exports: [FailedDeliveryService],
})
export class FailedDeliveryModule {}

