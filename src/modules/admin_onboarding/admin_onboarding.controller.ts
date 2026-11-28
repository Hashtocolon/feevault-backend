
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { AdminJwtAuthGuard } from '../admin_auth/admin-jwt-auth.guard';
import { AdminOnboardingService } from './admin_onboarding.service';

import { VerificationDecisionDto } from './dto/verification-decision.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminOnboardingController {
  constructor(
    private readonly adminOnboardingService: AdminOnboardingService,
  ) {}

  // API 3.1 - Verification Queue
  @Get('verification/queue')
  getVerificationQueue(
    @Query('queue') queue?: string,
    @Query('priority') priority?: string,
  ) {
    return this.adminOnboardingService.getVerificationQueue(
      queue,
      priority,
    );
  }

  // API 3.2 - Verification Decision
  @Put('verification/:itemId/decision')
  decideVerification(
    @Param('itemId') itemId: string,
    @Body() dto: VerificationDecisionDto,
    @Req() req: any,
  ) {
    return this.adminOnboardingService.decideVerification(
      itemId,
      dto,
      req.admin.id,
    );
  }

  // API 3.3 - List Customers
  @Get('customers')
  getCustomers() {
    return this.adminOnboardingService.getCustomers();
  }

  // API 3.4 - Create Customer
  @Post('customers')
  @HttpCode(HttpStatus.CREATED)
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.adminOnboardingService.createCustomer(dto);
  }

  // API 3.5 - List Partners
  @Get('partners')
  getPartners() {
    return this.adminOnboardingService.getPartners();
  }

  // API 3.6 - Create Partner
  @Post('partners')
  @HttpCode(HttpStatus.CREATED)
  createPartner(@Body() dto: CreatePartnerDto) {
    return this.adminOnboardingService.createPartner(dto);
  }
}
