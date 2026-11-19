
import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { DispatchOffersService } from './dispatch_offers.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { AcceptDispatchOfferDto } from './dto/accept-dispatch-offer.dto';
import { DeclineDispatchOfferDto } from './dto/decline-dispatch-offer.dto';

@Controller('driver/trips')
@UseGuards(JwtAuthGuard)
export class DispatchOffersController {
  constructor(
    private readonly dispatchOffersService: DispatchOffersService,
  ) {}

  // =====================================================
  // API 10.1: ACCEPT DISPATCH JOB OFFER
  // POST /api/v1/driver/trips/:tripId/accept
  // =====================================================

  @Post(':tripId/accept')
  @HttpCode(HttpStatus.OK)
  async acceptOffer(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: AcceptDispatchOfferDto,
  ) {
    return this.dispatchOffersService.acceptOffer(
      userId,
      tripId,
      dto,
    );
  }

  // =====================================================
  // API 10.2: DECLINE DISPATCH JOB OFFER
  // POST /api/v1/driver/trips/:tripId/decline
  // =====================================================

  @Post(':tripId/decline')
  @HttpCode(HttpStatus.OK)
  async declineOffer(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: DeclineDispatchOfferDto,
  ) {
    return this.dispatchOffersService.declineOffer(
      userId,
      tripId,
      dto,
    );
  }
}
