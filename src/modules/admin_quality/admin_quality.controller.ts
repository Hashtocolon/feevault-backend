import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AdminJwtAuthGuard } from '../admin_auth/admin-jwt-auth.guard';

import { AdminQualityService } from './admin_quality.service';

import { CreateIncidentDto } from './dto/create-incident.dto';
import { CreateRescueDto } from './dto/create-rescue.dto';
import { CustomerDecisionDto } from './dto/customer-decision.dto';
import { CreateClaimDto } from './dto/create-claim.dto';
import { AlertRulesDto } from './dto/alert-rules.dto';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminQualityController {
  constructor(
    private readonly qualityService: AdminQualityService,
  ) {}

  // API 4.1
  @Get('incidents')
  getIncidents() {
    return this.qualityService.getIncidents();
  }

  // API 4.2
  @Post('incidents')
  createIncident(
    @Body() dto: CreateIncidentDto,
    @Req() req: any,
  ) {
    return this.qualityService.createIncident(
      dto,
      req.admin.id,
    );
  }

  // API 4.3
  @Post('incidents/rescue')
  createRescue(
    @Body() dto: CreateRescueDto,
    @Req() req: any,
  ) {
    return this.qualityService.createRescue(
      dto,
      req.admin.id,
    );
  }

  // API 4.4
  @Post('incidents/customer-decision')
  recordCustomerDecision(
    @Body() dto: CustomerDecisionDto,
    @Req() req: any,
  ) {
    return this.qualityService.recordCustomerDecision(
      dto,
      req.admin.id,
    );
  }

  // API 4.5
  @Get('claims')
  getClaims() {
    return this.qualityService.getClaims();
  }

  // API 4.6
  @Post('claims')
  createClaim(
    @Body() dto: CreateClaimDto,
    @Req() req: any,
  ) {
    return this.qualityService.createClaim(
      dto,
      req.admin.id,
    );
  }

  // API 4.7
  @Put('config/alert-rules')
  updateAlertRules(
    @Body() dto: AlertRulesDto,
    @Req() req: any,
  ) {
    return this.qualityService.updateAlertRules(
      dto,
      req.admin.id,
    );
  }
}