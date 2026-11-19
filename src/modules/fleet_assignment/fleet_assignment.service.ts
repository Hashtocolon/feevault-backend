
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { AssignFleetTripDto } from './dto/assign-fleet-trip.dto';
import { ConfirmAssignmentDto } from './dto/confirm-assignment.dto';

@Injectable()
export class FleetAssignmentService {
  constructor(private readonly db: DatabaseService) {}

  // API 11.1: Fleet owner assigns vehicle and driver
  async assignTrip(
    tripId: string,
    fleetOwnerId: string,
    dto: AssignFleetTripDto,
  ) {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      // Find booking using booking reference
      const bookingResult = await client.query(
        `SELECT id, booking_ref, status
         FROM booking_quotes
         WHERE booking_ref = $1
         FOR UPDATE`,
        [tripId],
      );

      if (!bookingResult.rows.length) {
        throw new NotFoundException('Trip not found');
      }

      const booking = bookingResult.rows[0];

      if (
        ['CANCELLED', 'COMPLETED'].includes(
          String(booking.status).toUpperCase(),
        )
      ) {
        throw new BadRequestException(
          `Cannot assign a trip with status: ${booking.status}`,
        );
      }

      // Verify vehicle
      const vehicleResult = await client.query(
        `SELECT id, registration_number
         FROM vehicles
         WHERE id = $1`,
        [dto.vehicleId],
      );

      if (!vehicleResult.rows.length) {
        throw new NotFoundException('Vehicle not found');
      }

      // Verify driver
      const driverResult = await client.query(
        `SELECT id, full_name
         FROM driver_profiles
         WHERE id = $1`,
        [dto.driverId],
      );

      if (!driverResult.rows.length) {
        throw new NotFoundException('Driver not found');
      }

      // Check existing assignment
      const existing = await client.query(
        `SELECT id, assignment_status
         FROM fleet_trip_assignments
         WHERE trip_id = $1
         FOR UPDATE`,
        [tripId],
      );

      if (
        existing.rows.length &&
        existing.rows[0].assignment_status ===
          'AWAITING_DRIVER_CONFIRMATION'
      ) {
        throw new BadRequestException(
          'This trip is already awaiting driver confirmation',
        );
      }

      // Create or update assignment
      await client.query(
        `INSERT INTO fleet_trip_assignments (
           trip_id,
           fleet_owner_id,
           vehicle_id,
           driver_id,
           assignment_status,
           rejection_reason,
           rejection_remarks,
           assigned_at,
           confirmed_at,
           updated_at
         )
         VALUES (
           $1, $2, $3, $4,
           'AWAITING_DRIVER_CONFIRMATION',
           NULL, NULL, NOW(), NULL, NOW()
         )
         ON CONFLICT (trip_id)
         DO UPDATE SET
           fleet_owner_id = EXCLUDED.fleet_owner_id,
           vehicle_id = EXCLUDED.vehicle_id,
           driver_id = EXCLUDED.driver_id,
           assignment_status = 'AWAITING_DRIVER_CONFIRMATION',
           rejection_reason = NULL,
           rejection_remarks = NULL,
           assigned_at = NOW(),
           confirmed_at = NULL,
           updated_at = NOW()`,
        [
          tripId,
          fleetOwnerId,
          dto.vehicleId,
          dto.driverId,
        ],
      );

      // Update booking assignment
      await client.query(
        `UPDATE booking_quotes
         SET driver_id = $1,
             vehicle_id = $2,
             status = 'DRIVER_ASSIGNED',
             updated_at = NOW()
         WHERE id = $3`,
        [
          dto.driverId,
          dto.vehicleId,
          booking.id,
        ],
      );

      await client.query('COMMIT');

      return {
        success: true,
        message:
          'Trip assigned to driver. Push notification sent for confirmation.',
        data: {
          tripId,
          vehicleNumber:
            vehicleResult.rows[0].registration_number,
          driverName: driverResult.rows[0].full_name,
          assignmentStatus: 'AWAITING_DRIVER_CONFIRMATION',
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // API 11.2: Driver confirms or rejects assignment
  async confirmAssignment(
    tripId: string,
    driverUserId: string,
    dto: ConfirmAssignmentDto,
  ) {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      // Find assignment belonging to logged-in driver
      // Assumes driver_profiles.user_id exists
      const assignmentResult = await client.query(
        `SELECT
           a.id,
           a.trip_id,
           a.assignment_status,
           a.driver_id
         FROM fleet_trip_assignments a
         INNER JOIN driver_profiles dp
           ON dp.id = a.driver_id
         WHERE a.trip_id = $1
           AND dp.user_id = $2
         FOR UPDATE OF a`,
        [tripId, driverUserId],
      );

      if (!assignmentResult.rows.length) {
        throw new NotFoundException(
          'Assignment not found for this driver',
        );
      }

      const assignment = assignmentResult.rows[0];

      if (
        assignment.assignment_status !==
        'AWAITING_DRIVER_CONFIRMATION'
      ) {
        throw new BadRequestException(
          `Assignment cannot be updated. Current status: ${assignment.assignment_status}`,
        );
      }

      // Driver confirms assignment
      if (dto.action === 'CONFIRM') {
        await client.query(
          `UPDATE fleet_trip_assignments
           SET assignment_status = 'ACCEPTED',
               confirmed_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [assignment.id],
        );

        await client.query('COMMIT');

        return {
          success: true,
          message:
            'Trip confirmed by driver. Pre-trip checklist unlocked.',
          data: {
            tripId,
            status: 'ACCEPTED',
            nextStep: 'PRE_TRIP_INSPECTION',
          },
        };
      }

      // Driver rejects assignment
      if (!dto.rejectionReason) {
        throw new BadRequestException(
          'rejectionReason is required when action is REJECT',
        );
      }

      await client.query(
        `UPDATE fleet_trip_assignments
         SET assignment_status = 'RE_ASSIGNMENT_REQUIRED',
             rejection_reason = $1,
             rejection_remarks = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [
          dto.rejectionReason,
          dto.rejectionRemarks || null,
          assignment.id,
        ],
      );

      await client.query('COMMIT');

      return {
        success: true,
        message:
          'Assignment declined. Fleet owner has been notified to re-assign.',
        data: {
          tripId,
          status: 'RE_ASSIGNMENT_REQUIRED',
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
