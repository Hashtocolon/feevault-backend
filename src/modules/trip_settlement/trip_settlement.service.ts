import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class TripSettlementService {
  constructor(private readonly db: DatabaseService) {}

  async getTripSettlement(
    tripId: string,
    userId: string,
    userRole: string,
  ) {
    if (!tripId || !userId) {
      throw new BadRequestException('Trip ID and user ID are required');
    }

    const result = await this.db.query(
      `
      SELECT
        trip_id,
        driver_user_id,
        fleet_owner_user_id,
        route,
        completed_at,
        distance_km,
        vehicle_number,

        base_freight_inr,
        reefer_surcharge_inr,
        approved_tolls_inr,
        approved_expenses_inr,
        detention_compensation_inr,
        temp_compliance_bonus_inr,

        platform_commission_percent,
        fuel_advance_deducted_inr,
        disputed_hold_amount_inr,

        payout_status,
        payout_method,
        payout_utr_number,
        beneficiary_bank,
        payout_processed_at,
        settlement_pdf_download_url,

        temp_compliance_percent,
        hygiene_rating,
        on_time_delivery,

        (
          base_freight_inr +
          reefer_surcharge_inr +
          approved_tolls_inr +
          approved_expenses_inr +
          detention_compensation_inr +
          temp_compliance_bonus_inr
        ) AS gross_earnings_inr,

        ROUND(
          (
            base_freight_inr +
            reefer_surcharge_inr +
            approved_tolls_inr +
            approved_expenses_inr +
            detention_compensation_inr +
            temp_compliance_bonus_inr
          ) * platform_commission_percent / 100,
          2
        ) AS calculated_commission_inr,

        ROUND(
          (
            base_freight_inr +
            reefer_surcharge_inr +
            approved_tolls_inr +
            approved_expenses_inr +
            detention_compensation_inr +
            temp_compliance_bonus_inr
          ) * 0.01,
          2
        ) AS calculated_tds_inr

      FROM trip_settlements
      WHERE trip_id = $1
      LIMIT 1
      `,
      [tripId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(
        'Settlement not found for this trip',
      );
    }

    const settlement = result.rows[0];

    const role = String(userRole || '').toUpperCase();

    if (role === 'DRIVER') {
      if (settlement.driver_user_id !== userId) {
        throw new ForbiddenException(
          'You are not authorized to view this trip settlement',
        );
      }
    } else if (
      role === 'FLEET_OWNER' ||
      role === 'OWNER_CUM_DRIVER'
    ) {
      if (settlement.fleet_owner_user_id !== userId) {
        throw new ForbiddenException(
          'You are not authorized to view this trip settlement',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only drivers and fleet owners can view trip settlements',
      );
    }

    const gross = Number(settlement.gross_earnings_inr || 0);
    const commission = Number(
      settlement.calculated_commission_inr || 0,
    );
    const tds = Number(settlement.calculated_tds_inr || 0);
    const fuelAdvance = Number(
      settlement.fuel_advance_deducted_inr || 0,
    );
    const disputedHold = Number(
      settlement.disputed_hold_amount_inr || 0,
    );

    const totalDeductions =
      commission + tds + fuelAdvance + disputedHold;

    const netPayable = Number(
      (gross - totalDeductions).toFixed(2),
    );

    return {
      success: true,
      data: {
        tripId: settlement.trip_id,
        route: settlement.route,
        completedAt: settlement.completed_at,
        distanceKm: Number(settlement.distance_km || 0),
        vehicleNumber: settlement.vehicle_number,

        commercials: {
          baseFreightInr: Number(
            settlement.base_freight_inr || 0,
          ),
          reeferSurchargeInr: Number(
            settlement.reefer_surcharge_inr || 0,
          ),
          approvedTollsInr: Number(
            settlement.approved_tolls_inr || 0,
          ),
          approvedExpensesInr: Number(
            settlement.approved_expenses_inr || 0,
          ),
          detentionCompensationInr: Number(
            settlement.detention_compensation_inr || 0,
          ),
          tempComplianceBonusInr: Number(
            settlement.temp_compliance_bonus_inr || 0,
          ),
          grossEarningsInr: gross,
        },

        deductions: {
          platformCommissionInr: commission,
          platformCommissionPercent: Number(
            settlement.platform_commission_percent || 0,
          ),
          tdsInr: tds,
          tdsSection: 'Section 194C (1%)',
          fuelAdvanceDeductedInr: fuelAdvance,
          disputedHoldAmountInr: disputedHold,
          totalDeductionsInr: Number(
            totalDeductions.toFixed(2),
          ),
        },

        settlement: {
          netPayableInr: netPayable,
          payoutStatus: settlement.payout_status,
          payoutMethod: settlement.payout_method,
          payoutUtrNumber: settlement.payout_utr_number,
          beneficiaryBank: settlement.beneficiary_bank,
          payoutProcessedAt: settlement.payout_processed_at,
          settlementPdfDownloadUrl:
            settlement.settlement_pdf_download_url,
        },

        complianceScore: {
          tempCompliancePercent: Number(
            settlement.temp_compliance_percent || 0,
          ),
          hygieneRating: settlement.hygiene_rating,
          onTimeDelivery: settlement.on_time_delivery,
        },
      },
    };
  }
}