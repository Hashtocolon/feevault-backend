import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { DispatchService } from '../dispatch/dispatch.service';
import { RatingService } from './rating.service';
import { RateTripDto } from './dto/rating.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('trips')
export class TripsController {
  constructor(
    private readonly dispatchService: DispatchService,
    private readonly ratingService: RatingService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post(':bookingId/agora/token')
  async generateAgoraToken(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.generateAgoraToken(bookingId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/chat/messages')
  async getChatMessages(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.getChatMessages(bookingId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':bookingId/rating')
  async rateTrip(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RateTripDto,
  ) {
    return this.ratingService.rateTrip(bookingId, userId, dto);
  }
}
