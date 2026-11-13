import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CargoService {
  constructor(private readonly db: DatabaseService) {}

  async checkCargoCompatibility(body: any, userId: string) {
    const { vehicleClass, requiredTempMin, requiredTempMax, cargoType } = body;

    if (!vehicleClass) {
      throw new BadRequestException('vehicleClass is required');
    }

    // Fetch vehicle class temperature range
    const vcResult = await this.db.query(
      `SELECT vc.*, tsb.min_temp_c, tsb.max_temp_c
       FROM vehicle_classes vc
       LEFT JOIN temp_sla_bands tsb ON tsb.vehicle_class = vc.code
       WHERE vc.code = $1`,
      [vehicleClass],
    );

    if (!vcResult.rows.length) {
      throw new BadRequestException('Invalid vehicle class');
    }

    const vc = vcResult.rows[0];
    let compatible = true;
    let reason: string | null = null;

    if (requiredTempMin !== undefined && requiredTempMax !== undefined) {
      if (
        requiredTempMin < vc.min_temp_c ||
        requiredTempMax > vc.max_temp_c
      ) {
        compatible = false;
        reason = `Vehicle supports ${vc.min_temp_c}°C to ${vc.max_temp_c}°C. Required: ${requiredTempMin}°C to ${requiredTempMax}°C`;
      }
    }

    return {
      compatible,
      reason,
      vehicleClass: vc.code,
      vehicleName: vc.name,
      supportedTempMin: vc.min_temp_c,
      supportedTempMax: vc.max_temp_c,
      cargoType: cargoType || null,
    };
  }
}

