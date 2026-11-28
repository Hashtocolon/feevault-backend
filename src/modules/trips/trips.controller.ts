import {
  Controller,
  Post,
  Get,
  Sse,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DispatchService } from '../dispatch/dispatch.service';
import { RatingService } from './rating.service';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateTripDto } from './dto/rating.dto';

@Controller('trips')
export class TripsController {
  constructor(
    private readonly dispatchService: DispatchService,
    private readonly ratingService: RatingService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // Generate Agora Token
  @UseGuards(JwtAuthGuard)
  @Post(':bookingId/agora/token')
  async generateAgoraToken(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.generateAgoraToken(
      bookingId,
      userId,
    );
  }

  // Get Chat Messages
  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/chat/messages')
  async getChatMessages(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.dispatchService.getChatMessages(
      bookingId,
      userId,
    );
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

  // Submit Trip Rating
  @UseGuards(JwtAuthGuard)
  @Post(':bookingId/rating')
  async rateTrip(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RateTripDto,
  ) {
    return this.ratingService.rateTrip(
      bookingId,
      userId,
      dto,
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

  // API 1: Full Trip Temperature Analytics
  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/analytics/temperature')
  async getTemperatureAnalytics(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @Query('resolution') resolution = '15min',
    @Query('includeHumidity') includeHumidity = 'false',
  ) {
    return this.analyticsService.getTemperatureAnalytics(
      bookingId,
      userId,
      resolution,
      includeHumidity === 'true',
    );
  }

  // API 2: Door Sensor & Excursion Event Log
  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/analytics/door-log')
  async getDoorLog(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.analyticsService.getDoorLog(
      bookingId,
      userId,
    );
  }

  // API 3: Export Temperature Report PDF
  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/analytics/export')
  async exportTemperaturePdf(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @Res() response: Response,
    @Query('format') format = 'pdf',
  ) {
    if (format !== 'pdf') {
      return response.status(400).json({
        message: 'Only PDF format is supported',
      });
    }

    const pdf = await this.analyticsService.exportTemperaturePdf(
      bookingId,
      userId,
    );

    const fileName = `ColdRoute_TempCertificate_${bookingId}.pdf`;

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );

    return response.send(pdf);
  }
}
