import { Controller, Get, Post, Query, Body, Headers } from '@nestjs/common';
import { ConsigneeService } from './consignee.service';

@Controller('consignee')
export class ConsigneeController {
  constructor(private readonly consigneeService: ConsigneeService) {}

  @Get('portal')
  async getConsigneePortal(
    @Query('token') queryToken: string,
    @Headers('x-share-token') headerToken?: string,
  ) {
    return this.consigneeService.getConsigneePortal(queryToken || headerToken);
  }

  @Post('portal/verify-otp')
  async verifyDeliveryOtp(
    @Body() body: any,
    @Query('token') queryToken: string,
    @Headers('x-share-token') headerToken?: string,
  ) {
    const token = body?.token || queryToken || headerToken;
    const otp = body?.otp || body?.deliveryOtp || body?.code;
    return this.consigneeService.verifyDeliveryOtp(token, otp);
  }

  @Post('portal/outcome')
  async submitReceiverOutcome(
    @Body() body: any,
    @Query('token') queryToken: string,
    @Headers('x-share-token') headerToken?: string,
  ) {
    const token = body?.token || queryToken || headerToken;
    const outcome =
      body?.outcome ||
      body?.decision ||
      body?.status ||
      body?.selectedOutcome ||
      'full_acceptance';
    const note = body?.note || body?.reason || body?.remarks;

    return this.consigneeService.submitReceiverOutcome(token, outcome, note, body);
  }
}
