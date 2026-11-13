import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ConsigneeService } from './consignee.service';

@Controller('consignee')
export class ConsigneeController {
  constructor(private readonly consigneeService: ConsigneeService) {}

  @Get('portal')
  async getConsigneePortal(@Query('token') token: string) {
    return this.consigneeService.getConsigneePortal(token);
  }

  @Post('portal/verify-otp')
  async verifyDeliveryOtp(
    @Body('token') token: string,
    @Body('otp') otp: string,
  ) {
    return this.consigneeService.verifyDeliveryOtp(token, otp);
  }

  @Post('portal/outcome')
  async submitReceiverOutcome(
    @Body('token') token: string,
    @Body('outcome') outcome: string,
    @Body('note') note?: string,
  ) {
    return this.consigneeService.submitReceiverOutcome(token, outcome, note);
  }
}

