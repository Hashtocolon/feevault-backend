import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { DatabaseService } from '../../database/database.service';
import { PrecoolingStatusDto } from './dto/precooling-status.dto';
import { PrecoolingAbortDto } from './dto/precooling-abort.dto';

@Injectable()
export class PrecoolingService {
  constructor(private readonly db: DatabaseService) {}

  private async verifyDriverAssignment(
    client: any,
    tripId: string,
    driverUserId: string,
  ) {
    const result = await client.query(
      `SELECT a.id, a.assignment_status
       FROM fleet_trip_assignments a
       INNER JOIN driver_profiles dp ON dp.id = a.driver_id
       WHERE a.trip_id = $1
         AND dp.user_id = $2
       FOR UPDATE OF a`,
      [tripId, driverUserId],
    );

    if (!result.rows.length) {
      throw new NotFoundException(
        'Trip assignment not found for this driver',
      );
    }

    if (result.rows[0].assignment_status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Driver must confirm the assignment before proceeding',
      );
    }

    const inspection = await client.query(
      `SELECT id, checklist_status
       FROM pretrip_inspections
       WHERE trip_id = $1
         AND driver_user_id = $2`,
      [tripId, driverUserId],
    );

    if (
      !inspection.rows.length ||
      inspection.rows[0].checklist_status !== 'PASSED'
    ) {
      throw new BadRequestException(
        'A passed pre-trip inspection is required before pre-cooling',
      );
    }
  }

  // API 13.1
  async submitStatus(
    tripId: string,
    driverUserId: string,
    dto: PrecoolingStatusDto,
    photo?: Express.Multer.File,
  ) {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      await this.verifyDriverAssignment(
        client,
        tripId,
        driverUserId,
      );

      const existing = await client.query(
        `SELECT id, precooling_status
         FROM trip_precooling
         WHERE trip_id = $1
         FOR UPDATE`,
        [tripId],
      );

      if (existing.rows.length) {
        throw new BadRequestException(
          'Pre-cooling status has already been submitted for this trip',
        );
      }

      if (
        !dto.isReadingSourceIot &&
        !photo
      ) {
        throw new BadRequestException(
          'Manual thermometer photo is required when IoT is offline',
        );
      }

      if (
        dto.isReadingSourceIot &&
        dto.iotBatteryLevelPercent === undefined
      ) {
        throw new BadRequestException(
          'IoT battery percentage is required when IoT reading is used',
        );
      }

      if (
        dto.timeTargetReached &&
        new Date(dto.timeTargetReached).getTime() > Date.now()
      ) {
        throw new BadRequestException(
          'Target reached time cannot be in the future',
        );
      }

      // Configurable tolerance. Set PREC​​OOL_TEMP_TOLERANCE_C in .env.
      // Default 1.0°C is an implementation assumption, not a PDF value.
      const tolerance = Number(
        process.env.PRECOOL_TEMP_TOLERANCE_C ?? 1.0,
      );

      if (!Number.isFinite(tolerance) || tolerance < 0) {
        throw new BadRequestException(
          'Invalid PRECOOL_TEMP_TOLERANCE_C configuration',
        );
      }

      // Temperature must be at or below target + tolerance.
      // This assumes a lower temperature is colder.
      const temperaturePassed =
        dto.chamberTemperatureCelsius <=
        dto.targetSetpointCelsius + tolerance;

      if (!temperaturePassed) {
        throw new BadRequestException({
          message:
            'Chamber temperature is outside the configured allowable band. Continue cooling.',
          data: {
            tripId,
            chamberTemperatureCelsius:
              dto.chamberTemperatureCelsius,
            targetSetpointCelsius:
              dto.targetSetpointCelsius,
            toleranceCelsius: tolerance,
            preCoolingStatus: 'NOT_PASSED',
          },
        });
      }

      const result = await client.query(
        `INSERT INTO trip_precooling (
           trip_id,
           driver_user_id,
           chamber_temperature_celsius,
           target_setpoint_celsius,
           precooling_duration_minutes,
           is_reading_source_iot,
           iot_battery_level_percent,
           time_target_reached,
           manual_thermometer_photo_name,
           manual_thermometer_photo_type,
           manual_thermometer_photo,
           precooling_status
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PASSED'
         )
         RETURNING id`,
        [
          tripId,
          driverUserId,
          dto.chamberTemperatureCelsius,
          dto.targetSetpointCelsius,
          dto.preCoolingDurationMinutes,
          dto.isReadingSourceIot,
          dto.iotBatteryLevelPercent ?? null,
          dto.timeTargetReached,
          photo?.originalname ?? null,
          photo?.mimetype ?? null,
          photo?.buffer ?? null,
        ],
      );

      await client.query('COMMIT');

      return {
        success: true,
        message:
          'Chamber successfully pre-cooled within allowable band. Loading dock access unlocked.',
        data: {
          tripId,
          preCoolingStatus: 'PASSED',
          chamberTempCelsius:
            dto.chamberTemperatureCelsius,
          nextStep: 'PICKUP_ARRIVAL',
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // API 13.2
  async abortPrecooling(
    tripId: string,
    driverUserId: string,
    dto: PrecoolingAbortDto,
    photo: Express.Multer.File,
  ) {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      await this.verifyDriverAssignment(
        client,
        tripId,
        driverUserId,
      );

      // Do not allow abort after successful pre-cooling.
      const precooling = await client.query(
        `SELECT id, precooling_status
         FROM trip_precooling
         WHERE trip_id = $1
         FOR UPDATE`,
        [tripId],
      );

      if (
        precooling.rows.length &&
        precooling.rows[0].precooling_status === 'PASSED'
      ) {
        throw new BadRequestException(
          'Pre-cooling has already passed. Abort is not allowed.',
        );
      }

      const existingAbort = await client.query(
        `SELECT id, ops_ticket_id
         FROM trip_precooling_aborts
         WHERE trip_id = $1`,
        [tripId],
      );

      if (existingAbort.rows.length) {
        throw new BadRequestException(
          'A pre-cooling malfunction has already been reported for this trip',
        );
      }

      const ticketId =
        'OPS-TICK-' + randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

      await client.query(
        `INSERT INTO trip_precooling_aborts (
           trip_id,
           driver_user_id,
           fault_code,
           current_temp_celsius,
           fault_description,
           reefer_panel_photo_name,
           reefer_panel_photo_type,
           reefer_panel_photo,
           trip_status,
           penalty_applied,
           ops_ticket_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 'ABORTED_PRECOOLING_FAULT', FALSE, $9)`,
        [
          tripId,
          driverUserId,
          dto.faultCode,
          dto.currentTempCelsius,
          dto.faultDescription,
          photo.originalname,
          photo.mimetype,
          photo.buffer,
          ticketId,
        ],
      );

      await client.query('COMMIT');

      return {
        success: true,
        message:
          'Pre-cooling abort recorded. Zoop 24/7 Ops has been alerted for load reassignment. Zero penalty applied to driver.',
        data: {
          tripId,
          tripStatus: 'ABORTED_PRECOOLING_FAULT',
          penaltyApplied: false,
          opsTicketId: ticketId,
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