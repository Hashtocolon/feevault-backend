import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { VehicleHealthService } from './vehicle_health.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('driver/vehicle')
@UseGuards(JwtAuthGuard)
export class VehicleHealthController {
  constructor(
    private readonly vehicleHealthService: VehicleHealthService,
  ) {}

  // API 37.1
  @Get()
  async getVehicleHealth(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.vehicleHealthService.getVehicleHealth(
      userId,
      role,
    );
  }
}