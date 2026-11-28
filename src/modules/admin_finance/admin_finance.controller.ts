import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AdminJwtAuthGuard } from '../admin_auth/admin-jwt-auth.guard';

import { AdminFinanceService } from './admin_finance.service';

import { CreatePayoutBatchDto } from './dto/create-payout-batch.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('admin/finance')
@UseGuards(AdminJwtAuthGuard)
export class AdminFinanceController {
  constructor(
    private readonly financeService: AdminFinanceService,
  ) {}

  // API 5.1
  @Get('settlements')
  getSettlements() {
    return this.financeService.getSettlements();
  }

  // API 5.2
  @Post('payout-batches')
  createPayoutBatch(
    @Body() dto: CreatePayoutBatchDto,
    @Req() req: any,
  ) {
    return this.financeService.createPayoutBatch(
      dto,
      req.admin.id,
    );
  }

  // API 5.3
  @Get('expenses')
  getExpenses() {
    return this.financeService.getExpenses();
  }

  // API 5.4
  @Patch('expenses/:expenseId')
  updateExpense(
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateExpenseDto,
    @Req() req: any,
  ) {
    return this.financeService.updateExpense(
      expenseId,
      dto,
      req.admin.id,
    );
  }
}