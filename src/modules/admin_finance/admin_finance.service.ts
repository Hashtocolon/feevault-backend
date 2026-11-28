
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import { CreatePayoutBatchDto } from './dto/create-payout-batch.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class AdminFinanceService {
  constructor(private readonly db: DatabaseService) {}

  // API 5.1 - Partner settlement runs and trip ledgers
  async getSettlements() {
    const result = await this.db.query(
      `SELECT
        trip_reference,
        partner,
        gross_freight_inr,
        platform_commission_inr,
        tds_inr,
        fuel_advance_deduction_inr,
        approved_detention_bonus_inr,
        net_payable_inr,
        payout_status
       FROM admin_finance_settlements
       ORDER BY created_at DESC`,
    );

    return result.rows.map((row: any) => ({
      tripReference: row.trip_reference,
      partner: row.partner,
      grossFreightInr: Number(row.gross_freight_inr),
      platformCommissionInr: Number(row.platform_commission_inr),
      tdsInr: Number(row.tds_inr),
      fuelAdvanceDeductionInr: Number(
        row.fuel_advance_deduction_inr,
      ),
      approvedDetentionBonusInr: Number(
        row.approved_detention_bonus_inr,
      ),
      netPayableInr: Number(row.net_payable_inr),
      payoutStatus: row.payout_status,
    }));
  }

  // API 5.2 - Create partner payout batch
  async createPayoutBatch(
    dto: CreatePayoutBatchDto,
    adminId: string,
  ) {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      // Lock eligible settlement rows so they cannot enter
      // two payout batches at the same time.
      const settlementResult = await client.query(
        `SELECT id, partner, net_payable_inr
         FROM admin_finance_settlements
         WHERE payout_status = 'READY_FOR_DISBURSEMENT'
           AND payout_batch_id IS NULL
         FOR UPDATE`,
      );

      const settlements = settlementResult.rows;

      if (settlements.length === 0) {
        throw new BadRequestException(
          'No settlements are ready for disbursement',
        );
      }

      const totalAmount = settlements.reduce(
        (sum: number, row: any) =>
          sum + Number(row.net_payable_inr),
        0,
      );

      const partners = new Set(
        settlements.map((row: any) => row.partner),
      );

      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const batchId = `BATCH-${datePart}-${Date.now()}`;

      const batchResult = await client.query(
        `INSERT INTO admin_finance_payout_batches (
          batch_id,
          settlement_period,
          payout_cycle,
          payout_provider,
          total_partners,
          total_amount_inr,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id`,
        [
          batchId,
          dto.settlementPeriod,
          dto.payoutCycle,
          dto.payoutProvider,
          partners.size,
          totalAmount,
          'QUEUED_FOR_DISBURSEMENT',
          adminId,
        ],
      );

      const batchUuid = batchResult.rows[0].id;

      await client.query(
        `UPDATE admin_finance_settlements
         SET payout_status = 'QUEUED_FOR_DISBURSEMENT',
             payout_batch_id = $1,
             updated_at = NOW()
         WHERE id = ANY($2::uuid[])`,
        [
          batchUuid,
          settlements.map((row: any) => row.id),
        ],
      );

      await client.query('COMMIT');

      return {
        batchId,
        totalPartners: partners.size,
        totalAmountInr: Number(totalAmount.toFixed(2)),
        status: 'QUEUED_FOR_DISBURSEMENT',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // API 5.3 - Trip expense approvals queue
  async getExpenses() {
    const result = await this.db.query(
      `SELECT
        expense_id,
        trip_reference,
        driver,
        expense_type,
        amount_inr,
        receipt_url,
        status
       FROM admin_finance_expenses
       ORDER BY created_at DESC`,
    );

    return result.rows.map((row: any) => ({
      expenseId: row.expense_id,
      tripReference: row.trip_reference,
      driver: row.driver,
      expenseType: row.expense_type,
      amountInr: Number(row.amount_inr),
      receiptUrl: row.receipt_url,
      status: row.status,
    }));
  }

  // API 5.4 - Approve or reject driver expense
  async updateExpense(
    expenseId: string,
    dto: UpdateExpenseDto,
    adminId: string,
  ) {
    const existing = await this.db.query(
      `SELECT id, amount_inr, status
       FROM admin_finance_expenses
       WHERE expense_id = $1`,
      [expenseId],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Expense not found');
    }

    const expense = existing.rows[0];

    if (expense.status !== 'PENDING_FINANCE_APPROVAL') {
      throw new BadRequestException(
        'This expense has already been reviewed',
      );
    }

    let approvedAmount: number | null = null;

    if (dto.status === 'APPROVED') {
      approvedAmount =
        dto.approvedAmountInr ?? Number(expense.amount_inr);

      if (approvedAmount > Number(expense.amount_inr)) {
        throw new BadRequestException(
          'Approved amount cannot exceed the submitted expense amount',
        );
      }
    }

    await this.db.query(
      `UPDATE admin_finance_expenses
       SET status = $1,
           approved_amount_inr = $2,
           finance_note = $3,
           reviewed_by = $4,
           reviewed_at = NOW()
       WHERE expense_id = $5`,
      [
        dto.status,
        approvedAmount,
        dto.financeNote ?? null,
        adminId,
        expenseId,
      ],
    );

    return {
      success: true,
      status: dto.status,
    };
  }
}