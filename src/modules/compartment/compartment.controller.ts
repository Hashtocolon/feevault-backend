
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

import { CompartmentService } from './compartment.service';
import { CompartmentLayoutDto } from './dto/compartment-layout.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('driver/trips')
@UseGuards(JwtAuthGuard)
export class CompartmentController {
  constructor(
    private readonly compartmentService: CompartmentService,
  ) {}

  @Post(':tripId/compartment-layout')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('bulkheadPhoto', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async confirmLayout(
    @Param('tripId') tripId: string,
    @CurrentUser('id') driverUserId: string,
    @Body() dto: CompartmentLayoutDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    if (dto.isMultiCompartment && !photo) {
      throw new BadRequestException(
        'Bulkhead photo is required for dual-compartment trucks',
      );
    }

    if (!dto.isMultiCompartment && photo) {
      throw new BadRequestException(
        'Bulkhead photo is only required for dual-compartment trucks',
      );
    }

    if (
      photo &&
      !['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimetype)
    ) {
      throw new BadRequestException(
        'Only JPEG, PNG and WEBP images are allowed',
      );
    }

    return this.compartmentService.confirmLayout(
      tripId,
      driverUserId,
      dto,
      photo,
    );
  }
}
