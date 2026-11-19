import { Module } from '@nestjs/common';

import { CompartmentController } from './compartment.controller';
import { CompartmentService } from './compartment.service';

@Module({
  controllers: [CompartmentController],
  providers: [CompartmentService],
  exports: [CompartmentService],
})
export class CompartmentModule {}