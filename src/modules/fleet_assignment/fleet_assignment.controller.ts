import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';

import { FleetAssignmentService } from './fleet_assignment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { AssignFleetTripDto } from './dto/assign-fleet-trip.dto';
import { ConfirmAssignmentDto } from './dto/confirm-assignment.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class FleetAssignmentController {
  constructor(
    private readonly fleetAssignmentService: FleetAssignmentService,
  ) {}

  // API 11.1
  @Post('fleet/trips/:tripId/assign')
  @HttpCode(HttpStatus.OK)
  async assignTrip(
    @Param('tripId') tripId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: AssignFleetTripDto,
  ) {
    // Accepts both 'FLEET_OWNER' and 'fleet_owner'
    if (role?.toUpperCase() !== 'FLEET_OWNER') {
      throw new ForbiddenException(
        'Only fleet owners can assign vehicles and drivers',
      );
    }

    return this.fleetAssignmentService.assignTrip(
      tripId,
      userId,
      dto,
    );
  }

  // API 11.2
  @Post('driver/trips/:tripId/confirm-assignment')
  @HttpCode(HttpStatus.OK)
  async confirmAssignment(
    @Param('tripId') tripId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: ConfirmAssignmentDto,
  ) {
    // Accepts both 'DRIVER' and 'driver'
    if (role?.toUpperCase() !== 'DRIVER') {
      throw new ForbiddenException(
        'Only drivers can confirm or reject assignments',
      );
    }

    return this.fleetAssignmentService.confirmAssignment(
      tripId,
      userId,
      dto,
    );
  }
}