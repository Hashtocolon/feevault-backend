
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import { CreateBookingDto } from './dto/create-booking.dto';
import { ManualAllocationDto } from './dto/manual-allocation.dto';
import { DispatchRulesDto } from './dto/dispatch-rules.dto';
import { ReassignTripDto } from './dto/reassign-trip.dto';

@Injectable()
export class AdminOperationsService {
  constructor(private readonly db: DatabaseService) {}

  // API 2.1 - Dashboard KPIs
  async getDashboardKpis() {
    const metrics = await this.db.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE status IN ('IN_TRANSIT', 'IN_PROGRESS')
        )::int AS trips_on_road,

        COUNT(*) FILTER (
          WHERE status IN ('IN_TRANSIT', 'IN_PROGRESS')
          AND sla_status = 'COMPLIANT'
        )::int AS sla_compliant,

        COUNT(*) FILTER (
          WHERE status IN ('IN_TRANSIT', 'IN_PROGRESS')
          AND temp_status = 'IN_BAND'
        )::int AS temp_compliant,

        COUNT(*) FILTER (
          WHERE status IN ('IN_TRANSIT', 'IN_PROGRESS')
          AND temp_status = 'IN_BAND'
        )::int AS reefers_in_band

      FROM admin_control_trips
    `);

    const row = metrics.rows[0];

    const tripsOnRoad = Number(row.trips_on_road || 0);
    const slaCompliant = Number(row.sla_compliant || 0);
    const tempCompliant = Number(row.temp_compliant || 0);

    const pending = await this.db.query(`
      SELECT COUNT(*)::int AS total
      FROM admin_pending_verifications
      WHERE status IN ('PENDING', 'UNDER_REVIEW')
    `);

    const readings = await this.db.query(`
      SELECT temperature
      FROM admin_reefer_temperature_readings
      ORDER BY recorded_at DESC
      LIMIT 12
    `);

    const sampleTrace = readings.rows
      .map((item) => Number(item.temperature))
      .reverse();

    return {
      tripsOnRoad,
      slaCompliancePercent: tripsOnRoad
        ? Number(((slaCompliant / tripsOnRoad) * 100).toFixed(1))
        : 0,
      tempCompliancePercent: tripsOnRoad
        ? Number(((tempCompliant / tripsOnRoad) * 100).toFixed(1))
        : 0,
      reefersInBand: Number(row.reefers_in_band || 0),
      pendingVerifications: Number(pending.rows[0].total || 0),
      sampleTrace,
    };
  }

  // API 2.2 - Live Trip Monitor
  async getLiveTrips() {
    const result = await this.db.query(`
      SELECT
        trip_reference,
        customer,
        pickup_location,
        drop_location,
        vehicle_registration,
        vehicle_class,
        driver_name,
        driver_mobile,
        cargo,
        target_setpoint,
        current_temp,
        temp_status,
        door_status,
        e_seal_number,
        latitude,
        longitude,
        eta
      FROM admin_control_trips
      WHERE status IN ('IN_TRANSIT', 'IN_PROGRESS')
      ORDER BY updated_at DESC
    `);

    return result.rows.map((trip) => ({
      tripReference: trip.trip_reference,
      customer: trip.customer,
      route: `${trip.pickup_location} → ${trip.drop_location}`,
      vehicle: `${trip.vehicle_registration} (${trip.vehicle_class})`,
      driver: `${trip.driver_name} (${trip.driver_mobile})`,
      cargo: trip.cargo,
      targetSetpoint:
        trip.target_setpoint === null
          ? null
          : Number(trip.target_setpoint),
      currentTemp:
        trip.current_temp === null
          ? null
          : Number(trip.current_temp),
      tempStatus: trip.temp_status,
      doorStatus: trip.door_status,
      eSealNumber: trip.e_seal_number,
      lat: trip.latitude === null ? null : Number(trip.latitude),
      lng: trip.longitude === null ? null : Number(trip.longitude),
      eta: trip.eta,
    }));
  }

  // API 2.3 - Create FTL Booking
  async createBooking(dto: CreateBookingDto, adminId: string) {
    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      const bookingReference =
        `RF-${Date.now().toString().slice(-8)}`;

      const booking = await client.query(
        `INSERT INTO admin_control_bookings (
          booking_reference,
          customer,
          pickup_location,
          drop_location,
          pickup_date,
          pickup_time_window,
          vehicle_class,
          cargo_category,
          temperature_band,
          declared_value_inr,
          cargo_handling_notes,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id, booking_reference, status`,
        [
          bookingReference,
          dto.customer,
          dto.pickupLocation,
          dto.dropLocation,
          dto.pickupDate,
          dto.pickupTimeWindow,
          dto.vehicleClass,
          dto.cargoCategory,
          dto.temperatureBand,
          dto.declaredValueInr,
          dto.cargoHandlingNotes ?? null,
          adminId,
        ],
      );

      const saved = booking.rows[0];

      await client.query(
        `INSERT INTO admin_dispatch_queue (booking_id)
         VALUES ($1)`,
        [saved.id],
      );

      await client.query('COMMIT');

      return {
        bookingId: saved.id,
        bookingReference: saved.booking_reference,
        status: saved.status,
        message: 'Booking created and queued for dispatch wave',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // API 2.4 - Dispatch Queue
  async getDispatchQueue() {
    const result = await this.db.query(`
      SELECT
        q.id,
        b.booking_reference,
        q.current_wave,
        q.wave_started_at,
        q.wave_timeout_seconds,
        q.offered_vehicles,
        q.status
      FROM admin_dispatch_queue q
      INNER JOIN admin_control_bookings b
        ON b.id = q.booking_id
      WHERE q.status NOT IN ('COMPLETED', 'CANCELLED')
      ORDER BY q.created_at DESC
    `);

    return result.rows.map((item) => {
      const elapsedSeconds = Math.floor(
        (Date.now() - new Date(item.wave_started_at).getTime()) / 1000,
      );

      const remainingSeconds = Math.max(
        0,
        Number(item.wave_timeout_seconds) - elapsedSeconds,
      );

      return {
        bookingRef: item.booking_reference,
        currentWave: Number(item.current_wave),
        waveRemainingSeconds: remainingSeconds,
        offeredVehicles: item.offered_vehicles ?? [],
        status: item.status,
      };
    });
  }

  // API 2.5 - Manual Vehicle and Driver Allocation
  async allocateManual(dto: ManualAllocationDto, adminId: string) {
    const booking = await this.db.query(
      `SELECT id, status
       FROM admin_control_bookings
       WHERE booking_reference = $1
       LIMIT 1`,
      [dto.bookingReference],
    );

    if (!booking.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    if (
      ['CANCELLED', 'COMPLETED'].includes(booking.rows[0].status)
    ) {
      throw new BadRequestException(
        'Cannot allocate a cancelled or completed booking',
      );
    }

    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id
         FROM admin_manual_allocations
         WHERE booking_reference = $1
           AND status = 'OFFER_SENT'
         LIMIT 1
         FOR UPDATE`,
        [dto.bookingReference],
      );

      if (existing.rows.length) {
        throw new ConflictException(
          'An active manual allocation already exists',
        );
      }

      await client.query(
        `INSERT INTO admin_manual_allocations (
          booking_reference,
          vehicle_id,
          driver_id,
          offer_expiry_seconds,
          incentive_inr,
          allocation_reason,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          dto.bookingReference,
          dto.vehicleId,
          dto.driverId,
          dto.offerExpirySeconds,
          dto.incentiveInr ?? 0,
          dto.allocationReason,
          adminId,
        ],
      );

      await client.query(
        `UPDATE admin_control_bookings
         SET status = 'MANUAL_ALLOCATION_PENDING'
         WHERE booking_reference = $1`,
        [dto.bookingReference],
      );

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Manual allocation recorded. Driver offer integration is pending.',
        bookingReference: dto.bookingReference,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // API 2.6 - Configure Dispatch Rules
  async updateDispatchRules(
    dto: DispatchRulesDto,
    adminId: string,
  ) {
    await this.db.query(
      `UPDATE admin_dispatch_rules
       SET
         wave1_vehicle_count = $1,
         wave1_timeout_seconds = $2,
         wave2_vehicle_count = $3,
         wave2_timeout_seconds = $4,
         escalation_after_rounds = $5,
         hard_lane_incentive_inr = $6,
         updated_by = $7,
         updated_at = NOW()`,
      [
        dto.wave1VehicleCount,
        dto.wave1TimeoutSeconds,
        dto.wave2VehicleCount,
        dto.wave2TimeoutSeconds,
        dto.escalationAfterRounds,
        dto.hardLaneIncentiveInr,
        adminId,
      ],
    );

    return {
      success: true,
      message: 'Dispatch rules updated across all operating corridors',
    };
  }

  // API 2.7 - Emergency Reassignment
  async reassignTrip(dto: ReassignTripDto, adminId: string) {
    const trip = await this.db.query(
      `SELECT id, status
       FROM admin_control_trips
       WHERE booking_reference = $1
       LIMIT 1`,
      [dto.bookingReference],
    );

    if (!trip.rows.length) {
      throw new NotFoundException('Trip not found');
    }

    if (
      !['IN_TRANSIT', 'IN_PROGRESS', 'DISPATCH_PENDING'].includes(
        trip.rows[0].status,
      )
    ) {
      throw new BadRequestException(
        'Trip cannot be reassigned in its current status',
      );
    }

    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO admin_trip_reassignments (
          booking_reference,
          reason,
          new_vehicle,
          new_driver,
          update_eway_bill_part_b,
          eway_bill_status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          dto.bookingReference,
          dto.reason,
          dto.newVehicle,
          dto.newDriver,
          dto.updateEWayBillPartB ?? false,
          dto.updateEWayBillPartB ? 'QUEUED' : 'NOT_REQUESTED',
          adminId,
        ],
      );

      await client.query(
        `UPDATE admin_control_trips
         SET status = 'REASSIGNMENT_PENDING',
             updated_at = NOW()
         WHERE booking_reference = $1`,
        [dto.bookingReference],
      );

      await client.query('COMMIT');

      return {
        success: true,
        message: dto.updateEWayBillPartB
          ? 'Trip reassignment recorded. E-way bill Part-B update queued.'
          : 'Trip reassignment recorded.',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
