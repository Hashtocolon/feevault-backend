
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { CompartmentLayoutDto } from './dto/compartment-layout.dto';

@Injectable()
export class CompartmentService {
  constructor(private readonly db: DatabaseService) {}

  async confirmLayout(
    tripId: string,
    driverUserId: string,
    dto: CompartmentLayoutDto,
    photo?: Express.Multer.File,
  ) {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      // Verify assigned driver
      const assignment = await client.query(
        `SELECT a.id, a.assignment_status
         FROM fleet_trip_assignments a
         INNER JOIN driver_profiles dp ON dp.id = a.driver_id
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

      // Verify successful pre-trip inspection
      const inspection = await client.query(
        `SELECT id
         FROM pretrip_inspections
         WHERE trip_id = $1
           AND driver_user_id = $2
           AND checklist_status = 'PASSED'`,
        [tripId, driverUserId],
      );

      if (!inspection.rows.length) {
        throw new BadRequestException(
          'Passed pre-trip inspection is required',
        );
      }

      // Verify successful pre-cooling
      const precooling = await client.query(
        `SELECT id
         FROM trip_precooling
         WHERE trip_id = $1
           AND driver_user_id = $2
           AND precooling_status = 'PASSED'`,
        [tripId, driverUserId],
      );

      if (!precooling.rows.length) {
        throw new BadRequestException(
          'Passed pre-cooling is required before confirming compartment layout',
        );
      }

      // Validate single/dual compartment count
      const expectedCount = dto.isMultiCompartment ? 2 : 1;

      if (dto.compartments.length !== expectedCount) {
        throw new BadRequestException(
          `Expected ${expectedCount} compartment(s)`,
        );
      }

      // Validate volume share totals
      const totalVolume = dto.compartments.reduce(
        (sum, item) => sum + item.volumeSharePercent,
        0,
      );

      if (totalVolume !== 100) {
        throw new BadRequestException(
          'Total compartment volume share must equal 100%',
        );
      }

      // Validate compartment and door numbering
      const compartmentNumbers = dto.compartments.map(
        item => item.compartmentNumber,
      );

      const doorNumbers = dto.compartments.map(
        item => item.doorNumber,
      );

      if (
        new Set(compartmentNumbers).size !== expectedCount ||
        new Set(doorNumbers).size !== expectedCount ||
        !compartmentNumbers.every(
          (number, index) => number === index + 1,
        )
      ) {
        throw new BadRequestException(
          'Compartment and door numbers must be unique and sequential',
        );
      }

      if (!dto.isAirflowClearanceVerified) {
        throw new BadRequestException(
          'Airflow clearance must be verified before confirming layout',
        );
      }

      // Check temperature ranges
      const ranges = {
        DEEP_FROZEN: [-25, -22],
        FROZEN: [-18, -15],
        CHILLED: [2, 8],
        CONTROLLED_AMBIENT: [15, 25],
      };

      for (const item of dto.compartments) {
        const range = ranges[item.temperatureBand];

        if (
          !range ||
          item.targetTemperatureCelsius < range[0] ||
          item.targetTemperatureCelsius > range[1]
        ) {
          throw new BadRequestException(
            `Target temperature is outside the allowed range for ${item.temperatureBand}`,
          );
        }
      }

      // Check duplicate layout
      const existing = await client.query(
        `SELECT id
         FROM trip_compartment_layouts
         WHERE trip_id = $1`,
        [tripId],
      );

      if (existing.rows.length) {
        throw new BadRequestException(
          'Compartment layout has already been confirmed for this trip',
        );
      }

      // Save layout
      const layoutResult = await client.query(
        `INSERT INTO trip_compartment_layouts (
           trip_id,
           driver_user_id,
           is_multi_compartment,
           is_airflow_clearance_verified,
           layout_status,
           bulkhead_photo_name,
           bulkhead_photo_type,
           bulkhead_photo
         )
         VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, $6, $7)
         RETURNING id`,
        [
          tripId,
          driverUserId,
          dto.isMultiCompartment,
          dto.isAirflowClearanceVerified,
          photo?.originalname ?? null,
          photo?.mimetype ?? null,
          photo ? Buffer.from(photo.buffer) : null,
        ],
      );

      const layoutId = layoutResult.rows[0].id;

      // Save individual compartments
      for (const item of dto.compartments) {
        await client.query(
          `INSERT INTO trip_compartments (
             layout_id,
             compartment_number,
             door_number,
             zone_name,
             temperature_band,
             target_temperature_celsius,
             volume_share_percent
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            layoutId,
            item.compartmentNumber,
            item.doorNumber,
            item.zoneName,
            item.temperatureBand,
            item.targetTemperatureCelsius,
            item.volumeSharePercent,
          ],
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        message:
          'Compartment layout confirmed. Proceeding to Pickup Arrival.',
        data: {
          tripId,
          isMultiCompartment: dto.isMultiCompartment,
          compartmentCount: dto.compartments.length,
          layoutStatus: 'CONFIRMED',
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
}
