
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('compliance')
export class ComplianceController {
  constructor(
    private readonly complianceService: ComplianceService,
  ) { }

  // SCREEN 9 - API 1: GSTIN Verification
  @UseGuards(JwtAuthGuard)
  @Post('gstin/verify')
  async verifyConsigneeGstin(
    @Body('gstin') gstin: string,
    @Body('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.complianceService.verifyConsigneeGstin(
      gstin,
      bookingId,
      userId,
    );
  }

  // SCREEN 9 - API 2: E-Way Bill Verification
  @UseGuards(JwtAuthGuard)
  @Post('ewaybill/verify')
  async verifyExistingEwayBill(
    @Body('ewayBillNumber') ewayBillNumber: string,
    @Body('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.complianceService.verifyExistingEwayBill(
      ewayBillNumber,
      bookingId,
      userId,
    );
  }

  // SCREEN 9 - API 3: Generate E-Way Bill Part-A
  @UseGuards(JwtAuthGuard)
  @Post('ewaybill/generate')
  async generateEwayBill(@Body() body: any) {
    return this.complianceService.generateEwayBill(body);
  }
}
