
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';

import { FleetService } from './fleet.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { InviteDriverDto } from './dto/invite-driver.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';

@Controller('fleet')
@UseGuards(JwtAuthGuard)
export class FleetController {
  constructor(
    private readonly fleetService: FleetService,
  ) {}

  // --------------------------------------------------
  // API 39.1: GET FLEET OVERVIEW
  // GET /api/v1/fleet/overview
  // --------------------------------------------------

  @Get('overview')
  async getFleetOverview(
    @CurrentUser() user: any,
  ) {
    return this.fleetService.getFleetOverview(user);
  }

  // --------------------------------------------------
  // API 39.2: INVITE DRIVER
  // POST /api/v1/fleet/drivers/invite
  // --------------------------------------------------

  @Post('drivers/invite')
  async inviteDriver(
    @CurrentUser() user: any,
    @Body() dto: InviteDriverDto,
  ) {
    return this.fleetService.inviteDriver(
      user,
      dto,
    );
  }

  // --------------------------------------------------
  // API 39.3: ASSIGN / UNASSIGN DRIVER
  // POST /api/v1/fleet/vehicles/:vehicleId/assign-driver
  // --------------------------------------------------

  @Post('vehicles/:vehicleId/assign-driver')
  async assignDriverToVehicle(
    @CurrentUser() user: any,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.fleetService.assignDriverToVehicle(
      user,
      vehicleId,
      dto,
    );
  }
}
