
import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { PickupArrivalService } from './pickup_arrival.service';
import { PickupArrivalDto } from './dto/pickup-arrival.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('driver/trips')
@UseGuards(JwtAuthGuard)
export class PickupArrivalController {
  constructor(
    private readonly pickupArrivalService: PickupArrivalService,
  ) {}

  // API 15.1: Record Pickup Arrival
  @Post(':tripId/pickup/arrival')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('shipperDelayPhoto', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async recordArrival(
    @Param('tripId') tripId: string,
    @CurrentUser('id') driverUserId: string,
    @Body() dto: PickupArrivalDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    if (
      photo &&
      !['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimetype)
    ) {
      throw new BadRequestException(
        'Only JPEG, PNG and WEBP images are allowed',
      );
    }

    return this.pickupArrivalService.recordArrival(
      tripId,
      driverUserId,
      dto,
      photo,
    );
  }
}
