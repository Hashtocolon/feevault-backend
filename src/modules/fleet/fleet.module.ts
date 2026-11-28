
import { Module } from '@nestjs/common';

import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FleetController],
  providers: [FleetService],
  exports: [FleetService],
})
export class FleetModule {}
