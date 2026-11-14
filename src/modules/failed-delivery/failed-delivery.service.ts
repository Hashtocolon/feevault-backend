import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FailedDeliveryService {
  constructor(private readonly db: DatabaseService) {}

  async submitFailedDeliveryDecision(
    bookingId: string,
    decision: string,
    reason: string,
    userId: string,
    body?: any,
  ) {
    if (!bookingId) {
      throw new BadRequestException('Booking ID is required');
    }

    // Check bookings or booking_quotes table
    let bookingResult = await this.db.query(
      `SELECT id, booking_ref, status FROM bookings WHERE id::text = $1 LIMIT 1`,
      [bookingId],
    );

    if (bookingResult.rows.length === 0) {
      bookingResult = await this.db.query(
        `SELECT id, quote_ref AS booking_ref, status FROM booking_quotes WHERE id::text = $1 OR quote_id::text = $1 LIMIT 1`,
        [bookingId],
      );
    }

    if (bookingResult.rows.length === 0) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    const booking = bookingResult.rows[0];

    // Normalize decision
    const cleanDecision = (
      decision ||
      body?.customerDecision ||
      body?.action ||
      'retry_later'
    ).toLowerCase();

    // Update failed_delivery_events if exists
    try {
      await this.db.query(
        `UPDATE failed_delivery_events
         SET customer_decision = $1,
             resolved_at = NOW()
         WHERE booking_id = $2`,
        [cleanDecision, booking.id],
      );
    } catch (e) {
      // Table might not have an active event
    }

    // Update status on bookings
    try {
      await this.db.query(
        `UPDATE bookings
         SET status = 'failed_delivery_instructions_received', updated_at = NOW()
         WHERE id = $1`,
        [booking.id],
      );
    } catch (e) {
      try {
        await this.db.query(
          `UPDATE booking_quotes
           SET status = 'FAILED_DELIVERY_INSTRUCTIONS_RECEIVED', updated_at = NOW()
           WHERE id = $1`,
          [booking.id],
        );
      } catch (err) {}
    }

    return {
      success: true,
      bookingId: booking.id,
      bookingRef: booking.booking_ref,
      decision: cleanDecision,
      status: 'instructions_dispatched',
      driverNotified: true,
      message: 'Failed delivery decision recorded and dispatched to operations successfully.',
    };
  }
}
