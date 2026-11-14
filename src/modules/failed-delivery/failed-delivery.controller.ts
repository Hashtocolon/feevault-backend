import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { FailedDeliveryService } from './failed-delivery.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('trips')
export class FailedDeliveryController {
  constructor(private readonly failedDeliveryService: FailedDeliveryService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':bookingId/failed-delivery-decision')
  async submitFailedDeliveryDecision(
    @Param('bookingId') bookingId: string,
    @Body() body: any,
    @CurrentUser('id') userId: string,
  ) {
    const decision = body?.decision || body?.customerDecision;
    const reason = body?.reason || body?.customerNotes || body?.note;
    return this.failedDeliveryService.submitFailedDeliveryDecision(
      bookingId,
      decision,
      reason,
      userId,
      body,
    );
  }
}
