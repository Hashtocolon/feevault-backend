import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';

import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { PretripService } from './pretrip.service';
import { PretripChecklistDto } from './dto/pretrip-checklist.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('driver/trips')
@UseGuards(JwtAuthGuard)
export class PretripController {
  constructor(private readonly pretripService: PretripService) {}

  // API 12.1
  @Post(':tripId/pretrip-checklist')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('compartmentPhotos', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async submitChecklist(
    @Param('tripId') tripId: string,
    @CurrentUser('id') driverUserId: string,
    @Body() dto: PretripChecklistDto,
    @UploadedFiles(
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
    compartmentPhotos: Express.Multer.File[],
  ) {
    if (!compartmentPhotos || compartmentPhotos.length < 1) {
      throw new BadRequestException(
        'At least one compartment photo is required',
      );
    }

    return this.pretripService.submitChecklist(
      tripId,
      driverUserId,
      dto,
      compartmentPhotos,
    );
  }
}