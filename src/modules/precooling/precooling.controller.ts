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
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { PrecoolingService } from './precooling.service';
import { PrecoolingStatusDto } from './dto/precooling-status.dto';
import { PrecoolingAbortDto } from './dto/precooling-abort.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('driver/trips')
@UseGuards(JwtAuthGuard)
export class PrecoolingController {
  constructor(
    private readonly precoolingService: PrecoolingService,
  ) {}

  // API 13.1: Log Reefer Pre-Cooling Status
  @Post(':tripId/precooling/status')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('manualThermometerPhoto', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async submitPrecoolingStatus(
    @Param('tripId') tripId: string,
    @CurrentUser('id') driverUserId: string,
    @Body() dto: PrecoolingStatusDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    if (!dto.isReadingSourceIot && !photo) {
      throw new BadRequestException(
        'Manual thermometer photo is required when IoT reading is unavailable',
      );
    }

    if (dto.isReadingSourceIot && photo) {
      throw new BadRequestException(
        'Do not upload a manual thermometer photo when IoT reading is used',
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

    return this.precoolingService.submitStatus(
      tripId,
      driverUserId,
      dto,
      photo,
    );
  }

  // API 13.2: Abort Pre-Cooling / Report Reefer Malfunction
  @Post(':tripId/precooling/abort')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('reeferPanelPhoto', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async abortPrecooling(
    @Param('tripId') tripId: string,
    @CurrentUser('id') driverUserId: string,
    @Body() dto: PrecoolingAbortDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 5 * 1024 * 1024,
          }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp)$/,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    photo: Express.Multer.File,
  ) {
    return this.precoolingService.abortPrecooling(
      tripId,
      driverUserId,
      dto,
      photo,
    );
  }
}