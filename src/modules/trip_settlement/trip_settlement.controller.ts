import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';

import { TripSettlementService } from './trip_settlement.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('driver/trips')
@UseGuards(JwtAuthGuard)
export class TripSettlementController {
  constructor(
    private readonly settlementService: TripSettlementService,
  ) {}

  @Get(':tripId/settlement')
  async getTripSettlement(
    @Param('tripId') tripId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.settlementService.getTripSettlement(
      tripId,
      userId,
      userRole,
    );
  }
}