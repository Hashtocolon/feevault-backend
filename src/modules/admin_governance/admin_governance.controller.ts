import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AdminJwtAuthGuard } from '../admin_auth/admin-jwt-auth.guard';
import { AdminGovernanceService } from './admin_governance.service';

import { CreateSegregationRuleDto } from './dto/create-segregation-rule.dto';
import { CreateVehicleClassDto } from './dto/create-vehicle-class.dto';
import { CreateDeviceDto } from './dto/create-device.dto';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminGovernanceController {
  constructor(
    private readonly governanceService: AdminGovernanceService,
  ) {}

  // API 6.1
  @Post('config/segregation-rules')
  createSegregationRule(
    @Body() dto: CreateSegregationRuleDto,
    @Req() req: Request & { admin: { id: string } },
  ) {
    return this.governanceService.createSegregationRule(
      dto,
      req.admin.id,
    );
  }

  // API 6.2
  @Post('config/vehicle-classes')
  createVehicleClass(
    @Body() dto: CreateVehicleClassDto,
    @Req() req: Request & { admin: { id: string } },
  ) {
    return this.governanceService.createVehicleClass(
      dto,
      req.admin.id,
    );
  }

  // Optional device registration endpoint
  @Post('devices')
  createDevice(@Body() dto: CreateDeviceDto) {
    return this.governanceService.createDevice(dto);
  }

  // API 6.3
  @Get('devices')
  getDevices() {
    return this.governanceService.getDevices();
  }

  // API 6.4
  @Get('reports/temperature-compliance')
  async getTemperatureCompliance(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format = 'json',
    @Res() res: Response,
  ) {
    const report =
      await this.governanceService.getTemperatureCompliance(
        startDate,
        endDate,
        format,
      );

    if (format === 'csv') {
      if (!('csv' in report)) {
        throw new BadRequestException('CSV report could not be generated');
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${report.fileName}"`,
      );

      return res.status(200).send(report.csv);
    }

    return res.status(200).json(report);
  }

  // API 6.5
  @Get('governance/audit-logs')
  getAuditLogs() {
    return this.governanceService.getAuditLogs();
  }
}