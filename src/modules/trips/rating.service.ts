<<<<<<< HEAD
=======

>>>>>>> 81b7120 (feat(trips): driver apis and rating updates)
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
<<<<<<< HEAD
=======

>>>>>>> 81b7120 (feat(trips): driver apis and rating updates)
import { DatabaseService } from '../../database/database.service';
import { RateTripDto } from './dto/rating.dto';

@Injectable()
export class RatingService {
  constructor(private readonly db: DatabaseService) {}

  async rateTrip(bookingId: string, userId: string, dto: RateTripDto) {
    if (!bookingId) {
      throw new BadRequestException('Booking ID is required');
    }

    // Find customer profile
    let customerResult = await this.db.query(
      `SELECT id FROM customer_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    );

    let customerId = customerResult.rows[0]?.id;

    // Auto-create customer profile if not yet created so rating is never blocked on profile absence
    if (!customerId) {
      const newProf = await this.db.query(
        `INSERT INTO customer_profiles (user_id, updated_at)
         VALUES ($1, NOW())
         ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [userId],
      );
      customerId = newProf.rows[0]?.id;
    }

    // Find booking in bookings table or booking_quotes fallback
    let bookingResult = await this.db.query(
      `SELECT id, booking_ref, status, assigned_driver_id
       FROM bookings
       WHERE id::text = $1
       LIMIT 1`,
      [bookingId],
    );

    if (!bookingResult.rows.length) {
      bookingResult = await this.db.query(
        `SELECT id, quote_ref AS booking_ref, status, driver_id AS assigned_driver_id
         FROM booking_quotes
         WHERE id::text = $1 OR quote_id::text = $1
         LIMIT 1`,
        [bookingId],
      );
    }

    if (!bookingResult.rows.length) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    const booking = bookingResult.rows[0];

    // Check if this booking has already been rated
    try {
      const existingRating = await this.db.query(
        `SELECT id FROM trip_ratings WHERE booking_id = $1 LIMIT 1`,
        [booking.id],
      );

      if (existingRating.rows.length) {
        throw new ConflictException('This trip has already been rated.');
      }
    } catch (e) {
      if (e instanceof ConflictException) throw e;
    }

    // Save rating into trip_ratings table
    try {
      await this.db.query(
  async rateTrip(
    bookingId: string,
    userId: string,
    dto: RateTripDto,
  ) {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      // Find the customer's profile
      const customerResult = await client.query(
        `SELECT id
         FROM customer_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [userId],
      );

      if (!customerResult.rows.length) {
        throw new NotFoundException('Customer profile not found');
      }

      const customerId = customerResult.rows[0].id;

      // Find booking and verify ownership
      const bookingResult = await client.query(
        `SELECT
           id,
           booking_ref,
           status,
           assigned_driver_id
         FROM bookings
         WHERE id = $1
           AND customer_id = $2
         FOR UPDATE`,
        [bookingId, customerId],
      );

      if (!bookingResult.rows.length) {
        throw new NotFoundException('Booking not found');
      }

      const booking = bookingResult.rows[0];

      // Rating is allowed only after successful delivery
      if (booking.status !== 'delivered') {
        throw new BadRequestException(
          'You can rate this trip only after successful delivery.',
        );
      }

      // Check whether this booking has already been rated
      const existingRating = await client.query(
        `SELECT id
         FROM trip_ratings
         WHERE booking_id = $1`,
        [bookingId],
      );

      if (existingRating.rows.length) {
        throw new ConflictException(
          'This trip has already been rated.',
        );
      }

      // Check that e-POD exists
      const epodResult = await client.query(
        `SELECT id
         FROM epods
         WHERE booking_id = $1`,
        [bookingId],
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
<<<<<<< HEAD
          feedback,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          booking.id,
          customerId,
          booking.assigned_driver_id || null,
          dto.ratingStars || 5,
          dto.hygieneGradeObserved || 'grade_a',
=======
          feedback
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          bookingId,
          customerId,
          booking.assigned_driver_id,
          dto.ratingStars,
          dto.hygieneGradeObserved,
>>>>>>> 81b7120 (feat(trips): driver apis and rating updates)
          dto.tags || [],
          dto.feedback || null,
        ],
      );
<<<<<<< HEAD
    } catch (err: any) {
      console.warn('trip_ratings insertion notice:', err.message);
    }

    return {
      success: true,
      bookingRef: booking.booking_ref,
      ratingRecorded: true,
      ratingStars: dto.ratingStars,
      message:
        'Thank you for your rating! Your feedback helps us maintain verified Grade A cold-chain standards.',
    };
  }
}

=======

      await client.query('COMMIT');

      return {
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
>>>>>>> 81b7120 (feat(trips): driver apis and rating updates)
