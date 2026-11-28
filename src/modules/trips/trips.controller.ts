import {
  Controller,
  Post,
  Get,
  Sse,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
  ) { }

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

  // SCREEN 12 - API 4: Send Chat Message
  @UseGuards(JwtAuthGuard)
  @Post(':bookingId/chat/send')
  @HttpCode(HttpStatus.CREATED)
  async sendChatMessage(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @Body('text') text: string,
  ) {
    return this.dispatchService.sendChatMessage(
      bookingId,
      userId,
      text,
    );
  }
  // SCREEN 14 - API 1: Get Live Trip Snapshot
  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/live')
  async getLiveTripSnapshot(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.getLiveTripSnapshot(
      bookingId,
      userId,
    );
  }
  // SCREEN 14 - API 2: Live Trip Updates SSE
  @UseGuards(JwtAuthGuard)
  @Sse(':bookingId/live/stream')
  streamLiveTrip(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.streamLiveTrip(
      bookingId,
      userId,
    );
  }
  // SCREEN 14 - API 3: Get Planned Route Polyline
  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/route')
  async getPlannedRoute(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.getPlannedRoute(
      bookingId,
      userId,
    );
  }
  // SCREEN 14 - API 4: Get Temperature History Log
  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/temperature-log')
  async getTemperatureHistory(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @Query('from') fromDate: string,
    @Query('to') toDate?: string,
    @Query('resolution') resolution = '5min',
  ) {
    return this.dispatchService.getTemperatureHistory(
      bookingId,
      userId,
      fromDate,
      toDate,
      resolution,
    );
  }
  // SCREEN 14 - API 5: Get Trip Milestones Timeline
  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/milestones')
  async getTripMilestones(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.getTripMilestones(
      bookingId,
      userId,
    );
  }
  // SCREEN 14 - API 6: Trigger Emergency / Excursion Action
  @UseGuards(JwtAuthGuard)
  @Post(':bookingId/excursion-action')
  @HttpCode(HttpStatus.OK)
  async triggerExcursionAction(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      action: string;
      customerNote?: string;
    },
  ) {
    return this.dispatchService.triggerExcursionAction(
      bookingId,
      userId,
      body,
    );
  }
}
