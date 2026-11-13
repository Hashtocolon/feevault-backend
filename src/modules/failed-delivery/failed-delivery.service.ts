import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FailedDeliveryService {
  constructor(private readonly db: DatabaseService) {}

  async submitFailedDeliveryDecision(bookingId: string, decision: string, reason: string, userId: string) {
    const booking = await this.db.query(
      `SELECT id, status FROM booking_quotes WHERE id = $1 AND customer_id = $2`,
      [bookingId, userId],
    );

    if (!booking.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    const validDecisions = ['RETURN', 'REDELIVER', 'DISPOSE'];
    if (!validDecisions.includes(decision)) {
      throw new BadRequestException(`Invalid decision: ${decision}. Must be one of ${validDecisions.join(', ')}`);
    }

    const result = await this.db.query(
      `INSERT INTO failed_delivery_resolutions (booking_id, decided_by, decision, reason, resolved_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (booking_id) DO UPDATE
       SET decision = EXCLUDED.decision, reason = EXCLUDED.reason, resolved_at = NOW()
       RETURNING *`,
      [bookingId, userId, decision, reason || null],
    );

    // Update booking status accordingly
    await this.db.query(
      `UPDATE booking_quotes
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [decision === 'RETURN' ? 'RETURNING_TO_ORIGIN' : 'FAILED_DELIVERY_PENDING', bookingId],
    );

    return {
      success: true,
      resolution: result.rows[0],
      message: `Failed delivery resolution recorded: ${decision}`,
    };
  }
}

