import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DispatchService {
  constructor(private readonly db: DatabaseService) {}

  async getDispatchStatus(bookingId: string, userId: string) {
    const result = await this.db.query(
      `SELECT
         bq.id,
         bq.booking_ref,
         bq.status,
         bq.driver_id,
         bq.vehicle_id,
         bq.pickup_address,
         bq.drop_address,
         bq.scheduled_pickup_at,
         bq.actual_pickup_at,
         dp.full_name AS driver_name,
         dp.mobile_number AS driver_mobile,
         dp.profile_photo_url AS driver_photo,
         v.registration_number AS vehicle_reg,
         v.vehicle_class,
         v.make,
         v.model,
         t.id AS trip_id,
         t.trip_status,
         t.started_at AS trip_started_at,
         t.current_lat,
         t.current_lng
       FROM booking_quotes bq
       LEFT JOIN driver_profiles dp ON dp.id = bq.driver_id
       LEFT JOIN vehicles v ON v.id = bq.vehicle_id
       LEFT JOIN trips t ON t.booking_id = bq.id
       WHERE bq.id = $1 AND bq.customer_id = $2`,
      [bookingId, userId],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    return { dispatch: result.rows[0] };
  }

  async cancelBooking(bookingId: string, reason: string, userId: string) {
    const booking = await this.db.query(
      `SELECT id, status FROM booking_quotes WHERE id = $1 AND customer_id = $2`,
      [bookingId, userId],
    );

    if (!booking.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    const { status } = booking.rows[0];
    const cancellableStatuses = ['PENDING', 'QUOTED', 'CONFIRMED', 'DRIVER_ASSIGNED'];

    if (!cancellableStatuses.includes(status)) {
      throw new BadRequestException(`Cannot cancel booking in status: ${status}`);
    }

    await this.db.query(
      `UPDATE booking_quotes
       SET status = 'CANCELLED', cancellation_reason = $1,
           cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND customer_id = $3`,
      [reason, bookingId, userId],
    );

    return { success: true, bookingId, status: 'CANCELLED', reason };
  }

  async escalateOps(bookingId: string, reason: string, note: string, userId: string) {
    const booking = await this.db.query(
      `SELECT id FROM booking_quotes WHERE id = $1 AND customer_id = $2`,
      [bookingId, userId],
    );

    if (!booking.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    await this.db.query(
      `INSERT INTO ops_escalations (booking_id, raised_by, reason, note, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [bookingId, userId, reason, note || null],
    );

    return { success: true, bookingId, message: 'Escalation raised successfully' };
  }

  async getBookingConfirmation(bookingId: string, userId: string) {
    const result = await this.db.query(
      `SELECT
         bq.*,
         dp.full_name AS driver_name,
         dp.mobile_number AS driver_mobile,
         dp.profile_photo_url AS driver_photo,
         v.registration_number AS vehicle_reg,
         v.vehicle_class,
         v.make,
         v.model,
         v.current_temp_c
       FROM booking_quotes bq
       LEFT JOIN driver_profiles dp ON dp.id = bq.driver_id
       LEFT JOIN vehicles v ON v.id = bq.vehicle_id
       WHERE bq.id = $1 AND bq.customer_id = $2`,
      [bookingId, userId],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    return { confirmation: result.rows[0] };
  }

  async generateAgoraToken(bookingId: string, userId: string) {
    const booking = await this.db.query(
      `SELECT id FROM booking_quotes WHERE id = $1 AND customer_id = $2`,
      [bookingId, userId],
    );

    if (!booking.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    // Generate a simple channel token (in production use Agora SDK)
    const channelName = `zoop_${bookingId}`;
    const uid = Math.floor(Math.random() * 100000);
    const token = Buffer.from(`${channelName}:${uid}:${Date.now()}`).toString('base64');

    return {
      channelName,
      uid,
      token,
      appId: process.env.AGORA_APP_ID || 'agora-app-id-placeholder',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  }

  async getChatMessages(bookingId: string, userId: string) {
    const booking = await this.db.query(
      `SELECT id FROM booking_quotes WHERE id = $1 AND customer_id = $2`,
      [bookingId, userId],
    );

    if (!booking.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    const result = await this.db.query(
      `SELECT id, sender_role, message, sent_at, read_at
       FROM chat_messages
       WHERE booking_id = $1
       ORDER BY sent_at ASC`,
      [bookingId],
    );

    return { messages: result.rows, bookingId };
  }
}

