import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { DriverComplianceService } from './driver-compliance.service';
import { RenewComplianceDto } from './dto/renew-compliance.dto';

@Controller('driver/compliance')
@UseGuards(JwtAuthGuard)
export class DriverComplianceController {
  constructor(
    private readonly complianceService: DriverComplianceService,
  ) {}

  // API 38.1
  @Get('calendar')
  async getComplianceCalendar(
    @CurrentUser() user: any,
  ) {
    return this.complianceService.getComplianceCalendar(user);
  }

  // API 38.2
  @Post('documents/renew')
  @UseInterceptors(
    FileInterceptor('documentFile', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, callback) => {
        const allowed = [
          'application/pdf',
          'image/jpeg',
          'image/png',
        ];

        if (!allowed.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only PDF, JPG and PNG files are allowed',
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async renewComplianceDocument(
    @Body() dto: RenewComplianceDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.complianceService.renewComplianceDocument(
      dto,
      file,
      user,
    );
  }
}