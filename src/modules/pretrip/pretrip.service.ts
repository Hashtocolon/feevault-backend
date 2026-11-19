import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { PretripChecklistDto } from './dto/pretrip-checklist.dto';

@Injectable()
export class PretripService {
  constructor(private readonly db: DatabaseService) {}

  async submitChecklist(
    tripId: string,
    driverUserId: string,
    dto: PretripChecklistDto,
    photos: Express.Multer.File[],
  ) {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      // Verify that this trip is assigned to the logged-in driver.
      // Assumes driver_profiles.user_id links to users.id.
      const assignmentResult = await client.query(
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

      if (!assignmentResult.rows.length) {
        throw new NotFoundException(
          'Trip assignment not found for this driver',
        );
      }

      if (
        assignmentResult.rows[0].assignment_status !== 'ACCEPTED'
      ) {
        throw new BadRequestException(
          'Driver must confirm the trip assignment before submitting the pre-trip checklist',
        );
      }

      // Check duplicate submission.
      const existing = await client.query(
        `SELECT id
         FROM pretrip_inspections
         WHERE trip_id = $1`,
        [tripId],
      );

      if (existing.rows.length) {
        throw new BadRequestException(
          'Pre-trip checklist has already been submitted for this trip',
        );
      }

      // Save checklist details.
      const checklist = {
        tyresBrakesLights: dto.tyresBrakesLights,
        reeferCompressorFanBelt: dto.reeferCompressorFanBelt,
        compartmentSanitised: dto.compartmentSanitised,
        doorSealsAirtight: dto.doorSealsAirtight,
        documentsInTruck: dto.documentsInTruck,
        iotSensorsActive: dto.iotSensorsActive,
        emergencyKitPresent: dto.emergencyKitPresent,
      };

      const failedChecks = Object.entries(checklist)
        .filter(([, value]) => value !== true)
        .map(([key]) => key);

      if (failedChecks.length > 0) {
        throw new BadRequestException({
          message: 'Pre-trip inspection failed. All checks must pass.',
          failedChecks,
        });
      }

      const inspectionResult = await client.query(
        `INSERT INTO pretrip_inspections (
           trip_id,
           driver_user_id,
           odometer_km,
           truck_fuel_level_percent,
           reefer_diesel_liters,
           checklist,
           checklist_status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'PASSED')
         RETURNING id`,
        [
          tripId,
          driverUserId,
          dto.odometerKm,
          dto.truckFuelLevelPercent,
          dto.reeferDieselLiters,
          JSON.stringify(checklist),
        ],
      );

      const inspectionId = inspectionResult.rows[0].id;

      // Save uploaded photos in PostgreSQL.
      for (const photo of photos) {
        await client.query(
          `INSERT INTO pretrip_inspection_photos (
             inspection_id,
             file_name,
             mime_type,
             photo_data
           )
           VALUES ($1, $2, $3, $4)`,
          [
            inspectionId,
            photo.originalname,
            photo.mimetype,
            photo.buffer,
          ],
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        message:
          'Pre-trip inspection passed. Proceeding to Reefer Pre-Cooling.',
        data: {
          tripId,
          checklistStatus: 'PASSED',
          targetSetpointCelsius: null,
          nextStep: 'REEFER_PRECOOLING',
          inspectionId,
          photosUploaded: photos.length,
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