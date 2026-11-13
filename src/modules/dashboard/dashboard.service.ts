import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async getDashboardSummary(userId: string) {
    const [total, active, completed, cancelled] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) FROM booking_quotes WHERE customer_id = $1`,
        [userId],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM booking_quotes
         WHERE customer_id = $1 AND status IN ('CONFIRMED','DRIVER_ASSIGNED','IN_TRANSIT')`,
        [userId],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM booking_quotes
         WHERE customer_id = $1 AND status = 'DELIVERED'`,
        [userId],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM booking_quotes
         WHERE customer_id = $1 AND status = 'CANCELLED'`,
        [userId],
      ),
    ]);

    return {
      summary: {
        totalBookings: parseInt(total.rows[0].count, 10),
        activeBookings: parseInt(active.rows[0].count, 10),
        completedBookings: parseInt(completed.rows[0].count, 10),
        cancelledBookings: parseInt(cancelled.rows[0].count, 10),
      },
    };
  }

  async getActiveShipments(userId: string) {
    const result = await this.db.query(
      `SELECT
         bq.id,
         bq.booking_ref,
         bq.status,
         bq.pickup_address,
         bq.drop_address,
         bq.scheduled_pickup_at,
         bq.actual_pickup_at,
         bq.vehicle_class,
         dp.full_name AS driver_name,
         dp.mobile_number AS driver_mobile,
         v.registration_number AS vehicle_reg,
         t.trip_status,
         t.current_lat,
         t.current_lng,
         t.started_at AS trip_started_at
       FROM booking_quotes bq
       LEFT JOIN driver_profiles dp ON dp.id = bq.driver_id
       LEFT JOIN vehicles v ON v.id = bq.vehicle_id
       LEFT JOIN trips t ON t.booking_id = bq.id
       WHERE bq.customer_id = $1
         AND bq.status IN ('CONFIRMED','DRIVER_ASSIGNED','IN_TRANSIT')
       ORDER BY bq.created_at DESC`,
      [userId],
    );

    return { shipments: result.rows };
  }
}

