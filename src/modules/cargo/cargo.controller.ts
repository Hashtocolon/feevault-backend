import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CargoService } from './cargo.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('cargo')
export class CargoController {
  constructor(private readonly cargoService: CargoService) {}

  @UseGuards(JwtAuthGuard)
  @Post('compatibility-check')
  async checkCargoCompatibility(
    @Body() body: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.cargoService.checkCargoCompatibility(body, userId);
  }
}

