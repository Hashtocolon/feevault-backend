import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class MasterService {
  constructor(private readonly db: DatabaseService) {}

  async getAvailableHiringModels() {
    const result = await this.db.query(
      `SELECT code, name, description, is_active
       FROM hiring_models
       WHERE is_active = true
       ORDER BY sort_order ASC`,
    );
    return { hiringModels: result.rows };
  }

  async checkServiceability(originPincode: string, destinationPincode: string) {
    if (!originPincode || !destinationPincode) {
      return { serviceable: false, reason: 'Both pincodes are required' };
    }

    const origin = await this.db.query(
      `SELECT pincode, city, state, is_active FROM service_pincodes WHERE pincode = $1`,
      [originPincode],
    );

    const destination = await this.db.query(
      `SELECT pincode, city, state, is_active FROM service_pincodes WHERE pincode = $1`,
      [destinationPincode],
    );

    const originActive = origin.rows.length && origin.rows[0].is_active;
    const destinationActive =
      destination.rows.length && destination.rows[0].is_active;

    return {
      serviceable: originActive && destinationActive,
      origin: origin.rows[0] || null,
      destination: destination.rows[0] || null,
      reason:
        !originActive
          ? 'Origin pincode not serviceable'
          : !destinationActive
          ? 'Destination pincode not serviceable'
          : null,
    };
  }

  async getVehicleClasses(hiringModel?: string) {
    let query = `SELECT code, name, description, payload_capacity_kg, volume_capacity_cbm,
                        is_reefer, min_temp_c, max_temp_c, image_url, sort_order
                 FROM vehicle_classes WHERE is_active = true`;
    const params: any[] = [];

    if (hiringModel) {
      query += ` AND $1 = ANY(supported_hiring_models)`;
      params.push(hiringModel);
    }

    query += ` ORDER BY sort_order ASC`;

    const result = await this.db.query(query, params);
    return { vehicleClasses: result.rows };
  }

  async getTemperatureBands() {
    const result = await this.db.query(
      `SELECT id, name, min_temp_c, max_temp_c, description, vehicle_class
       FROM temp_sla_bands
       WHERE is_active = true
       ORDER BY min_temp_c ASC`,
    );
    return { temperatureBands: result.rows };
  }
}

