import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CustomerSettingsService } from './customer-settings.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { WithdrawConsentDto } from './dto/withdraw-consent.dto';
import { ExportDataDto } from './dto/export-data.dto';
import { ErasureRequestDto } from './dto/erasure-request.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class CustomerSettingsController {
  constructor(
    private readonly settingsService: CustomerSettingsService,
  ) {}

@Get('customer/account')
  getAccount(@Req() req: any) {
    const userId = req.user.userId || req.user.id;
    return this.settingsService.getAccount(userId);
  }

  @Patch('customer/preferences')
  updatePreferences(
    @Req() req: any,
    @Body() dto: UpdatePreferencesDto,
  ) {
    const userId = req.user.userId || req.user.id;
    return this.settingsService.updatePreferences(
      userId,
      dto,
    );
  }

  @Post('compliance/dpdp/withdraw-consent')
  @HttpCode(HttpStatus.OK)
  withdrawConsent(
    @Req() req: any,
    @Body() dto: WithdrawConsentDto,
  ) {
    const userId = req.user.userId || req.user.id;
    return this.settingsService.withdrawConsent(
      userId,
      dto,
    );
  }

  @Post('compliance/dpdp/export-data')
  @HttpCode(HttpStatus.ACCEPTED)
  requestDataExport(
    @Req() req: any,
    @Body() dto: ExportDataDto,
  ) {
    const userId = req.user.userId || req.user.id;
    return this.settingsService.requestDataExport(
      userId,
      dto,
    );
  }

  @Post('compliance/dpdp/erasure-request')
  @HttpCode(HttpStatus.OK)
  requestErasure(
    @Req() req: any,
    @Body() dto: ErasureRequestDto,
  ) {
    const userId = req.user.userId || req.user.id;
    return this.settingsService.requestErasure(
      userId,
      dto,
    );
  }
}