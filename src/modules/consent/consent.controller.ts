import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ConsentService } from './consent.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('consents')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getConsents(@CurrentUser('id') userId: string) {
    return this.consentService.getConsents(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async saveConsents(
    @Body() body: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.consentService.saveConsents(body, userId);
  }
}

