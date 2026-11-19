
import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import { DriverService } from './driver.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { SubmitBankDetailsDto } from './dto/submit-bank-details.dto';
import { SubmitBackgroundCheckDto } from './dto/submit-background-check.dto';

// =====================================================
// BACKGROUND VERIFICATION FILE UPLOAD DIRECTORY
// =====================================================

const backgroundUploadDir = join(
  process.cwd(),
  'uploads',
  'driver-background',
);

if (!existsSync(backgroundUploadDir)) {
  mkdirSync(backgroundUploadDir, { recursive: true });
}

// =====================================================
// DRIVER CONTROLLER
// =====================================================

@Controller('driver')
export class DriverController {
  constructor(
    private readonly driverService: DriverService,
  ) {}

  // =====================================================
  // API 9.1: DRIVER DASHBOARD
  // GET /api/v1/driver/dashboard
  // =====================================================

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboard(
    @CurrentUser('userId') userId: string,
  ) {
    return this.driverService.getDashboard(userId);
  }

  // =====================================================
  // API 9.2: UPDATE DRIVER DUTY STATUS
  // PATCH /api/v1/driver/duty/status
  // =====================================================

  @Patch('duty/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleDuty(
    @CurrentUser('userId') userId: string,
    @Body() body: any,
  ) {
    const data = await this.driverService.toggleDutyStatus(
      userId,
      body,
    );

    return {
      success: true,
      message:
        data.dutyStatus === 'ONLINE'
          ? 'You are now ONLINE. Ready to receive cold-chain dispatch waves.'
          : 'Duty status set to OFFLINE. Location tracking stopped.',
      data,
    };
  }

  // =====================================================
  // DRIVER COMPLIANCE CALENDAR
  // GET /api/v1/driver/compliance/calendar
  // =====================================================

  @Get('compliance/calendar')
  @UseGuards(JwtAuthGuard)
  async getCompliance(
    @CurrentUser('userId') userId: string,
  ) {
    const data =
      await this.driverService.getComplianceCalendar(userId);

    return {
      success: true,
      data,
    };
  }

  // =====================================================
  // API 6.1: SUBMIT BANK ACCOUNT & UPI DETAILS
  // POST /api/v1/driver/kyc/bank
  // =====================================================

  @Post('kyc/bank')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submitBankDetails(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubmitBankDetailsDto,
  ) {
    return this.driverService.submitBankDetails(
      userId,
      dto,
    );
  }

  // =====================================================
  // API 7.1: DRIVER BACKGROUND & POLICE VERIFICATION
  // POST /api/v1/driver/kyc/background-check
  // =====================================================

  @Post('kyc/background-check')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('documentFile', {
      storage: diskStorage({
        destination: backgroundUploadDir,

        filename: (req, file, callback) => {
          const uniqueName =
            `${Date.now()}-${Math.round(Math.random() * 1e9)}` +
            extname(file.originalname).toLowerCase();

          callback(null, uniqueName);
        },
      }),

      limits: {
        fileSize: 10 * 1024 * 1024,
      },

      fileFilter: (req, file, callback) => {
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only PDF, JPG and PNG documents are allowed.',
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async submitBackgroundCheck(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubmitBackgroundCheckDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Police verification certificate document is required.',
      );
    }

    return this.driverService.submitBackgroundCheck(
      userId,
      dto,
      file,
    );
  }

  // =====================================================
  // API 8.1: APPLICATION VERIFICATION STATUS
  // GET /api/v1/driver/profile/verification-status
  // =====================================================

  @Get('profile/verification-status')
  @UseGuards(JwtAuthGuard)
  async getVerificationStatus(
    @CurrentUser('userId') userId: string,
  ) {
    return this.driverService.getVerificationStatus(userId);
  }
}
