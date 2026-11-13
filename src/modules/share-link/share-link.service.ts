import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as crypto from 'crypto';

@Injectable()
export class ShareLinkService {
  constructor(private readonly db: DatabaseService) {}

  async generateConsigneeShareLink(bookingId: string, userId: string) {
    const booking = await this.db.query(
      `SELECT id, booking_ref FROM booking_quotes WHERE id = $1 AND customer_id = $2`,
      [bookingId, userId],
    );

    if (!booking.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    const shareToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000); // 72 hours

    await this.db.query(
      `INSERT INTO consignee_otp_verifications (booking_id, share_token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (booking_id) DO UPDATE
       SET share_token = EXCLUDED.share_token, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
      [bookingId, shareToken, expiresAt],
    );

    const shareUrl = `${process.env.APP_BASE_URL || 'https://zoop.delivery'}/portal/consignee?token=${shareToken}`;

    return {
      success: true,
      bookingId,
      shareToken,
      shareUrl,
      expiresAt,
    };
  }
}

