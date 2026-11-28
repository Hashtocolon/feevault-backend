
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { randomInt, randomUUID } from 'crypto';

import { DatabaseService } from '../../database/database.service';
import { InviteDriverDto } from './dto/invite-driver.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';

@Injectable()
export class FleetService {
  constructor(private readonly db: DatabaseService) {}

  // --------------------------------------------------
  // COMMON: GET FLEET OWNER ID
  // --------------------------------------------------

  private getFleetOwnerId(user: any): string {
    if (!user) {
      throw new UnauthorizedException('Login required');
    }

    const role = String(
      user.role || user.userRole || user.accountType || '',
    ).toUpperCase();

    if (!['FLEET_OWNER', 'OWNER_CUM_DRIVER'].includes(role)) {
      throw new ForbiddenException(
        'Only fleet owners can perform this action',
      );
    }

    const ownerId = user.id || user.userId || user.sub;

    if (!ownerId) {
      throw new UnauthorizedException(
        'Fleet owner ID not found in access token',
      );
    }

    return String(ownerId);
  }

  // --------------------------------------------------
  // COMMON: GENERATE SIX CHARACTER LINKING CODE
  // --------------------------------------------------

  private generateLinkingCode(): string {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let code = '';

    for (let i = 0; i < 6; i++) {
      code += characters[randomInt(characters.length)];
    }

    return code;
  }

  // --------------------------------------------------
  // API 39.1: GET FLEET OVERVIEW
  // GET /api/v1/fleet/overview
  // --------------------------------------------------

  async getFleetOverview(user: any) {
    const ownerId = this.getFleetOwnerId(user);

    const fleetResult = await this.db.query(
      `SELECT
          fleet_name,
          fleet_code
       FROM fleet_profiles
       WHERE owner_user_id::text = $1
       LIMIT 1`,
      [ownerId],
    );

    if (!fleetResult.rows.length) {
      throw new NotFoundException('Fleet profile not found');
    }

    const fleet = fleetResult.rows[0];

    // Get all vehicles belonging to this fleet.
    const vehicleResult = await this.db.query(
      `SELECT
          v.id,
          v.registration_number,
          v.vehicle_class,
          v.vehicle_class_label,
          v.status,
          v.active_trip_id,
          v.iot_status,
          v.iot_battery_percentage,
          v.last_known_location,
          v.assigned_driver_id,

          dp.id AS driver_id,
          dp.full_name AS driver_name,
          dp.mobile_number AS driver_mobile_number

       FROM vehicles v

       LEFT JOIN driver_profiles dp
         ON dp.id::text = v.assigned_driver_id::text

       WHERE v.fleet_owner_user_id::text = $1

       ORDER BY v.registration_number ASC`,
      [ownerId],
    );

    // Get all drivers belonging to this fleet.
    const driverResult = await this.db.query(
      `SELECT
          dp.id,
          dp.full_name,
          dp.mobile_number,
          dp.is_online,
          dp.kyc_status,
          dp.rating,

          v.registration_number AS assigned_vehicle_number

       FROM driver_profiles dp

       LEFT JOIN vehicles v
         ON v.assigned_driver_id::text = dp.id::text
        AND v.fleet_owner_user_id::text = $1

       WHERE dp.fleet_owner_user_id::text = $1

       ORDER BY dp.full_name ASC`,
      [ownerId],
    );

    const vehicles = vehicleResult.rows.map((vehicle: any) => {
      const item: any = {
        vehicleId: String(vehicle.id),
        registrationNumber: vehicle.registration_number,
        vehicleClass: vehicle.vehicle_class,
        vehicleClassLabel: vehicle.vehicle_class_label,
        status: vehicle.status,
        iotStatus: vehicle.iot_status,
        iotBatteryPercentage:
          vehicle.iot_battery_percentage === null
            ? null
            : Number(vehicle.iot_battery_percentage),

        currentDriver: vehicle.driver_id
          ? {
              driverId: String(vehicle.driver_id),
              name: vehicle.driver_name,
              mobileNumber: vehicle.driver_mobile_number,
            }
          : null,

        lastKnownLocation: vehicle.last_known_location,
      };

      if (vehicle.active_trip_id) {
        item.activeTripId = vehicle.active_trip_id;
      }

      return item;
    });

    const drivers = driverResult.rows.map((driver: any) => ({
      driverId: String(driver.id),
      name: driver.full_name,
      mobileNumber: driver.mobile_number,
      isOnline: Boolean(driver.is_online),
      assignedVehicleNumber:
        driver.assigned_vehicle_number || null,
      kycStatus: driver.kyc_status,
      rating:
        driver.rating === null ? null : Number(driver.rating),
    }));

    const summary = {
      totalVehicles: vehicles.length,

      availableVehicles: vehicles.filter(
        (v: any) => v.status === 'AVAILABLE',
      ).length,

      inTransitVehicles: vehicles.filter(
        (v: any) => v.status === 'IN_TRANSIT',
      ).length,

      maintenanceHoldVehicles: vehicles.filter(
        (v: any) => v.status === 'MAINTENANCE_HOLD',
      ).length,

      totalDrivers: drivers.length,

      activeDriversOnline: drivers.filter(
        (d: any) => d.isOnline,
      ).length,
    };

    return {
      success: true,
      data: {
        fleetName: fleet.fleet_name,
        fleetCode: fleet.fleet_code,
        summary,
        vehicles,
        drivers,
      },
    };
  }

  // --------------------------------------------------
  // API 39.2: INVITE DRIVER
  // POST /api/v1/fleet/drivers/invite
  // --------------------------------------------------

  async inviteDriver(user: any, dto: InviteDriverDto) {
    const ownerId = this.getFleetOwnerId(user);

    const driverName = dto.driverName?.trim();
    const mobileNumber = dto.driverMobileNumber?.trim();

    if (!driverName) {
      throw new BadRequestException('Driver name is required');
    }

    if (!mobileNumber || !/^\+91[6-9]\d{9}$/.test(mobileNumber)) {
      throw new BadRequestException(
        'Enter a valid Indian mobile number with +91',
      );
    }

    const fleetResult = await this.db.query(
      `SELECT fleet_name, fleet_code
       FROM fleet_profiles
       WHERE owner_user_id::text = $1
       LIMIT 1`,
      [ownerId],
    );

    if (!fleetResult.rows.length) {
      throw new NotFoundException('Fleet profile not found');
    }

    const fleet = fleetResult.rows[0];

    // Check whether this mobile number already belongs to a driver.
    const existingDriverResult = await this.db.query(
      `SELECT
          id,
          fleet_owner_user_id,
          kyc_status
       FROM driver_profiles
       WHERE mobile_number = $1
       LIMIT 1`,
      [mobileNumber],
    );

    if (existingDriverResult.rows.length) {
      const existingDriver = existingDriverResult.rows[0];

      if (
        existingDriver.fleet_owner_user_id &&
        String(existingDriver.fleet_owner_user_id) !== ownerId
      ) {
        throw new ConflictException(
          'This driver is already linked to another fleet',
        );
      }

      if (
        existingDriver.fleet_owner_user_id &&
        String(existingDriver.fleet_owner_user_id) === ownerId
      ) {
        throw new ConflictException(
          'This driver is already linked to your fleet',
        );
      }
    }

    // Validate optional default vehicle.
    if (dto.defaultAssignedVehicleId) {
      const vehicleResult = await this.db.query(
        `SELECT id, status
         FROM vehicles
         WHERE id::text = $1
           AND fleet_owner_user_id::text = $2
         LIMIT 1`,
        [dto.defaultAssignedVehicleId, ownerId],
      );

      if (!vehicleResult.rows.length) {
        throw new NotFoundException(
          'Default vehicle not found in your fleet',
        );
      }

      if (vehicleResult.rows[0].status === 'IN_TRANSIT') {
        throw new BadRequestException(
          'Cannot select a vehicle that is currently in transit',
        );
      }
    }

    // Create a unique invitation ID.
    const invitationId = `INV-${fleet.fleet_code}-${Date.now()}`;

    const linkingCode = this.generateLinkingCode();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitationResult = await this.db.query(
      `INSERT INTO fleet_driver_invitations (
          id,
          invitation_code,
          fleet_owner_user_id,
          fleet_code,
          driver_name,
          driver_mobile_number,
          default_assigned_vehicle_id,
          linking_code,
          status,
          expires_at,
          created_at,
          updated_at
       )
       VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, 'INVITED', $9, NOW(), NOW()
       )
       RETURNING
          id,
          invitation_code,
          fleet_code,
          driver_mobile_number,
          linking_code,
          status,
          expires_at`,
      [
        randomUUID(),
        invitationId,
        ownerId,
        fleet.fleet_code,
        driverName,
        mobileNumber,
        dto.defaultAssignedVehicleId || null,
        linkingCode,
        expiresAt,
      ],
    );

    const invitation = invitationResult.rows[0];

    /*
     * SMS INTEGRATION:
     *
     * Connect your SMS provider here.
     *
     * Send:
     * - Fleet linking code
     * - Fleet code
     * - Driver app download link
     *
     * Do not say SMS was sent until your SMS provider
     * confirms successful delivery.
     */

    return {
      success: true,
      message: 'Driver invitation created successfully.',
      data: {
        invitationId: invitation.invitation_code,
        fleetCode: invitation.fleet_code,
        driverMobileNumber: invitation.driver_mobile_number,
        linkingCode: invitation.linking_code,
        status: invitation.status,
        expiresInDays: 7,
      },
    };
  }

  // --------------------------------------------------
  // API 39.3: ASSIGN / UNASSIGN DRIVER TO VEHICLE
  // POST /api/v1/fleet/vehicles/:vehicleId/assign-driver
  // --------------------------------------------------

  async assignDriverToVehicle(
    user: any,
    vehicleId: string,
    dto: AssignDriverDto,
  ) {
    const ownerId = this.getFleetOwnerId(user);

    if (!vehicleId) {
      throw new BadRequestException('Vehicle ID is required');
    }

    if (
      dto.driverId !== null &&
      dto.driverId !== undefined &&
      (typeof dto.driverId !== 'string' || !dto.driverId.trim())
    ) {
      throw new BadRequestException(
        'driverId must be a valid driver ID or null',
      );
    }

    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      // Lock the vehicle row while changing its assignment.
      const vehicleResult = await client.query(
        `SELECT
            id,
            registration_number,
            status,
            assigned_driver_id
         FROM vehicles
         WHERE id::text = $1
           AND fleet_owner_user_id::text = $2
         FOR UPDATE`,
        [vehicleId, ownerId],
      );

      if (!vehicleResult.rows.length) {
        throw new NotFoundException(
          'Vehicle not found in your fleet',
        );
      }

      const vehicle = vehicleResult.rows[0];

      // A vehicle carrying cargo on an active trip cannot be changed.
      if (vehicle.status === 'IN_TRANSIT') {
        throw new BadRequestException(
          'Driver cannot be changed while the vehicle is on an active trip',
        );
      }

      let assignedDriver: any = null;

      // If driverId is null, unassign the current driver.
      if (dto.driverId !== null && dto.driverId !== undefined) {
        const driverResult = await client.query(
          `SELECT
              id,
              full_name,
              mobile_number,
              kyc_status,
              fleet_owner_user_id
           FROM driver_profiles
           WHERE id::text = $1
           FOR UPDATE`,
          [dto.driverId],
        );

        if (!driverResult.rows.length) {
          throw new NotFoundException('Driver not found');
        }

        assignedDriver = driverResult.rows[0];

        // Driver must be activated.
        if (assignedDriver.kyc_status !== 'ACTIVATED') {
          throw new BadRequestException(
            'Driver KYC must be ACTIVATED before assignment',
          );
        }

        // Driver cannot belong to a different fleet.
        if (
          assignedDriver.fleet_owner_user_id &&
          String(assignedDriver.fleet_owner_user_id) !== ownerId
        ) {
          throw new ForbiddenException(
            'This driver belongs to another fleet',
          );
        }

        // Prevent assigning the same driver to two vehicles.
        const existingAssignmentResult = await client.query(
          `SELECT
              id,
              registration_number,
              status
           FROM vehicles
           WHERE assigned_driver_id::text = $1
             AND id::text <> $2
             AND fleet_owner_user_id::text = $3
           LIMIT 1
           FOR UPDATE`,
          [String(dto.driverId), vehicleId, ownerId],
        );

        if (existingAssignmentResult.rows.length) {
          throw new ConflictException(
            'This driver is already assigned to another vehicle',
          );
        }
      }

      // Update vehicle assignment.
      await client.query(
        `UPDATE vehicles
         SET assigned_driver_id = $1
         WHERE id::text = $2
           AND fleet_owner_user_id::text = $3`,
        [
          dto.driverId ?? null,
          vehicleId,
          ownerId,
        ],
      );

      await client.query('COMMIT');

      return {
        success: true,
        message:
          dto.driverId === null
            ? 'Driver unassigned from vehicle successfully.'
            : 'Driver assigned to vehicle successfully.',
        data: {
          vehicleId: String(vehicle.id),
          registrationNumber: vehicle.registration_number,
          assignedDriverId: assignedDriver
            ? String(assignedDriver.id)
            : null,
          assignedDriverName: assignedDriver
            ? assignedDriver.full_name
            : null,
          assignedAt: new Date().toISOString(),
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
