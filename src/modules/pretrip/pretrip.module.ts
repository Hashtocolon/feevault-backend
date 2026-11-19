import { Module } from '@nestjs/common';

import { PretripController } from './pretrip.controller';
import { PretripService } from './pretrip.service';

@Module({
  controllers: [PretripController],
  providers: [PretripService],
  exports: [PretripService],
})
export class PretripModule {}