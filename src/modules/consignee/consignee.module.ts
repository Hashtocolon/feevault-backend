import { Module } from '@nestjs/common';
import { ConsigneeController } from './consignee.controller';
import { ConsigneeService } from './consignee.service';

@Module({
  controllers: [ConsigneeController],
  providers: [ConsigneeService],
  exports: [ConsigneeService],
})
export class ConsigneeModule {}

