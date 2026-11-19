
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { PickupArrivalDto } from './dto/pickup-arrival.dto';

@Injectable()
export class PickupArrivalService {
  constructor(private readonly db: DatabaseService) {}

  async recordArrival(
    tripId: string,
    driverUserId: string,
    dto: PickupArrivalDto,
    photo?: Express.Multer.File,
  ) {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      // Verify that the logged-in driver owns this assignment.
      const assignment = await client.query(
        `SELECT
           a.id,
           a.assignment_status
         FROM fleet_trip_assignments a
         INNER JOIN driver_profiles dp
           ON dp.id = a.driver_id
         WHERE a.trip_id = $1
           AND dp.user_id = $2
         FOR UPDATE OF a`,
        [tripId, driverUserId],
      );

      if (!assignment.rows.length) {
        throw new NotFoundException(
          'Trip assignment not found for this driver',
        );
      }

      if (assignment.rows[0].assignment_status !== 'ACCEPTED') {
        throw new BadRequestException(
          'Driver must confirm the trip assignment first',
        );
      }

      // Verify compartment layout has been confirmed.
      const layout = await client.query(
        `SELECT id, layout_status
         FROM trip_compartment_layouts
         WHERE trip_id = $1
           AND driver_user_id = $2`,
        [tripId, driverUserId],
      );

      if (
        !layout.rows.length ||
        layout.rows[0].layout_status !== 'CONFIRMED'
      ) {
        throw new BadRequestException(
          'Confirm the compartment layout before recording pickup arrival',
        );
      }

      // Validate device timestamp.
      const arrivalTime = new Date(dto.arrivalTimestamp);

      if (Number.isNaN(arrivalTime.getTime())) {
        throw new BadRequestException(
          'Invalid arrival timestamp',
        );
      }

      if (arrivalTime.getTime() > Date.now() + 5 * 60 * 1000) {
        throw new BadRequestException(
          'Arrival timestamp cannot be more than 5 minutes in the future',
        );
      }

      // Prevent duplicate arrival check-in.
      const existing = await client.query(
        `SELECT id
         FROM trip_pickup_arrivals
         WHERE trip_id = $1
         FOR UPDATE`,
        [tripId],
      );

      if (existing.rows.length) {
        throw new BadRequestException(
          'Pickup arrival has already been recorded for this trip',
        );
      }

      // Save arrival and start the server-side detention clock.
      const result = await client.query(
        `INSERT INTO trip_pickup_arrivals (
           trip_id,
           driver_user_id,
           arrival_latitude,
           arrival_longitude,
           arrival_timestamp,
           server_checkin_at,
           odometer_at_pickup_km,
           dock_number,
           arrival_notes,
           shipper_delay_photo_name,
           shipper_delay_photo_type,
           shipper_delay_photo,
           detention_free_window_minutes,
           detention_rate_per_hour_inr
         )
         VALUES (
           $1, $2, $3, $4, $5, NOW(), $6, $7, $8,
           $9, $10, $11, 30, 250
         )
         RETURNING
           id,
           server_checkin_at,
           detention_free_window_minutes,
           detention_rate_per_hour_inr`,
        [
          tripId,
          driverUserId,
          dto.arrivalLatitude,
          dto.arrivalLongitude,
          arrivalTime.toISOString(),
          dto.odometerAtPickupKm,
          dto.dockNumber,
          dto.arrivalNotes || null,
          photo?.originalname || null,
          photo?.mimetype || null,
          photo ? Buffer.from(photo.buffer) : null,
        ],
      );

      await client.query('COMMIT');

      const saved = result.rows[0];

      return {
        success: true,
        message: 'Pickup arrival recorded. Detention clock started.',
        data: {
          tripId,
          arrivalLocationName: null,
          actualDeadheadKm: null,
          detentionFreeWindowMinutes:
            saved.detention_free_window_minutes,
          detentionRatePerHourInr:
            Number(saved.detention_rate_per_hour_inr),
          detentionClockStartedAt:
            saved.server_checkin_at,
          nextStep: 'CARGO_CONDITION_CHECK',
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
