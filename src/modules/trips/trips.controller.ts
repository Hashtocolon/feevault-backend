<<<<<<< HEAD
import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { DispatchService } from '../dispatch/dispatch.service';
import { RatingService } from './rating.service';
import { RateTripDto } from './dto/rating.dto';
=======

import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Body,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';

import { DispatchService } from '../dispatch/dispatch.service';
import { RatingService } from './rating.service';
import { AnalyticsService } from './analytics.service';

>>>>>>> 81b7120 (feat(trips): driver apis and rating updates)
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateTripDto } from './dto/rating.dto';

@Controller('trips')
export class TripsController {
  constructor(
    private readonly dispatchService: DispatchService,
    private readonly ratingService: RatingService,
<<<<<<< HEAD
=======
    private readonly analyticsService: AnalyticsService,
>>>>>>> 81b7120 (feat(trips): driver apis and rating updates)
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
    return this.analyticsService.getDoorLog(bookingId, userId);
  }

  // API 3: Export Temperature Report PDF
  @UseGuards(JwtAuthGuard)
  @Get(':bookingId/analytics/export')
  async exportTemperaturePdf(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @Res() response: Response,
    @Query('format') format = 'pdf',
    @Query('includeChart') includeChart = 'true',
    @Query('includeDoorLog') includeDoorLog = 'true',
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
