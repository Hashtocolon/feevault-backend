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
    @Body('decision') decision: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.failedDeliveryService.submitFailedDeliveryDecision(
      bookingId,
      decision,
      reason,
      userId,
    );
  }
}

