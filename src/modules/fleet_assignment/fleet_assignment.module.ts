import { Module } from '@nestjs/common';

import { FleetAssignmentController } from './fleet_assignment.controller';
import { FleetAssignmentService } from './fleet_assignment.service';

@Module({
  controllers: [FleetAssignmentController],
  providers: [FleetAssignmentService],
  exports: [FleetAssignmentService],
})
export class FleetAssignmentModule {}