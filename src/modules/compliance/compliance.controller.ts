import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @UseGuards(JwtAuthGuard)
  @Post('gstin/verify')
  async verifyConsigneeGstin(
    @Body('gstin') gstin: string,
    @Body('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.complianceService.verifyConsigneeGstin(gstin, bookingId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('ewaybill/verify')
  async verifyExistingEwayBill(
    @Body('ewayBillNumber') ewayBillNumber: string,
    @Body('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.complianceService.verifyExistingEwayBill(ewayBillNumber, bookingId, userId);
  }
}

