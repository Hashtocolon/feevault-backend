import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

@Injectable()
export class VehicleHealthService {
  constructor(private readonly db: DatabaseService) {}

  async getVehicleHealth(userId: string, role: string) {
    const normalizedRole = String(role || '').toUpperCase();

    let whereCondition: string;

    if (normalizedRole === 'DRIVER') {
      whereCondition = 'driver_user_id = $1';
    } else if (
      normalizedRole === 'FLEET_OWNER' ||
      normalizedRole === 'OWNER_CUM_DRIVER'
    ) {
      whereCondition = 'fleet_owner_user_id = $1';
    } else {
      throw new ForbiddenException(
        'Only drivers and fleet owners can access vehicle health',
      );
    }

    const result = await this.db.query(
      `
      SELECT
        vehicle_id,
        vehicle_details,
        reefer_unit,
        telematics_health,
        maintenance,
        updated_at
      FROM vehicle_health_snapshots
      WHERE ${whereCondition}
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(
        'No vehicle health information found for this account',
      );
    }

    const record = result.rows[0];

    const vehicle = record.vehicle_details || {};
    const reefer = record.reefer_unit || {};
    const telematics = record.telematics_health || {};
    const maintenance = record.maintenance || {};

    const fastag = vehicle.fastag || {};
    const dieselTank = reefer.dieselTank || {};
    const calibration = reefer.calibration || {};

    // Calculate FASTag low-balance status using the PDF's ₹500 threshold.
    const fastagBalance = Number(fastag.balanceInr || 0);

    fastag.balanceInr = fastagBalance;
    fastag.isLowBalance = fastagBalance < 500;

    // Calculate diesel percentage when capacity and remaining fuel exist.
    const dieselCapacity = Number(dieselTank.capacityLiters || 0);
    const currentDiesel = Number(dieselTank.currentLiters || 0);

    if (dieselCapacity > 0) {
      dieselTank.percentage = Number(
        ((currentDiesel / dieselCapacity) * 100).toFixed(1),
      );
    }

    // Calculate calibration expiry.
    if (calibration.validUntil) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expiryDate = new Date(calibration.validUntil);
      expiryDate.setHours(0, 0, 0, 0);

      const daysRemaining = Math.ceil(
        (expiryDate.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24),
      );

      calibration.daysRemaining = daysRemaining;
      calibration.status =
        daysRemaining < 0
          ? 'EXPIRED'
          : daysRemaining < 15
            ? 'DUE_SOON'
            : 'VALID';
    }

    return {
      success: true,
      data: {
        vehicle: {
          ...vehicle,
          vehicleId: vehicle.vehicleId || record.vehicle_id,
        },

        reeferUnit: reefer,

        telematicsHealth: telematics,

        maintenance,
      },
    };
  }
}