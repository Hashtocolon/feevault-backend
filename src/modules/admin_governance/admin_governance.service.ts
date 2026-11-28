import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSegregationRuleDto } from './dto/create-segregation-rule.dto';
import { CreateVehicleClassDto } from './dto/create-vehicle-class.dto';
import { CreateDeviceDto } from './dto/create-device.dto';

@Injectable()
export class AdminGovernanceService {
  constructor(private readonly db: DatabaseService) {}

  // API 6.1: Add cargo segregation rule
  async createSegregationRule(
    dto: CreateSegregationRuleDto,
    adminId: string,
  ) {
    const result = await this.db.query(
      `INSERT INTO admin_cargo_segregation_rules
       (cargo_a, cargo_b, compatibility, condition, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        dto.cargoA,
        dto.cargoB,
        dto.compatibility,
        dto.condition,
        adminId,
      ],
    );

    return {
      success: true,
      ruleId: result.rows[0].id,
    };
  }

  // API 6.2: Add vehicle class
  async createVehicleClass(
    dto: CreateVehicleClassDto,
    adminId: string,
  ) {
    const result = await this.db.query(
      `INSERT INTO admin_vehicle_classes
       (class_name, payload_kg, volume_m3, temperature_range,
        compartments, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        dto.className,
        dto.payloadKg,
        dto.volumeM3,
        dto.temperatureRange,
        dto.compartments,
        adminId,
      ],
    );

    return {
      success: true,
      classId: result.rows[0].id,
    };
  }

  // API 6.3: Add device record
  async createDevice(dto: CreateDeviceDto) {
    const result = await this.db.query(
      `INSERT INTO admin_iot_devices
       (device_id, imei, device_type, battery_percent, signal,
        linked_vehicle, calibration_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING device_id`,
      [
        dto.deviceId,
        dto.imei ?? null,
        dto.type,
        dto.batteryPercent ?? null,
        dto.signal ?? null,
        dto.linkedVehicle ?? null,
        dto.calibrationExpiry ?? null,
      ],
    );

    return {
      success: true,
      deviceId: result.rows[0].device_id,
    };
  }

  // API 6.3: Get device inventory
  async getDevices() {
    const result = await this.db.query(
      `SELECT
         device_id AS "deviceId",
         imei,
         device_type AS type,
         battery_percent AS "batteryPercent",
         signal,
         linked_vehicle AS "linkedVehicle",
         TO_CHAR(calibration_expiry, 'YYYY-MM-DD') AS "calibrationExpiry"
       FROM admin_iot_devices
       ORDER BY created_at DESC`,
    );

    return result.rows;
  }

  // API 6.4: Temperature compliance report
  async getTemperatureCompliance(
    startDate: string,
    endDate: string,
    format: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'startDate and endDate are required',
      );
    }

    if (!['json', 'csv'].includes(format)) {
      throw new BadRequestException(
        'format must be json or csv',
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
      startDate > endDate
    ) {
      throw new BadRequestException('Invalid date range');
    }

    const result = await this.db.query(
      `SELECT
         trip_reference,
         temperature_c,
         setpoint_c,
         recorded_at
       FROM admin_temperature_readings
       WHERE recorded_at >= $1::date
         AND recorded_at < ($2::date + INTERVAL '1 day')
       ORDER BY recorded_at ASC`,
      [startDate, endDate],
    );

    const readings = result.rows;
    const tripReferences = new Set(
      readings.map((row) => row.trip_reference),
    );

    const evaluated = readings.filter(
      (row) => row.setpoint_c !== null,
    );

    const inBand = evaluated.filter(
      (row) =>
        Number(row.temperature_c) <= Number(row.setpoint_c),
    );

    const excursions = evaluated.filter(
      (row) =>
        Number(row.temperature_c) > Number(row.setpoint_c),
    );

    const inBandPercent = evaluated.length
      ? Number(
          ((inBand.length / evaluated.length) * 100).toFixed(1),
        )
      : 0;

    const reportId = `REP-${endDate}`;

    if (format === 'csv') {
      const header =
        'tripReference,temperatureC,setpointC,recordedAt';

      const rows = readings.map((row) =>
        [
          row.trip_reference,
          row.temperature_c,
          row.setpoint_c ?? '',
          new Date(row.recorded_at).toISOString(),
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      );

      return {
        reportId,
        contentType: 'text/csv',
        fileName: `${reportId}.csv`,
        csv: [header, ...rows].join('\n'),
      };
    }

    return {
      reportId,
      totalTripsEvaluated: tripReferences.size,
      overallInBandPercent: inBandPercent,
      totalExcursions: excursions.length,
      downloadCsvUrl:
        `/api/v1/admin/reports/temperature-compliance?startDate=${startDate}&endDate=${endDate}&format=csv`,
    };
  }

  // API 6.5: Get governance audit logs
  async getAuditLogs() {
    const result = await this.db.query(
      `SELECT
         id,
         actor_email AS "actorEmail",
         action,
         target_resource AS "targetResource",
         created_at AS timestamp,
         ip_address AS "ipAddress"
       FROM admin_governance_audit_logs
       ORDER BY created_at DESC
       LIMIT 500`,
    );

    return result.rows;
  }

  // Helper: record an administrative action
  async recordAuditLog(
    actorEmail: string,
    action: string,
    targetResource: string,
    ipAddress?: string,
  ) {
    await this.db.query(
      `INSERT INTO admin_governance_audit_logs
       (actor_email, action, target_resource, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [
        actorEmail,
        action,
        targetResource,
        ipAddress ?? null,
      ],
    );

    return { success: true };
  }
}