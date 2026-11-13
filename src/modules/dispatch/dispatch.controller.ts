import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/dispatch-status')
  async getDispatchStatus(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.getDispatchStatus(bookingId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':bookingId/cancel')
  async cancelBooking(
    @Param('bookingId') bookingId: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.cancelBooking(bookingId, reason, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':bookingId/escalate-ops')
  async escalateOps(
    @Param('bookingId') bookingId: string,
    @Body('reason') reason: string,
    @Body('note') note: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.escalateOps(bookingId, reason, note, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/confirmation')
  async getBookingConfirmation(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.getBookingConfirmation(bookingId, userId);
  }
}

