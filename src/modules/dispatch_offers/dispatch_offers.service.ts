
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import { AcceptDispatchOfferDto } from './dto/accept-dispatch-offer.dto';
import { DeclineDispatchOfferDto } from './dto/decline-dispatch-offer.dto';

@Injectable()
export class DispatchOffersService {
  constructor(
    private readonly db: DatabaseService,
  ) {}

  // =====================================================
  // API 10.1: ACCEPT DISPATCH JOB OFFER
  // POST /api/v1/driver/trips/:tripId/accept
  // =====================================================

  async acceptOffer(
    userId: string,
    tripId: string,
    dto: AcceptDispatchOfferDto,
  ) {
    if (!tripId?.trim()) {
      throw new BadRequestException(
        'Trip ID is required.',
      );
    }

    // Check driver activation
    const verification = await this.db.query(
      `SELECT section, verification_status
       FROM driver_onboarding_reviews
       WHERE user_id = $1`,
      [userId],
    );

    const requiredSections = [
      'personalKyc',
      'vehicleKyc',
      'hygieneReefer',
      'bankPennyDrop',
      'backgroundCheck',
    ];

    const allVerified = requiredSections.every(
      (section) =>
        verification.rows.some(
          (row: any) =>
            row.section === section &&
            row.verification_status === 'VERIFIED',
        ),
    );

    if (!allVerified) {
      throw new BadRequestException(
        'Your account is not activated. Complete verification before accepting dispatch offers.',
      );
    }

    // Accept only an active, unexpired offer.
    // The partial unique index prevents two drivers
    // from accepting the same trip.
    let result: any;

    try {
      result = await this.db.query(
        `UPDATE driver_dispatch_offers AS offer
         SET
            status = 'ACCEPTED',
            accepted_at = NOW(),
            accepted_at_latitude = $3,
            accepted_at_longitude = $4,
            updated_at = NOW()
         WHERE offer.trip_id = $1
           AND offer.driver_user_id = $2
           AND offer.status = 'OFFERED'
           AND offer.expires_at > NOW()
           AND NOT EXISTS (
             SELECT 1
             FROM driver_dispatch_offers AS accepted
             WHERE accepted.trip_id = offer.trip_id
               AND accepted.status = 'ACCEPTED'
           )
         RETURNING
            offer.trip_id,
            offer.status,
            offer.accepted_at`,
        [
          tripId,
          userId,
          dto.acceptedAtLatitude,
          dto.acceptedAtLongitude,
        ],
      );
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException(
          'This trip has already been accepted by another driver.',
        );
      }

      throw error;
    }

    if (!result.rows.length) {
      // Find out why the offer could not be accepted.
      const offerResult = await this.db.query(
        `SELECT status, expires_at
         FROM driver_dispatch_offers
         WHERE trip_id = $1
           AND driver_user_id = $2
         LIMIT 1`,
        [tripId, userId],
      );

      if (!offerResult.rows.length) {
        throw new NotFoundException(
          'Dispatch offer not found for this driver.',
        );
      }

      const offer = offerResult.rows[0];

      if (new Date(offer.expires_at).getTime() <= Date.now()) {
        await this.db.query(
          `UPDATE driver_dispatch_offers
           SET status = 'EXPIRED',
               updated_at = NOW()
           WHERE trip_id = $1
             AND driver_user_id = $2
             AND status = 'OFFERED'`,
          [tripId, userId],
        );

        throw new BadRequestException(
          'This dispatch offer has expired.',
        );
      }

      if (offer.status !== 'OFFERED') {
        throw new BadRequestException(
          `This offer cannot be accepted. Current status: ${offer.status}.`,
        );
      }

      throw new ConflictException(
        'This trip has already been accepted by another driver.',
      );
    }

    // Stop other outstanding offers for this trip.
    await this.db.query(
      `UPDATE driver_dispatch_offers
       SET status = 'CANCELLED',
           updated_at = NOW()
       WHERE trip_id = $1
         AND driver_user_id <> $2
         AND status = 'OFFERED'`,
      [tripId, userId],
    );

    return {
      success: true,
      message:
        `Trip ${tripId} accepted successfully! Navigation and Pre-Trip checklist unlocked.`,
      data: {
        tripId,
        status: 'ACCEPTED',
        nextStep: 'PRE_TRIP_INSPECTION',
      },
    };
  }

  // =====================================================
  // API 10.2: DECLINE DISPATCH JOB OFFER
  // POST /api/v1/driver/trips/:tripId/decline
  // =====================================================

  async declineOffer(
    userId: string,
    tripId: string,
    dto: DeclineDispatchOfferDto,
  ) {
    if (!tripId?.trim()) {
      throw new BadRequestException(
        'Trip ID is required.',
      );
    }

    const result = await this.db.query(
      `UPDATE driver_dispatch_offers
       SET
          status = 'OFFER_DECLINED',
          decline_reason = $3,
          decline_remarks = $4,
          updated_at = NOW()
       WHERE trip_id = $1
         AND driver_user_id = $2
         AND status = 'OFFERED'
         AND expires_at > NOW()
       RETURNING trip_id, status`,
      [
        tripId,
        userId,
        dto.declineReason,
        dto.declineRemarks?.trim() || null,
      ],
    );

    if (!result.rows.length) {
      const existing = await this.db.query(
        `SELECT status, expires_at
         FROM driver_dispatch_offers
         WHERE trip_id = $1
           AND driver_user_id = $2
         LIMIT 1`,
        [tripId, userId],
      );

      if (!existing.rows.length) {
        throw new NotFoundException(
          'Dispatch offer not found for this driver.',
        );
      }

      if (
        new Date(existing.rows[0].expires_at).getTime() <=
        Date.now()
      ) {
        await this.db.query(
          `UPDATE driver_dispatch_offers
           SET status = 'EXPIRED',
               updated_at = NOW()
           WHERE trip_id = $1
             AND driver_user_id = $2
             AND status = 'OFFERED'`,
          [tripId, userId],
        );

        throw new BadRequestException(
          'This dispatch offer has expired.',
        );
      }

      throw new BadRequestException(
        `This offer cannot be declined. Current status: ${existing.rows[0].status}.`,
      );
    }

    return {
      success: true,
      message:
        'Offer declined. The trip has been released for reassignment.',
      data: {
        tripId,
        status: 'OFFER_DECLINED',
      },
    };
  }
}
