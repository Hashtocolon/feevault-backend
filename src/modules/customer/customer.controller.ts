import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('customer/profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('userId') userId: string) {
    const data = await this.customerService.getProfile(userId);
    return {
      success: true,
      data,
    };
  }

  @Post('customer/profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async saveProfile(
    @CurrentUser('userId') userId: string,
    @Body() body: any,
  ) {
    const data = await this.customerService.updateProfile(userId, body);
    return {
      success: true,
      message: 'Profile saved successfully',
      data,
    };
  }

  @Post('customer/verify/gstin')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyGstin(@Body('gstin') gstin: string) {
    const data = await this.customerService.verifyGstin(gstin);
    return {
      success: true,
      message: 'GSTIN verified successfully',
      data,
    };
  }

  @Post('customer/verify/fssai')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyFssai(@Body('licenseNumber') licenseNumber: string) {
    const data = await this.customerService.verifyFssai(licenseNumber);
    return {
      success: true,
      message: 'FSSAI License verified successfully',
      data,
    };
  }

  @Get('customer/consents')
  @UseGuards(JwtAuthGuard)
  async getConsents(@CurrentUser('userId') userId: string) {
    const data = await this.customerService.getDpdpConsents(userId);
    return {
      success: true,
      data,
    };
  }

  @Patch('customer/consents')
  @UseGuards(JwtAuthGuard)
  async updateConsents(
    @CurrentUser('userId') userId: string,
    @Body() body: any,
  ) {
    const data = await this.customerService.updateDpdpConsents(userId, body);
    return {
      success: true,
      message: 'Consent preferences updated',
      data,
    };
  }
}

