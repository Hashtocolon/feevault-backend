import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as crypto from 'crypto';

@Injectable()
export class ShareLinkService {
  constructor(private readonly db: DatabaseService) { }

  async generateConsigneeShareLink(
    bookingId: string,
    userId: string,
    body: {
      consigneeMobile: string;
      notifyViaSms?: boolean;
      notifyViaWhatsapp?: boolean;
    },
  ) {
    if (!bookingId || !userId) {
      throw new BadRequestException('Booking ID and user ID are required');
    }

    const mobile = body?.consigneeMobile?.trim();

    if (!mobile || !/^\+[1-9]\d{7,14}$/.test(mobile)) {
      throw new BadRequestException(
        'A valid international consignee mobile number is required',
      );
    }

    if (
      (body.notifyViaSms !== undefined &&
        typeof body.notifyViaSms !== 'boolean') ||
      (body.notifyViaWhatsapp !== undefined &&
        typeof body.notifyViaWhatsapp !== 'boolean')
    ) {
      throw new BadRequestException(
        'Notification preferences must be true or false',
      );
    }

    // Verify booking ownership
    const bookingResult = await this.db.query(
      `SELECT b.id, b.booking_ref, b.status
       FROM bookings b
       INNER JOIN customer_profiles cp ON cp.id = b.customer_id
       WHERE b.id::text = $1
         AND cp.user_id::text = $2
       LIMIT 1`,
      [bookingId, userId],
    );

    if (bookingResult.rows.length === 0) {
      throw new NotFoundException(
        'Booking not found or does not belong to this customer',
      );
    }

    const booking = bookingResult.rows[0];

    // Generate secure token
    const shareToken = crypto.randomBytes(24).toString('hex');

    // Link expires after 72 hours
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Save the token on the booking
    const savedBooking = await this.db.query(
      `UPDATE bookings
       SET share_token = $1,
           share_token_expires_at = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id`,
      [shareToken, expiresAt, booking.id],
    );

    if (savedBooking.rows.length === 0) {
      throw new NotFoundException('Unable to save consignee share token');
    }

    // Also save token for existing Consignee OTP functionality
    try {
      await this.db.query(
        `INSERT INTO consignee_otp_verifications
          (booking_id, share_token, expires_at, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (booking_id)
         DO UPDATE SET
           share_token = EXCLUDED.share_token,
           expires_at = EXCLUDED.expires_at,
           updated_at = NOW()`,
        [booking.id, shareToken, expiresAt],
      );
    } catch (err: any) {
      console.warn(
        'Consignee OTP token record could not be updated:',
        err.message,
      );
    }

    const baseUrl = (
      process.env.APP_BASE_URL || 'https://crte.in'
    ).replace(/\/+$/, '');

    const shareUrl =
      `${baseUrl}/api/v1/consignee/portal?token=${shareToken}`;

    // Temporary: use the working portal URL until a short-link
    // redirect and token-mapping mechanism is implemented.
    const shortUrl = shareUrl;

    return {
      success: true,
      bookingId: booking.id,
      bookingRef: booking.booking_ref,
      shareToken,
      shareUrl,
      shortUrl,
      expiresAt: expiresAt.toISOString(),
      smsSent: false,
      whatsappSent: false,
    };
  }
}