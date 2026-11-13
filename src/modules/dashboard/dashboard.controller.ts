import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get('dashboard/summary')
  async getDashboardSummary(@CurrentUser('id') userId: string) {
    return this.dashboardService.getDashboardSummary(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('shipments/active')
  async getActiveShipments(@CurrentUser('id') userId: string) {
    return this.dashboardService.getActiveShipments(userId);
  }
}

