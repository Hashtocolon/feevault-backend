import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('quotes/generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async generateQuote(
    @CurrentUser('userId') userId: string,
    @Body() body: any,
  ) {
    const data = await this.bookingsService.generateQuote(userId, body);
    return {
      success: true,
      data,
    };
  }

  @Post('bookings/create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createBooking(
    @CurrentUser('userId') userId: string,
    @Body() body: any,
  ) {
    const data = await this.bookingsService.createBooking(userId, body);
    return {
      success: true,
      message: 'Booking created and dispatch wave initiated',
      ...data,
    };
  }

  @Get('bookings/active')
  @UseGuards(JwtAuthGuard)
  async getActiveBookings(@CurrentUser('userId') userId: string) {
    const data = await this.bookingsService.getActiveBookings(userId);
    return {
      success: true,
      data,
    };
  }

  // PUBLIC CONSIGNEE PORTAL (NO AUTH REQUIRED)
  @Get('consignee/portal')
  async getConsigneePortal(@Query('token') token: string) {
    const data = await this.bookingsService.getConsigneePortal(token);
    return data;
  }

  @Post('consignee/portal/verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyConsigneeOtp(
    @Query('token') token: string,
    @Body('otp') otp: string,
  ) {
    const data = await this.bookingsService.verifyConsigneeOtp(token, otp);
    return {
      success: true,
      ...data,
    };
  }
}

