
import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';

import { DriverProfileService } from './driver_profile.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { UpdateConsentDto } from './dto/update-consent.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Controller('driver/profile')
@UseGuards(JwtAuthGuard)
export class DriverProfileController {
  constructor(
    private readonly driverProfileService: DriverProfileService,
  ) {}

  // API 40.1
  // GET /api/v1/driver/profile

  @Get()
  async getProfile(
    @CurrentUser() user: any,
  ) {
    return this.driverProfileService.getProfile(user);
  }

  // API 40.2
  // PATCH /api/v1/driver/profile/consent

  @Patch('consent')
  async updateConsent(
    @CurrentUser() user: any,
    @Body() dto: UpdateConsentDto,
  ) {
    return this.driverProfileService.updateConsent(
      user,
      dto,
    );
  }

  // API 40.3
  // PATCH /api/v1/driver/profile/preferences

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: any,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.driverProfileService.updatePreferences(
      user,
      dto,
    );
  }
}
