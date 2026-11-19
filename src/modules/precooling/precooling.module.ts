import { Module } from '@nestjs/common';

import { PrecoolingController } from './precooling.controller';
import { PrecoolingService } from './precooling.service';

@Module({
  controllers: [PrecoolingController],
  providers: [PrecoolingService],
  exports: [PrecoolingService],
})
export class PrecoolingModule {}