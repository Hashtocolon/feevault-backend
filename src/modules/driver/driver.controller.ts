import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DriverService } from './driver.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboard(@CurrentUser('userId') userId: string) {
    const data = await this.driverService.getDashboard(userId);
    return {
      success: true,
      message: 'Dashboard summary retrieved successfully',
      data,
    };
  }

  @Patch('duty/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleDuty(
    @CurrentUser('userId') userId: string,
    @Body() body: any,
  ) {
    const data = await this.driverService.toggleDutyStatus(userId, body);
    return {
      success: true,
      message: `You are now ${data.dutyStatus}. Ready for FTL dispatch waves.`,
      data,
    };
  }

  @Get('compliance/calendar')
  @UseGuards(JwtAuthGuard)
  async getCompliance(@CurrentUser('userId') userId: string) {
    const data = await this.driverService.getComplianceCalendar(userId);
    return {
      success: true,
      data,
    };
  }
}

