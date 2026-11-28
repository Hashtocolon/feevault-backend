
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AdminAuthService } from './admin_auth.service';
import { AdminRegisterDto } from './dto/admin-register.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRefreshDto } from './dto/admin-refresh.dto';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
  ) {}

  // API 1.1 - Register
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: AdminRegisterDto) {
    return this.adminAuthService.register(dto);
  }

  // API 1.2 - Login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  // API 1.3 - Get logged-in admin profile
  @Get('me')
  @UseGuards(AdminJwtAuthGuard)
  getMe(@Req() req: any) {
    return this.adminAuthService.getProfile(req.admin.id);
  }

  // API 1.4 - Refresh access token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: AdminRefreshDto) {
    return this.adminAuthService.refreshAccessToken(dto.refreshToken);
  }

  // API 1.5 - Admin Logout
@Post('logout')
@HttpCode(HttpStatus.OK)
@UseGuards(AdminJwtAuthGuard)
logout(@Req() req: any) {
  return this.adminAuthService.logout(req.admin.id);
}
}
