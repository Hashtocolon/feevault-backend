import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CreditService } from './credit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @UseGuards(JwtAuthGuard)
  @Post('customer/credit-request')
  async createCreditRequest(
    @Body() body: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.creditService.createCreditRequest(body, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('contracts/link')
  async linkMasterContract(
    @Body('contractId') contractId: string,
    @Body('customerId') customerId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.creditService.linkMasterContract(contractId, customerId, userId);
  }
}

