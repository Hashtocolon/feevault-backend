import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';

import type { Response } from 'express';

import { StatementsService } from './statements.service';
import { ExportStatementDto } from './dto/export-statement.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('driver/statements')
@UseGuards(JwtAuthGuard)
export class StatementsController {
  constructor(
    private readonly statementsService: StatementsService,
  ) {}

  // API 36.1
  @Get()
  async getMonthlyStatements(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('month') month: string,
    @Query('status') status = 'ALL',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.statementsService.getMonthlyStatements(
      userId,
      role,
      month,
      status,
      Number(page),
      Number(limit),
    );
  }

  // API 36.2
  @Post('export')
  async exportMonthlyStatement(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: ExportStatementDto,
    @Res() response: Response,
  ) {
    const result =
      await this.statementsService.exportMonthlyStatement(
        userId,
        role,
        dto,
      );

    if (dto.format !== 'CSV') {
      throw new BadRequestException(
        'Only CSV export is currently available',
      );
    }

    const rows = result.data.settlements;

    const headers = [
      'Settlement ID',
      'Trip ID',
      'Completed Date',
      'Lane',
      'Gross Amount INR',
      'Deductions INR',
      'Net Amount INR',
      'Payout Status',
      'UTR Number',
      'Payout Date',
      'Voucher PDF URL',
    ];

    const escapeCsv = (value: unknown) => {
      const text = value === null || value === undefined
        ? ''
        : String(value);

      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) =>
        [
          row.settlementId,
          row.tripId,
          row.completedDate,
          row.lane,
          row.grossAmountInr,
          row.deductionsInr,
          row.netAmountInr,
          row.payoutStatus,
          row.utrNumber,
          row.payoutDate,
          row.voucherPdfUrl,
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ].join('\r\n');

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="statement-${dto.month}.csv"`,
    );

    return response.send('\uFEFF' + csv);
  }
}