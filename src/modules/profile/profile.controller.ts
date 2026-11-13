import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.profileService.getMyProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('compliance/gstin/verify')
  async verifyGstin(
    @Body('gstin') gstin: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.profileService.verifyGstin(gstin, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('customer/profile')
  async saveCustomerProfile(
    @Body() body: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.profileService.saveCustomerProfile(body, userId);
  }
}

