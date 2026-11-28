import {
  Controller,
  Get,
  UseGuards,
  Query,
  Param,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';

import type { Request, Response } from 'express';

import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

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

  // SCREEN 13 - API 1: Fetch Filtered Shipments
  @UseGuards(JwtAuthGuard)
  @Get('shipments')
  async getShipments(
    @CurrentUser('id') userId: string,
    @Query('status') status = 'all',
    @Query('search') search = '',
    @Query('dateRange') dateRange = '30d',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.dashboardService.getShipments(userId, {
      status,
      search,
      dateRange,
      page,
      limit,
    });
  }
  // SCREEN 13 - API 2: Export Shipments CSV
  @UseGuards(JwtAuthGuard)
  @Get('shipments/export')
  async exportShipments(
    @CurrentUser('id') userId: string,
    @Query('status') status = 'all',
    @Query('dateRange') dateRange = 'all',
    @Query('format') format = 'csv',
    @Req() req: Request,
  ) {
    if (format.toLowerCase() !== 'csv') {
      throw new BadRequestException('Only CSV export is supported.');
    }

    const result = await this.dashboardService.exportShipments(userId, {
      status,
      dateRange,
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    return {
      downloadUrl: `${baseUrl}/api/v1/shipments/export/download/${result.token}`,
      fileName: result.fileName,
      generatedAt: result.generatedAt,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

}

