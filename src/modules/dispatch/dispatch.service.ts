import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as crypto from 'crypto';

@Injectable()
export class DispatchService {
  constructor(private readonly db: DatabaseService) {}

  private async resolveBooking(bookingId: string, userId?: string) {
    if (!bookingId) return null;

    // 1. Try finding in bookings by id
    const byId = await this.db.query(
      `SELECT b.*, d.user_id AS driver_user_id
       FROM bookings b
       LEFT JOIN drivers d ON d.id = b.assigned_driver_id
       WHERE b.id::text = $1
       LIMIT 1`,
      [bookingId],
    );
    if (byId.rows.length) return byId.rows[0];

    // 2. Try finding in booking_quotes by id or quote_id
    const byQuote = await this.db.query(
      `SELECT bq.*, bq.quote_ref AS booking_ref
       FROM booking_quotes bq
       WHERE bq.id::text = $1 OR bq.quote_id::text = $1
       LIMIT 1`,
      [bookingId],
    );
    if (byQuote.rows.length) return byQuote.rows[0];

    return null;
  }

  async getDispatchStatus(bookingId: string, userId: string) {
    const booking = await this.resolveBooking(bookingId, userId);
    if (!booking) {
      throw new NotFoundException('Booking was not found.');
    }

    const details = await this.db.query(
      `SELECT
         b.id,
         b.booking_ref,
         b.status::text AS booking_status,
         b.created_at,
         b.assigned_driver_id,
         b.assigned_vehicle_id,
         b.target_setpoint_c,
         b.is_precooling_passed,
         d.id AS driver_id,
         d.full_name AS driver_name,
         d.mobile_number AS driver_phone,
         d.avatar_url AS driver_photo,
         d.hygiene_grade::text AS hygiene_grade,
         d.average_rating,
         d.trips_completed,
         v.registration_number,
         v.vehicle_class::text AS vehicle_class,
         ts.chamber_temp_c
       FROM bookings b
       LEFT JOIN drivers d ON d.id = b.assigned_driver_id
       LEFT JOIN vehicles v ON v.id = b.assigned_vehicle_id
       LEFT JOIN LATERAL (
         SELECT chamber_temp_c
         FROM telematics_snapshots
         WHERE booking_id = b.id
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ts ON TRUE
       WHERE b.id::text = $1
       LIMIT 1`,
      [booking.id],
    );

    const b = details.rows[0] || booking;
    let status = b.booking_status || b.status;
    if (status === 'searching') status = 'searching_driver';
    if (status === 'assigned') status = 'driver_assigned';

    let timeRemainingSeconds = 0;
    if (b.booking_status === 'searching' && b.created_at) {
      const elapsed = Math.floor((Date.now() - new Date(b.created_at).getTime()) / 1000);
      timeRemainingSeconds = Math.max(0, 90 - elapsed);
    }

    let assignedDriver: any = null;
    if (b.assigned_driver_id && b.driver_name) {
      assignedDriver = {
        id: b.driver_id || b.assigned_driver_id,
        name: b.driver_name,
        phone: b.driver_phone,
        photoUrl: b.driver_photo,
        hygieneGrade: b.hygiene_grade,
        rating: b.average_rating ? Number(b.average_rating) : 4.8,
        tripsCompleted: b.trips_completed ? Number(b.trips_completed) : 0,
        vehicle: {
          registrationNumber: b.registration_number,
          vehicleClass: b.vehicle_class,
        },
      };
    }

    return {
      status,
      bookingRef: b.booking_ref,
      timeRemainingSeconds,
      eligibleDriversCount: assignedDriver ? 1 : 0,
      assignedDriver,
      chamberTempC: b.chamber_temp_c !== undefined ? b.chamber_temp_c : null,
      targetSetpointC: b.target_setpoint_c,
      isPrecoolingPassed: b.is_precooling_passed,
    };
  }

  async cancelBooking(bookingId: string, reason: string, userId: string) {
    const booking = await this.resolveBooking(bookingId, userId);
    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    await this.db.query(
      `UPDATE bookings
       SET status = 'cancelled', cancellation_reason = $1, cancelled_at = NOW(), updated_at = NOW()
       WHERE id::text = $2`,
      [reason || 'Cancelled by customer', booking.id],
    );

    return {
      success: true,
      bookingId: booking.id,
      bookingRef: booking.booking_ref,
      status: 'cancelled',
      message: 'Booking cancelled successfully.',
    };
  }

  async escalateOps(bookingId: string, reason: string, note: string, userId: string) {
    const booking = await this.resolveBooking(bookingId, userId);
    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    try {
      await this.db.query(
        `INSERT INTO ops_escalations (booking_id, raised_by, reason, note, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [booking.id, userId, reason || 'Escalation raised', note || null],
      );
    } catch (e: any) {
      console.warn('ops_escalations insert notice:', e.message);
    }

    return {
      success: true,
      bookingId: booking.id,
      bookingRef: booking.booking_ref,
      message: 'Escalation raised with ColdRoute operations desk.',
    };
  }

  async getBookingConfirmation(bookingId: string, userId: string) {
    if (!bookingId) {
      throw new BadRequestException('A valid booking ID is required.');
    }

    // 1. Try finding in bookings table first
    const confRes = await this.db.query(
      `SELECT
         b.id,
         b.booking_ref,
         b.lr_number,
         b.status,
         b.sub_status_label,
         b.target_setpoint_c,
         b.is_precooling_passed,
         b.precooling_verified_temp_c,
         b.pickup_window_start,
         d.id AS driver_id,
         d.full_name AS driver_name,
         d.avatar_url,
         d.hygiene_grade,
         d.average_rating,
         d.trips_completed,
         v.registration_number,
         v.vehicle_class,
         ts.chamber_temp_c,
         ts.probe_temp_c,
         ts.recorded_at
       FROM bookings b
       LEFT JOIN drivers d ON d.id = b.assigned_driver_id
       LEFT JOIN vehicles v ON v.id = b.assigned_vehicle_id
       LEFT JOIN LATERAL (
         SELECT chamber_temp_c, probe_temp_c, recorded_at
         FROM telematics_snapshots
         WHERE booking_id = b.id
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ts ON TRUE
       WHERE b.id::text = $1`,
      [bookingId],
    );

    if (confRes.rows.length) {
      const row = confRes.rows[0];
      return {
        bookingId: row.id,
        bookingRef: row.booking_ref,
        lrNumber: row.lr_number,
        status: row.status,
        subStatusLabel: row.sub_status_label,
        targetSetpointC: row.target_setpoint_c,
        isPrecoolingPassed: row.is_precooling_passed,
        precoolingVerifiedTempC: row.precooling_verified_temp_c,
        pickupWindowStart: row.pickup_window_start,
        driver: row.driver_name
          ? {
              id: row.driver_id,
              name: row.driver_name,
              avatarUrl: row.avatar_url,
              hygieneGrade: row.hygiene_grade,
              averageRating: row.average_rating ? Number(row.average_rating) : 4.8,
              tripsCompleted: row.trips_completed ? Number(row.trips_completed) : 0,
            }
          : null,
        vehicle: row.registration_number
          ? {
              registrationNumber: row.registration_number,
              vehicleClass: row.vehicle_class,
            }
          : null,
        latestTelematics:
          row.chamber_temp_c !== undefined
            ? {
                chamberTempC: row.chamber_temp_c,
                probeTempC: row.probe_temp_c,
                recordedAt: row.recorded_at,
              }
            : null,
      };
    }

    // 2. Fallback to booking_quotes table
    const quoteRes = await this.db.query(
      `SELECT bq.*, bq.quote_ref AS booking_ref
       FROM booking_quotes bq
       WHERE bq.id::text = $1 OR bq.quote_id::text = $1`,
      [bookingId],
    );

    if (!quoteRes.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    const q = quoteRes.rows[0];
    return {
      bookingId: q.id,
      bookingRef: q.booking_ref,
      status: q.status,
      driver: null,
      vehicle: null,
      latestTelematics: null,
    };
  }

  async generateAgoraToken(bookingId: string, userId: string) {
    const booking = await this.resolveBooking(bookingId, userId);
    if (!booking) {
      throw new NotFoundException('Booking not found for this customer.');
    }

    const channelName =
      'call_trip_' + String(booking.booking_ref || bookingId).replace(/[^a-zA-Z0-9]/g, '');

    const getAgoraUid = (id: string) => {
      const hash = crypto.createHash('sha256').update(String(id)).digest();
      return hash.readUInt32BE(0) || 1;
    };

    const uid = getAgoraUid(userId || 'customer');
    const peerUid = booking.driver_user_id
      ? getAgoraUid(booking.driver_user_id)
      : (uid === 10001 ? 10002 : 10001);

    const appId = process.env.AGORA_APP_ID || 'agora-app-id-dev-placeholder';
    const expiresInSeconds = 3600;

    const tokenPayload = `${appId}:${channelName}:${uid}:${Date.now() + expiresInSeconds * 1000}`;
    const rtcToken = Buffer.from(tokenPayload).toString('base64');

    return {
      agoraAppId: appId,
      channelName,
      rtcToken,
      uid,
      peerUid,
      expiresInSeconds,
    };
  }

  async getChatMessages(bookingId: string, userId: string) {
    const booking = await this.resolveBooking(bookingId, userId);
    if (!booking) {
      throw new NotFoundException('Booking not found for this customer.');
    }

    let messages: any[] = [];
    try {
      const msgRes = await this.db.query(
        `SELECT
           m.id,
           m.sender_type,
           m.message_text,
           m.sent_at,
           CASE
             WHEN LOWER(m.sender_type) = 'driver' THEN COALESCE(d.full_name, 'Driver')
             ELSE 'Customer'
           END AS sender_name
         FROM trip_chat_messages m
         LEFT JOIN bookings b ON b.id = m.booking_id
         LEFT JOIN drivers d ON d.id = b.assigned_driver_id
         WHERE m.booking_id = $1
         ORDER BY m.sent_at ASC`,
        [booking.id],
      );
      messages = msgRes.rows;
    } catch (e) {
      try {
        const fallback = await this.db.query(
          `SELECT id, sender_role AS sender_type, message AS message_text, sent_at
           FROM chat_messages
           WHERE booking_id = $1
           ORDER BY sent_at ASC`,
          [booking.id],
        );
        messages = fallback.rows;
      } catch (err) {}
    }

    return {
      bookingId: booking.id,
      bookingRef: booking.booking_ref,
      messages,
    };
  }
}
