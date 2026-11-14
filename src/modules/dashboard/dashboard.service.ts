import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async getDashboardSummary(userId: string) {
    if (!userId) {
      return {
        summary: {
          totalBookings: 0,
          activeBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
        },
      };
    }

    try {
      const [total, active, completed, cancelled] = await Promise.all([
        this.db.query(
          `SELECT COUNT(*) FROM booking_quotes WHERE customer_id::text = $1`,
          [userId],
        ),
        this.db.query(
          `SELECT COUNT(*) FROM booking_quotes
           WHERE customer_id::text = $1 AND status IN ('CONFIRMED','DRIVER_ASSIGNED','IN_TRANSIT','searching','assigned','in_transit')`,
          [userId],
        ),
        this.db.query(
          `SELECT COUNT(*) FROM booking_quotes
           WHERE customer_id::text = $1 AND status IN ('DELIVERED','completed')`,
          [userId],
        ),
        this.db.query(
          `SELECT COUNT(*) FROM booking_quotes
           WHERE customer_id::text = $1 AND status IN ('CANCELLED','cancelled')`,
          [userId],
        ),
      ]);

      return {
        summary: {
          totalBookings: parseInt(total.rows[0]?.count || '0', 10),
          activeBookings: parseInt(active.rows[0]?.count || '0', 10),
          completedBookings: parseInt(completed.rows[0]?.count || '0', 10),
          cancelledBookings: parseInt(cancelled.rows[0]?.count || '0', 10),
        },
      };
    } catch (e) {
      return {
        summary: {
          totalBookings: 0,
          activeBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
        },
      };
    }
  }

  async getActiveShipments(userId: string) {
    if (!userId) {
      return { totalActiveCount: 0, shipments: [] };
    }

    try {
      // Find customer profile id if exists
      const profRes = await this.db.query(
        `SELECT id FROM customer_profiles WHERE user_id::text = $1 LIMIT 1`,
        [userId],
      );
      const customerId = profRes.rows[0]?.id;

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
           bq.created_at
         FROM booking_quotes bq
         WHERE (bq.customer_id::text = $1 OR ($2::uuid IS NOT NULL AND bq.customer_id = $2))
           AND bq.status IN ('CONFIRMED','DRIVER_ASSIGNED','IN_TRANSIT','searching','assigned','in_transit','at_pickup','loading')
         ORDER BY bq.created_at DESC`,
        [userId, customerId || null],
      );

      return {
        totalActiveCount: result.rows.length,
        shipments: result.rows.map((row) => ({
          id: row.id,
          bookingRef: row.booking_ref,
          status: row.status,
          pickupAddress: row.pickup_address,
          dropAddress: row.drop_address,
          scheduledPickupAt: row.scheduled_pickup_at,
          actualPickupAt: row.actual_pickup_at,
          vehicleClass: row.vehicle_class,
          createdAt: row.created_at,
        })),
      };
    } catch (err) {
      console.warn('Dashboard active shipments query error:', err.message);
      return { totalActiveCount: 0, shipments: [] };
    }
  }
}
