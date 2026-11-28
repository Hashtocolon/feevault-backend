
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { RateTripDto } from './dto/rating.dto';

@Injectable()
export class RatingService {
  constructor(private readonly db: DatabaseService) {}

  async rateTrip(
    bookingId: string,
    userId: string,
    dto: RateTripDto,
  ) {

    if (!bookingId) {
      throw new BadRequestException('Booking ID is required');
    }


    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');


      // Find customer profile
      let customerResult = await client.query(

        `SELECT id
         FROM customer_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [userId],
      );


      let customerId = customerResult.rows[0]?.id;

      // Create customer profile if it does not exist
      if (!customerId) {
        const newProfile = await client.query(
          `INSERT INTO customer_profiles (user_id, updated_at)
           VALUES ($1, NOW())
           ON CONFLICT (user_id)
           DO UPDATE SET updated_at = NOW()
           RETURNING id`,
          [userId],
        );

        customerId = newProfile.rows[0]?.id;
      }

      if (!customerId) {
        throw new NotFoundException('Customer profile not found');
      }


      // Find booking and verify ownership
      const bookingResult = await client.query(
        `SELECT
           id,
           booking_ref,
           status,
           assigned_driver_id
         FROM bookings

         WHERE id::text = $1

           AND customer_id = $2
         FOR UPDATE`,
        [bookingId, customerId],
      );

      if (!bookingResult.rows.length) {
        throw new NotFoundException('Booking not found');
      }

      const booking = bookingResult.rows[0];


      // Rating allowed only after successful delivery

      if (booking.status !== 'delivered') {
        throw new BadRequestException(
          'You can rate this trip only after successful delivery.',
        );
      }


      // Check existing rating
      const existingRating = await client.query(
        `SELECT id
         FROM trip_ratings
         WHERE booking_id = $1
         LIMIT 1`,
        [booking.id],

      );

      if (existingRating.rows.length) {
        throw new ConflictException(
          'This trip has already been rated.',
        );
      }


      // Check e-POD
      const epodResult = await client.query(
        `SELECT id
         FROM epods
         WHERE booking_id = $1
         LIMIT 1`,
        [booking.id],

      );

      if (!epodResult.rows.length) {
        throw new BadRequestException(
          'Rating is available only after e-POD generation.',
        );
      }

      // Save rating
      await client.query(
        `INSERT INTO trip_ratings (
          booking_id,
          customer_id,
          driver_id,
          rating_stars,
          hygiene_grade_observed,
          tags,

          feedback,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          booking.id,
          customerId,
          booking.assigned_driver_id || null,

          dto.ratingStars,
          dto.hygieneGradeObserved,
          dto.tags || [],
          dto.feedback || null,
        ],
      );

      await client.query('COMMIT');

      return {

        success: true,

        bookingRef: booking.booking_ref,
        ratingRecorded: true,
        ratingStars: dto.ratingStars,
        message:
          'Thank you for your rating! Your feedback helps us maintain verified Grade A cold-chain standards.',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
