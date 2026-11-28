import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { ExportStatementDto } from './dto/export-statement.dto';

@Injectable()
export class StatementsService {
  constructor(private readonly db: DatabaseService) {}

  private getAccessCondition(role: string, userId: string) {
    const normalizedRole = String(role || '').toUpperCase();

    if (normalizedRole === 'DRIVER') {
      return {
        condition: 'driver_user_id = $2',
        params: [userId],
      };
    }

    if (
      normalizedRole === 'FLEET_OWNER' ||
      normalizedRole === 'OWNER_CUM_DRIVER'
    ) {
      return {
        condition: 'fleet_owner_user_id = $2',
        params: [userId],
      };
    }

    throw new ForbiddenException(
      'Only drivers and fleet owners can access statements',
    );
  }

  private validateMonth(month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
      throw new BadRequestException(
        'Month must be in YYYY-MM format',
      );
    }
  }

  private getDeductionExpression() {
    return `
      (
        COALESCE(platform_commission_inr, 0) +
        COALESCE(tds_inr, 0) +
        COALESCE(fuel_advance_deducted_inr, 0) +
        COALESCE(disputed_hold_amount_inr, 0)
      )
    `;
  }

  private getGrossExpression() {
    return `
      (
        COALESCE(base_freight_inr, 0) +
        COALESCE(reefer_surcharge_inr, 0) +
        COALESCE(approved_tolls_inr, 0) +
        COALESCE(approved_expenses_inr, 0) +
        COALESCE(detention_compensation_inr, 0) +
        COALESCE(temp_compliance_bonus_inr, 0)
      )
    `;
  }

  private getNetExpression() {
    return `(${this.getGrossExpression()} - ${this.getDeductionExpression()})`;
  }

  private getStatusCondition(status: string, parameterIndex: number) {
    if (status === 'ALL') {
      return { sql: '', values: [] };
    }

    if (status === 'PROCESSING') {
      return {
        sql: `AND payout_status IN ($${parameterIndex}, $${parameterIndex + 1})`,
        values: ['INITIATED', 'SCHEDULED'],
      };
    }

    return {
      sql: `AND payout_status = $${parameterIndex}`,
      values: [status],
    };
  }

  async getMonthlyStatements(
    userId: string,
    role: string,
    month: string,
    status = 'ALL',
    page = 1,
    limit = 20,
  ) {
    this.validateMonth(month);

    const allowedStatuses = [
      'ALL',
      'PAID',
      'ON_HOLD',
      'PROCESSING',
    ];

    status = String(status).toUpperCase();

    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(
        'Status must be ALL, PAID, ON_HOLD or PROCESSING',
      );
    }

    page = Number(page);
    limit = Number(limit);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'Page must be positive and limit must be between 1 and 100',
      );
    }

    const access = this.getAccessCondition(role, userId);
    const startDate = `${month}-01`;
    const offset = (page - 1) * limit;

    const statusFilter = this.getStatusCondition(status, 3);

    const baseParams = [
  startDate,
  userId,
  ...statusFilter.values,
];

    const filterSql = `
      WHERE completed_at >= $1::date
        AND completed_at < ($1::date + INTERVAL '1 month')
        AND ${access.condition}
        ${statusFilter.sql}
    `;

    const summaryResult = await this.db.query(
      `
      SELECT
        COALESCE(SUM(
          CASE WHEN payout_status = 'PAID'
          THEN ${this.getNetExpression()}
          ELSE 0 END
        ), 0) AS total_net_payout_inr,

        COUNT(*) FILTER (
          WHERE payout_status IN ('PAID', 'ON_HOLD', 'SCHEDULED', 'INITIATED')
        ) AS completed_trips_count,

        COALESCE(SUM(
          CASE WHEN payout_status IN ('ON_HOLD', 'INITIATED', 'SCHEDULED')
          THEN GREATEST(${this.getNetExpression()}, 0)
          ELSE 0 END
        ), 0) AS pending_on_hold_amount_inr,

        COALESCE(SUM(
          CASE WHEN payout_status IN ('PAID', 'ON_HOLD', 'INITIATED', 'SCHEDULED')
          THEN COALESCE(tds_inr, 0)
          ELSE 0 END
        ), 0) AS total_tds_deducted_inr

      FROM trip_settlements
      ${filterSql}
      `,
      baseParams,
    );

    const summary = summaryResult.rows[0];

    const countResult = await this.db.query(
      `
      SELECT COUNT(*) AS total_records
      FROM trip_settlements
      ${filterSql}
      `,
      baseParams,
    );

    const totalRecords = Number(countResult.rows[0].total_records);
    const totalPages = Math.ceil(totalRecords / limit);

    const settlementsResult = await this.db.query(
      `
      SELECT
        settlement_id,
        trip_id,
        completed_at,
        route,
        ${this.getGrossExpression()} AS gross_amount_inr,
        ${this.getDeductionExpression()} AS deductions_inr,
        ${this.getNetExpression()} AS net_amount_inr,
        payout_status,
        payout_utr_number,
        payout_processed_at,
        settlement_pdf_download_url

      FROM trip_settlements
      ${filterSql}
      ORDER BY completed_at DESC
      LIMIT $${baseParams.length + 1}
      OFFSET $${baseParams.length + 2}
      `,
      [...baseParams, limit, offset],
    );

    const settlements = settlementsResult.rows.map((row) => ({
      settlementId: row.settlement_id,
      tripId: row.trip_id,
      completedDate: row.completed_at
        ? new Date(row.completed_at).toISOString().slice(0, 10)
        : null,
      lane: row.route,
      grossAmountInr: Number(row.gross_amount_inr || 0),
      deductionsInr: Number(row.deductions_inr || 0),
      netAmountInr: Number(row.net_amount_inr || 0),
      payoutStatus: row.payout_status,
      utrNumber: row.payout_utr_number,
      payoutDate: row.payout_processed_at,
      voucherPdfUrl: row.settlement_pdf_download_url,
    }));

    const completedTripsCount = Number(
      summary.completed_trips_count || 0,
    );

    const totalNetPayout = Number(
      summary.total_net_payout_inr || 0,
    );

    return {
      success: true,
      data: {
        month,
        summary: {
          totalNetPayoutInr: totalNetPayout,
          completedTripsCount,
          averageTripEarningInr:
            completedTripsCount > 0
              ? Number(
                  (totalNetPayout / completedTripsCount).toFixed(2),
                )
              : 0,
          totalTdsDeductedInr: Number(
            summary.total_tds_deducted_inr || 0,
          ),
          pendingOnHoldAmountInr: Number(
            summary.pending_on_hold_amount_inr || 0,
          ),
        },
        settlements,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
        },
      },
    };
  }

  async exportMonthlyStatement(
    userId: string,
    role: string,
    dto: ExportStatementDto,
  ) {
    this.validateMonth(dto.month);

    const result = await this.getMonthlyStatements(
      userId,
      role,
      dto.month,
      'ALL',
      1,
      100,
    );

    if (result.data.pagination.totalRecords > 100) {
      throw new BadRequestException(
        'This export contains more than 100 trips. Use CSV pagination or increase the export limit.',
      );
    }

    if (dto.format === 'PDF') {
      throw new BadRequestException(
        'PDF generation and cloud download storage are not configured yet. CSV export is available.',
      );
    }

    return result;
  }
}