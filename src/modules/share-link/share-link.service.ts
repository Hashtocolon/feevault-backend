import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as crypto from 'crypto';

@Injectable()
export class ShareLinkService {
  constructor(private readonly db: DatabaseService) {}

  async generateConsigneeShareLink(bookingId: string, userId: string) {
    if (!bookingId) {
      throw new BadRequestException('Booking ID is required');
    }

    // Check in bookings table (primary) or booking_quotes (fallback)
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
    const shareToken = crypto.randomBytes(24).toString('hex');
    const shortCode = crypto.randomBytes(6).toString('base64url');
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000); // 72 hours

    // Update consignee_otp_verifications
    try {
      await this.db.query(
        `INSERT INTO consignee_otp_verifications (booking_id, share_token, expires_at, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (booking_id) DO UPDATE
         SET share_token = EXCLUDED.share_token, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
        [booking.id, shareToken, expiresAt],
      );
    } catch (err: any) {
      console.warn('consignee_otp_verifications insert notice:', err.message);
    }

    // Also update share_token directly on bookings if table exists
    try {
      await this.db.query(
        `UPDATE bookings
         SET share_token = $1, share_token_expires_at = $2, updated_at = NOW()
         WHERE id = $3`,
        [shareToken, expiresAt, booking.id],
      );
    } catch (e) {
      // Ignored if column doesn't exist
    }

    const baseUrl = process.env.APP_BASE_URL || 'https://crte.in';
    const shareUrl = `${baseUrl}/api/v1/consignee/portal?token=${shareToken}`;
    const shortUrl = `${baseUrl}/t/${shortCode}`;

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
