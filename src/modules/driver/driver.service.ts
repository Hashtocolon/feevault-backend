import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DriverService {
  constructor(private readonly db: DatabaseService) {}

  async getDashboard(userId: string) {
    const dRes = await this.db.query(
      `SELECT d.*, v.registration_number, v.vehicle_class, dp.can_go_online
       FROM drivers d
       LEFT JOIN vehicles v ON v.id = d.assigned_vehicle_id
       LEFT JOIN driver_profiles dp ON dp.user_id = d.user_id
       WHERE d.user_id = $1`,
      [userId],
    );

    const driver = dRes.rows[0];

    return {
      dutyStatus: driver ? driver.duty_status : 'OFFLINE',
      partnerStatus: driver ? driver.partner_status : 'PENDING_KYC',
      assignedVehicle: driver?.registration_number
        ? {
            vehicleId: driver.assigned_vehicle_id,
            vehicleNumber: driver.registration_number,
            vehicleClass: driver.vehicle_class,
          }
        : null,
      monthlySummary: {
        netEarningsInr: 84650,
        completedTrips: driver?.trips_completed || 28,
        onTimeDeliveryRatePercent: driver?.on_time_delivery_rate || 96.8,
        tempComplianceScorePercent: driver?.temp_compliance_percent || 99.2,
      },
      activeTrip: null,
      complianceAlerts: [
        {
          documentType: 'REEFER_CALIBRATION',
          title: 'NABL Calibration Certificate',
          expiryDate: '2026-11-30',
          daysRemaining: 18,
          status: 'DUE_SOON',
        },
      ],
    };
  }

  async toggleDutyStatus(userId: string, body: any) {
    const { isDutyOnline, latitude, longitude, batteryPercentage } = body;
    const status = isDutyOnline ? 'ONLINE' : 'OFFLINE';

    await this.db.query(
      `UPDATE users 
       SET duty_status = $1, 
           last_known_latitude = $2, 
           last_known_longitude = $3, 
           device_battery_percent = $4,
           last_ping_at = NOW()
       WHERE id = $5`,
      [status, latitude, longitude, batteryPercentage, userId],
    );

    await this.db.query(
      `UPDATE drivers 
       SET duty_status = $1, updated_at = NOW() 
       WHERE user_id = $2`,
      [status, userId],
    );

    return {
      dutyStatus: status,
      currentLocationName: isDutyOnline ? 'Bengaluru Highway Corridor' : null,
      locationConsentActive: isDutyOnline,
      lastPingTimestamp: new Date().toISOString(),
    };
  }

  async getComplianceCalendar(userId: string) {
    const docs = await this.db.query(
      `SELECT * FROM driver_compliance_documents WHERE driver_user_id = $1`,
      [userId],
    );

    return {
      isDispatchLocked: false,
      documentsCount: docs.rows.length,
      documents: docs.rows,
    };
  }
}

