import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MasterService } from './master.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('master')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  @UseGuards(JwtAuthGuard)
  @Get('hiring-models')
  async getAvailableHiringModels() {
    return this.masterService.getAvailableHiringModels();
  }

  @UseGuards(JwtAuthGuard)
  @Get('serviceability')
  async checkServiceability(
    @Query('originPincode') originPincode: string,
    @Query('destinationPincode') destinationPincode: string,
  ) {
    return this.masterService.checkServiceability(originPincode, destinationPincode);
  }

  @UseGuards(JwtAuthGuard)
  @Get('vehicle-classes')
  async getVehicleClasses(@Query('hiringModel') hiringModel?: string) {
    return this.masterService.getVehicleClasses(hiringModel);
  }

  @UseGuards(JwtAuthGuard)
  @Get('temp-bands')
  async getTemperatureBands() {
    return this.masterService.getTemperatureBands();
  }
}

