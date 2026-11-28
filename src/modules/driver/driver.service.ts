
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { mkdir, writeFile, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';



import { DatabaseService } from '../../database/database.service';

import { SubmitBankDetailsDto } from './dto/submit-bank-details.dto';
import { SubmitBackgroundCheckDto } from './dto/submit-background-check.dto';

@Injectable()
export class DriverService {
  constructor(private readonly db: DatabaseService) {}

  async getDashboard(userId: string) {
    // Get driver and assigned vehicle
    const driverResult = await this.db.query(
      `SELECT
          d.*,
          v.registration_number,
          v.vehicle_class
       FROM drivers d
       LEFT JOIN vehicles v
         ON v.id = d.assigned_vehicle_id
       WHERE d.user_id = $1
       LIMIT 1`,
      [userId],
    );

    const driver = driverResult.rows[0];

    if (!driver) {
      throw new NotFoundException(
        'Driver account not found.',
      );
    }

    // Get onboarding verification statuses
    const verificationResult = await this.db.query(
      `SELECT section, verification_status
       FROM driver_onboarding_reviews
       WHERE user_id = $1`,
      [userId],
    );

    const requiredSections = [
      'personalKyc',
      'vehicleKyc',
      'hygieneReefer',
      'bankPennyDrop',
      'backgroundCheck',
    ];

    const allVerified = requiredSections.every(
      (section) => {
        const review = verificationResult.rows.find(
          (row: any) => row.section === section,
        );

        return review?.verification_status === 'VERIFIED';
      },
    );

    // Do not allow an unverified driver to remain online
    let dutyStatus = driver.duty_status || 'OFFLINE';

    if (!allVerified && dutyStatus === 'ONLINE') {
      await this.db.query(
        `UPDATE drivers
         SET duty_status = 'OFFLINE',
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );

      await this.db.query(
        `UPDATE users
         SET duty_status = 'OFFLINE'
         WHERE id = $1`,
        [userId],
      );

      dutyStatus = 'OFFLINE';
    }

    const partnerStatus = allVerified
      ? 'ACTIVATED'
      : 'UNDER_REVIEW';

    return {
      dutyStatus,
      partnerStatus,

      assignedVehicle: driver.registration_number
        ? {
          vehicleId: driver.assigned_vehicle_id,
          vehicleNumber: driver.registration_number,
          vehicleClass: driver.vehicle_class,
        }
        : null,

      monthlySummary: {
        // Connect these values to actual earnings/trip tables
        // when their database schema is available.
        netEarningsInr: 0,

        completedTrips: Number(
          driver.trips_completed || 0,
        ),

        onTimeDeliveryRatePercent: Number(
          driver.on_time_delivery_rate || 0,
        ),

        tempComplianceScorePercent: Number(
          driver.temp_compliance_percent || 0,
        ),
      },

      // Active trip query will be added after confirming
      // your actual trips table and its status columns.
      activeTrip: null,

      // Compliance alerts will be connected to the
      // compliance document expiry fields.
      complianceAlerts: [],
    };
  }

  // =====================================================
  // API 9.2: UPDATE DRIVER DUTY STATUS
  // PATCH /api/v1/driver/duty/status
  // =====================================================

  async toggleDutyStatus(
    userId: string,
    body: any,
  ) {
    const {
      isDutyOnline,
      latitude,
      longitude,
      batteryPercentage,
    } = body;

    if (typeof isDutyOnline !== 'boolean') {
      throw new BadRequestException(
        'isDutyOnline must be true or false.',
      );
    }

    // Check driver account
    const driverResult = await this.db.query(
      `SELECT id, duty_status
       FROM drivers
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    );

    if (!driverResult.rows.length) {
      throw new NotFoundException(
        'Driver account not found.',
      );
    }

    // =================================================
    // GO ONLINE VALIDATION
    // =================================================

    if (isDutyOnline) {
      // Validate latitude and longitude
      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new BadRequestException(
          'Valid latitude and longitude are required to go online.',
        );
      }

      // Validate battery percentage
      if (
        batteryPercentage !== undefined &&
        (
          !Number.isInteger(batteryPercentage) ||
          batteryPercentage < 1 ||
          batteryPercentage > 100
        )
      ) {
        throw new BadRequestException(
          'Battery percentage must be between 1 and 100.',
        );
      }

      // Check all five onboarding verification sections
      const verificationResult = await this.db.query(
        `SELECT section, verification_status
         FROM driver_onboarding_reviews
         WHERE user_id = $1`,
        [userId],
      );

      const requiredSections = [
        'personalKyc',
        'vehicleKyc',
        'hygieneReefer',
        'bankPennyDrop',
        'backgroundCheck',
      ];

      const allVerified = requiredSections.every(
        (section) => {
          const review = verificationResult.rows.find(
            (row: any) => row.section === section,
          );

          return review?.verification_status === 'VERIFIED';
        },
      );

      if (!allVerified) {
        throw new BadRequestException(
          'Your account is not activated. Complete all verification steps before going online.',
        );
      }
    }

    // =================================================
    // UPDATE DUTY STATUS
    // =================================================

    const status = isDutyOnline
      ? 'ONLINE'
      : 'OFFLINE';

    // Update users table
    await this.db.query(
      `UPDATE users
       SET duty_status = $1,
           last_known_latitude = $2,
           last_known_longitude = $3,
           device_battery_percent = $4,
           last_ping_at = NOW()
       WHERE id = $5`,
      [
        status,
        isDutyOnline ? latitude : null,
        isDutyOnline ? longitude : null,
        isDutyOnline
          ? batteryPercentage ?? null
          : null,
        userId,
      ],
    );

    // Update drivers table
    await this.db.query(
      `UPDATE drivers
       SET duty_status = $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [status, userId],
    );

    return {
      dutyStatus: status,

      // Reverse geocoding is not connected yet.
      currentLocationName: null,

      locationConsentActive: isDutyOnline,

      lastPingTimestamp: isDutyOnline
        ? new Date().toISOString()
        : null,
    };
  }

  // =====================================================
  // DRIVER COMPLIANCE CALENDAR
  // GET /api/v1/driver/compliance/calendar
  // =====================================================

  async getComplianceCalendar(userId: string) {

    const docs = await this.db.query(
      `SELECT *
       FROM driver_compliance_documents
       WHERE driver_user_id = $1`,

  async inspectPartnerRoleSchema() {
    const vehicleColumnsResult = await this.db.query(
      `SELECT
     column_name,
     data_type,
     udt_name,
     is_nullable,
     column_default
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'vehicles'
   ORDER BY ordinal_position`,
    );
    const classes = await this.db.query(
      `SELECT
       unnest(enum_range(NULL::vehicle_class_code))::text
       AS "databaseVehicleClass"`,
    );

    const vehicles = await this.db.query(
      `SELECT
       id,
       registration_number,
       vehicle_class::text AS vehicle_class,
       vehicle_class_code_str,
       payload_capacity_kg,
       fleet_id,
       owner_user_id,
       kyc_status
     FROM vehicles
     ORDER BY created_at DESC
     LIMIT 20`,
    );

    return {
      allowedDatabaseClasses: classes.rows,
      existingVehicles: vehicles.rows,
      vehicleColumns: vehicleColumnsResult.rows,
    };
  }
  async selectPartnerRole(
    userId: string,
    body: { partnerRole: string },
  ) {
    const allowedRoles = [
      'DRIVER',
      'FLEET_OWNER',
      'OWNER_CUM_DRIVER',
    ];

    const partnerRole = body?.partnerRole?.trim().toUpperCase();

    if (!allowedRoles.includes(partnerRole)) {
      throw new BadRequestException(
        'Invalid partner role. Allowed roles: DRIVER, FLEET_OWNER, OWNER_CUM_DRIVER',
      );
    }

    const nextStep =
      partnerRole === 'DRIVER'
        ? 'LINK_FLEET'
        : 'PERSONAL_KYC';

    // Save role in users table
    const userResult = await this.db.query(
      `UPDATE users
       SET partner_role = $1,
           onboarding_step = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id`,
      [partnerRole, nextStep, userId],
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundException('User account not found');
    }

    // Update existing driver profile, if present
    await this.db.query(
      `UPDATE driver_profiles
       SET partner_role = $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [partnerRole, userId],
    );

    // Update existing driver record, if present
    await this.db.query(
      `UPDATE drivers
       SET partner_role = $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [partnerRole, userId],
    );

    return {
      userId,
      partnerRole,
      nextStep,
    };
  }
  async linkToFleet(
    userId: string,
    body: {
      fleetCode?: string;
      ownerMobileNumber?: string;
    },
  ) {
    const fleetCode = body?.fleetCode?.trim();
    const ownerMobileNumber = body?.ownerMobileNumber?.trim();

    if (!!fleetCode === !!ownerMobileNumber) {
      throw new BadRequestException(
        'Provide either fleetCode or ownerMobileNumber',
      );
    }

    if (
      ownerMobileNumber &&
      !/^\+91[6-9]\d{9}$/.test(ownerMobileNumber)
    ) {
      throw new BadRequestException('Invalid Indian mobile number');
    }

    const userResult = await this.db.query(
      `SELECT id, partner_role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundException('Driver account not found');
    }

    if (userResult.rows[0].partner_role !== 'DRIVER') {
      throw new BadRequestException(
        'Only employed drivers can link to a fleet',
      );
    }

    const fleetQuery = fleetCode
      ? `SELECT f.id, f.fleet_name, f.fleet_code,
                u.mobile_number AS owner_mobile_number
         FROM fleets f
         JOIN users u ON u.id = f.owner_user_id
         WHERE UPPER(f.fleet_code) = UPPER($1)
           AND f.is_active = TRUE
         LIMIT 2`
      : `SELECT f.id, f.fleet_name, f.fleet_code,
                u.mobile_number AS owner_mobile_number
         FROM fleets f
         JOIN users u ON u.id = f.owner_user_id
         WHERE u.mobile_number = $1
           AND f.is_active = TRUE
         ORDER BY f.created_at DESC
         LIMIT 2`;

    const fleetResult = await this.db.query(
      fleetQuery,
      [fleetCode || ownerMobileNumber],
    );

    if (fleetResult.rows.length === 0) {
      throw new NotFoundException('No active fleet found');
    }

    if (fleetResult.rows.length > 1) {
      throw new BadRequestException(
        'Multiple fleets found. Please use the fleet code',
      );
    }

    const fleet = fleetResult.rows[0];

    const existing = await this.db.query(
      `SELECT fleet_id, link_status
       FROM fleet_driver_links
       WHERE driver_user_id = $1
         AND UPPER(link_status) IN
             ('PENDING_APPROVAL', 'APPROVED', 'ACTIVE')
       ORDER BY invited_at DESC
       LIMIT 1`,
      [userId],
    );

    if (existing.rows.length > 0) {
      const current = existing.rows[0];

      if (
        current.fleet_id === fleet.id &&
        current.link_status.toUpperCase() === 'PENDING_APPROVAL'
      ) {
        return {
          fleetId: fleet.id,
          fleetName: fleet.fleet_name,
          ownerMobileNumber: fleet.owner_mobile_number,
          linkStatus: 'PENDING_APPROVAL',
          nextStep: 'PERSONAL_KYC',
        };
      }

      throw new ConflictException(
        'You already have a pending or active fleet connection',
      );
    }

    await this.db.query(
      `INSERT INTO fleet_driver_links
        (id, fleet_id, driver_user_id, link_status, invited_at, expires_at)
       VALUES
        ($1, $2, $3, 'PENDING_APPROVAL', NOW(),
         NOW() + INTERVAL '7 days')`,
      [randomUUID(), fleet.id, userId],
    );

    await this.db.query(
      `UPDATE driver_profiles
       SET fleet_id = $1,
           fleet_link_status = 'PENDING_APPROVAL',
           updated_at = NOW()
       WHERE user_id = $2`,
      [fleet.id, userId],
    );

    await this.db.query(
      `UPDATE users
       SET onboarding_step = 'PERSONAL_KYC',
           updated_at = NOW()
       WHERE id = $1`,

      [userId],
    );

    return {
      fleetId: fleet.id,
      fleetName: fleet.fleet_name,
      ownerMobileNumber: fleet.owner_mobile_number,
      linkStatus: 'PENDING_APPROVAL',
      nextStep: 'PERSONAL_KYC',
    };
  }
  // API 3.1 - Submit Personal and Driving Licence KYC
  async submitPersonalKyc(
    userId: string,
    body: {
      fullName: string;
      dateOfBirth: string;
      panNumber: string;
      aadhaarNumber: string;
      dlNumber: string;
      dlExpiryDate: string;
    },
    files: {
      aadhaarFrontPhoto?: any[];
      dlFrontPhoto?: any[];
      dlBackPhoto?: any[];
    },
  ) {
    const fullName =
      typeof body?.fullName === 'string'
        ? body.fullName.trim()
        : '';

    const dateOfBirth = body?.dateOfBirth?.trim();
    const panNumber = body?.panNumber?.trim().toUpperCase();
    const aadhaarNumber = body?.aadhaarNumber?.trim();
    const dlNumber = body?.dlNumber?.trim().toUpperCase();
    const dlExpiryDate = body?.dlExpiryDate?.trim();

    // Validate required fields
    if (
      !fullName ||
      !dateOfBirth ||
      !panNumber ||
      !aadhaarNumber ||
      !dlNumber ||
      !dlExpiryDate
    ) {
      throw new BadRequestException(
        'All personal and driving licence fields are required',
      );
    }

    // Validate full name
    if (fullName.length < 2 || fullName.length > 150) {
      throw new BadRequestException('Invalid full name');
    }

    // Validate PAN format
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
      throw new BadRequestException('Invalid PAN number format');
    }

    // Validate Aadhaar format
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      throw new BadRequestException(
        'Aadhaar number must contain exactly 12 digits',
      );
    }

    // Validate date format and actual calendar date
    const isValidDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (!isValidDate(dateOfBirth)) {
      throw new BadRequestException(
        'Date of birth must be in YYYY-MM-DD format',
      );
    }

    if (!isValidDate(dlExpiryDate)) {
      throw new BadRequestException(
        'DL expiry date must be in YYYY-MM-DD format',
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    if (dateOfBirth >= today) {
      throw new BadRequestException(
        'Date of birth must be in the past',
      );
    }

    if (dlExpiryDate <= today) {
      throw new BadRequestException(
        'Driving License must have a future expiry date',
      );
    }

    if (
      dlNumber.length < 5 ||
      dlNumber.length > 25 ||
      !/^[A-Z0-9/-]+$/.test(dlNumber)
    ) {
      throw new BadRequestException(
        'Invalid Driving License number',
      );
    }

    // Validate uploaded photos
    const aadhaarPhoto = files?.aadhaarFrontPhoto?.[0];
    const dlFrontPhoto = files?.dlFrontPhoto?.[0];
    const dlBackPhoto = files?.dlBackPhoto?.[0];

    if (!aadhaarPhoto || !dlFrontPhoto || !dlBackPhoto) {
      throw new BadRequestException(
        'Aadhaar front, DL front and DL back photos are all required',
      );
    }

    const uploadedPhotos = [
      aadhaarPhoto,
      dlFrontPhoto,
      dlBackPhoto,
    ];

    // Verify the actual image signatures
    const isValidImage = (file: any) => {
      const buffer: Buffer = file.buffer;

      if (!buffer || buffer.length === 0) {
        return false;
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          buffer.length >= 3 &&
          buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return buffer
          .subarray(0, 8)
          .equals(
            Buffer.from([
              0x89, 0x50, 0x4e, 0x47,
              0x0d, 0x0a, 0x1a, 0x0a,
            ]),
          );
      }

      if (file.mimetype === 'image/webp') {
        return (
          buffer.toString('ascii', 0, 4) === 'RIFF' &&
          buffer.toString('ascii', 8, 12) === 'WEBP'
        );
      }

      return false;
    };

    if (!uploadedPhotos.every(isValidImage)) {
      throw new BadRequestException(
        'One or more uploaded files are not valid image files',
      );
    }

    // Verify logged-in driver
    const userResult = await this.db.query(
      `SELECT id, mobile_number, partner_role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundException('Driver account not found');
    }

    const user = userResult.rows[0];

    if (user.partner_role !== 'DRIVER') {
      throw new BadRequestException(
        'This KYC submission is only available for DRIVER accounts',
      );
    }

    // Preserve existing fleet connection
    const fleetResult = await this.db.query(
      `SELECT fleet_id, link_status
       FROM fleet_driver_links
       WHERE driver_user_id = $1
         AND UPPER(link_status) IN
             ('PENDING_APPROVAL', 'APPROVED', 'ACTIVE')
       ORDER BY invited_at DESC
       LIMIT 1`,
      [userId],
    );

    const existingProfile = await this.db.query(
      `SELECT fleet_id, fleet_link_status
       FROM driver_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    );

    const fleetId =
      fleetResult.rows[0]?.fleet_id ??
      existingProfile.rows[0]?.fleet_id ??
      null;

    const fleetLinkStatus =
      fleetResult.rows[0]?.link_status ??
      existingProfile.rows[0]?.fleet_link_status ??
      'NOT_LINKED';

    // Save photos privately on the backend server
    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'driver-kyc',
    );

    const savedFilePaths: string[] = [];

    try {
      await mkdir(storageDirectory, { recursive: true });

      const savePrivateImage = async (file: any) => {
        const extension =
          file.mimetype === 'image/jpeg'
            ? '.jpg'
            : file.mimetype === 'image/png'
              ? '.png'
              : '.webp';

        const filename = `${randomUUID()}${extension}`;
        const filePath = join(storageDirectory, filename);

        await writeFile(filePath, file.buffer, {
          flag: 'wx',
        });

        savedFilePaths.push(filePath);

        // Private storage identifier, not a public URL
        return `private://driver-kyc/${filename}`;
      };

      const aadhaarPhotoPath =
        await savePrivateImage(aadhaarPhoto);

      const dlFrontPhotoPath =
        await savePrivateImage(dlFrontPhoto);

      const dlBackPhotoPath =
        await savePrivateImage(dlBackPhoto);

      // Update existing profile, or create a new one
      const profileUpdate = await this.db.query(
        `UPDATE driver_profiles
         SET full_name = $1,
             mobile_number = $2,
             date_of_birth = $3,
             pan_number = $4,
             aadhaar_number = $5,
             aadhaar_front_photo_url = $6,
             dl_number = $7,
             dl_expiry_date = $8,
             dl_front_photo_url = $9,
             dl_back_photo_url = $10,
             kyc_status = 'SUBMITTED',
             partner_role = 'DRIVER',
             fleet_id = $11,
             fleet_link_status = $12,
             updated_at = NOW()
         WHERE user_id = $13
         RETURNING id`,
        [
          fullName,
          user.mobile_number,
          dateOfBirth,
          panNumber,
          aadhaarNumber,
          aadhaarPhotoPath,
          dlNumber,
          dlExpiryDate,
          dlFrontPhotoPath,
          dlBackPhotoPath,
          fleetId,
          fleetLinkStatus,
          userId,
        ],
      );

      if (profileUpdate.rows.length === 0) {
        await this.db.query(
          `INSERT INTO driver_profiles
           (
             user_id,
             full_name,
             mobile_number,
             date_of_birth,
             pan_number,
             aadhaar_number,
             aadhaar_front_photo_url,
             dl_number,
             dl_expiry_date,
             dl_front_photo_url,
             dl_back_photo_url,
             kyc_status,
             partner_role,
             fleet_id,
             fleet_link_status
           )
           VALUES
           (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, 'SUBMITTED', 'DRIVER', $12, $13
           )`,
          [
            userId,
            fullName,
            user.mobile_number,
            dateOfBirth,
            panNumber,
            aadhaarNumber,
            aadhaarPhotoPath,
            dlNumber,
            dlExpiryDate,
            dlFrontPhotoPath,
            dlBackPhotoPath,
            fleetId,
            fleetLinkStatus,
          ],
        );
      }

      // Update existing driver master record if present
      await this.db.query(
        `UPDATE drivers
         SET full_name = $1,
             mobile_number = $2,
             license_number = $3,
             kyc_status = 'SUBMITTED',
             updated_at = NOW()
         WHERE user_id = $4`,
        [
          fullName,
          user.mobile_number,
          dlNumber,
          userId,
        ],
      );

      // Move user to the next onboarding step
      await this.db.query(
        `UPDATE users
         SET full_name = $1,
             onboarding_step = 'VEHICLE_KYC',
             updated_at = NOW()
         WHERE id = $2`,
        [fullName, userId],
      );

      return {
        userId,
        fullName,
        panNumber,
        maskedAadhaar: `••••••••${aadhaarNumber.slice(-4)}`,
        dlNumber,
        dlExpiryDate,
        kycStatus: 'SUBMITTED',
        nextStep: 'VEHICLE_KYC',
      };
    } catch (error) {
      // Remove uploaded files if database saving fails
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }
  // API 4.1 - Register Vehicle
  async registerVehicle(
    userId: string,
    body: {
      vehicleNumber: string;
      vehicleClass: string;
      payloadCapacityKg: string;
      fitnessExpiryDate: string;
      permitExpiryDate: string;
    },
    files: {
      rcPhoto?: any[];
      insuranceDoc?: any[];
      goodsInsuranceDoc?: any[];
    },
  ) {
    const vehicleNumber = body?.vehicleNumber?.trim().toUpperCase();
    const vehicleClass = body?.vehicleClass?.trim().toUpperCase();
    const payloadCapacityKg = Number(body?.payloadCapacityKg);
    const fitnessExpiryDate = body?.fitnessExpiryDate?.trim();
    const permitExpiryDate = body?.permitExpiryDate?.trim();

    if (
      !vehicleNumber ||
      !vehicleClass ||
      !fitnessExpiryDate ||
      !permitExpiryDate ||
      !body.payloadCapacityKg
    ) {
      throw new BadRequestException(
        'All required vehicle details must be provided',
      );
    }

    if (
      vehicleNumber.length < 5 ||
      vehicleNumber.length > 20
    ) {
      throw new BadRequestException('Invalid vehicle number');
    }

    if (
      !Number.isInteger(payloadCapacityKg) ||
      payloadCapacityKg <= 0
    ) {
      throw new BadRequestException(
        'Payload capacity must be a positive whole number',
      );
    }

    const isValidDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    const today = new Date().toISOString().slice(0, 10);

    if (
      !isValidDate(fitnessExpiryDate) ||
      !isValidDate(permitExpiryDate)
    ) {
      throw new BadRequestException(
        'Expiry dates must use YYYY-MM-DD format',
      );
    }

    if (
      fitnessExpiryDate <= today ||
      permitExpiryDate <= today
    ) {
      throw new BadRequestException(
        'Fitness and permit expiry dates must be in the future',
      );
    }

    // Provisional compatibility mapping.
    // Fleet/database owner must confirm these mappings.
    const classMapping: Record<string, string> = {
      REEFER_14FT: 'tata_407_14ft',
      REEFER_24FT: 'bharatbenz_24ft',
    };

    const allowedDatabaseClasses = [
      'tata_407_14ft',
      'eicher_20ft',
      'bharatbenz_24ft',
      'multi_axle_32ft',
    ];

    const databaseVehicleClass =
      classMapping[vehicleClass] || vehicleClass.toLowerCase();

    if (
      !allowedDatabaseClasses.includes(databaseVehicleClass)
    ) {
      throw new BadRequestException(
        `Vehicle class ${vehicleClass} has no confirmed database mapping. Please confirm the mapping for this vehicle class.`,
      );
    }

    // Mandatory documents
    const rcPhoto = files?.rcPhoto?.[0];
    const insuranceDoc = files?.insuranceDoc?.[0];

    // Optional document
    const goodsInsuranceDoc = files?.goodsInsuranceDoc?.[0];

    if (!rcPhoto || !insuranceDoc) {
      throw new BadRequestException(
        'RC photo and Insurance document are required',
      );
    }

    // Validate actual uploaded file content
    const isValidDocument = (file: any) => {
      if (!file?.buffer || file.buffer.length === 0) {
        return false;
      }

      if (file.mimetype === 'application/pdf') {
        return file.buffer.toString('ascii', 0, 5) === '%PDF-';
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          file.buffer.length >= 3 &&
          file.buffer[0] === 0xff &&
          file.buffer[1] === 0xd8 &&
          file.buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return file.buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ]),
        );
      }

      if (file.mimetype === 'image/webp') {
        return (
          file.buffer.toString('ascii', 0, 4) === 'RIFF' &&
          file.buffer.toString('ascii', 8, 12) === 'WEBP'
        );
      }

      return false;
    };

    const documents = [
      rcPhoto,
      insuranceDoc,
      ...(goodsInsuranceDoc ? [goodsInsuranceDoc] : []),
    ];

    if (!documents.every(isValidDocument)) {
      throw new BadRequestException(
        'One or more uploaded documents are invalid',
      );
    }

    // Verify the user and partner role
    const userResult = await this.db.query(
      `SELECT id, partner_role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundException('User account not found');
    }

    const partnerRole = userResult.rows[0].partner_role;

    if (
      !['FLEET_OWNER', 'OWNER_CUM_DRIVER'].includes(partnerRole)
    ) {
      throw new BadRequestException(
        'Vehicle registration is available only for FLEET_OWNER and OWNER_CUM_DRIVER accounts',
      );
    }

    // Find active fleet for a fleet owner
    let fleetId: string | null = null;

    if (partnerRole === 'FLEET_OWNER') {
      const fleetResult = await this.db.query(
        `SELECT id
         FROM fleets
         WHERE owner_user_id = $1
           AND is_active = TRUE
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId],
      );

      if (fleetResult.rows.length === 0) {
        throw new NotFoundException(
          'No active fleet is registered for this fleet owner',
        );
      }

      fleetId = fleetResult.rows[0].id;
    }

    // Private document storage
    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'vehicle-kyc',
    );

    const savedFilePaths: string[] = [];

    const saveDocument = async (file: any) => {
      const extension =
        file.mimetype === 'application/pdf'
          ? '.pdf'
          : file.mimetype === 'image/jpeg'
            ? '.jpg'
            : file.mimetype === 'image/png'
              ? '.png'
              : '.webp';

      const filename = `${randomUUID()}${extension}`;
      const filePath = join(storageDirectory, filename);

      await writeFile(filePath, file.buffer, {
        flag: 'wx',
      });

      savedFilePaths.push(filePath);

      return `private://vehicle-kyc/${filename}`;
    };

    try {
      await mkdir(storageDirectory, { recursive: true });

      const rcDocUrl = await saveDocument(rcPhoto);
      const insuranceDocUrl = await saveDocument(insuranceDoc);

      const goodsInsuranceDocUrl = goodsInsuranceDoc
        ? await saveDocument(goodsInsuranceDoc)
        : null;

      const vehicleResult = await this.db.query(
        `INSERT INTO vehicles (
           registration_number,
           vehicle_class,
           vehicle_class_code_str,
           payload_capacity_kg,
           owner_user_id,
           fleet_id,
           rc_doc_url,
           insurance_doc_url,
           goods_insurance_doc_url,
           fitness_expiry_date,
           permit_expiry_date,
           vehicle_status,
           kyc_status,
           is_active,
           updated_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           'PENDING_VERIFICATION',
           'PENDING_VERIFICATION',
           FALSE,
           NOW()
         )
         RETURNING id`,
        [
          vehicleNumber,
          databaseVehicleClass,
          vehicleClass,
          payloadCapacityKg,
          userId,
          fleetId,
          rcDocUrl,
          insuranceDocUrl,
          goodsInsuranceDocUrl,
          fitnessExpiryDate,
          permitExpiryDate,
        ],
      );

      const vehicleId = vehicleResult.rows[0].id;

      return {
        vehicleId,
        vehicleNumber,
        vehicleClass,
        status: 'PENDING_VERIFICATION',
        nextStep: 'HYGIENE_REEFER_KYC',
      };
    } catch (error: any) {
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      if (error?.code === '23505') {
        throw new ConflictException(
          'This vehicle registration number is already registered',
        );
      }

      throw error;
    }
  }
  // API 5.1 - Submit Reefer Specifications & Hygiene Records
  async submitReeferHygiene(
    userId: string,
    body: {
      vehicleId: string;
      reeferMake: string;
      reeferModel: string;
      reeferSerialNumber: string;
      minTempCapabilityCelsius: string;
      maxTempCapabilityCelsius: string;
      calibrationExpiryDate: string;
    },
    files: {
      calibrationCert?: any[];
      pestControlCert?: any[];
      containerInteriorPhoto?: any[];
    },
  ) {
    const vehicleId = body?.vehicleId?.trim();
    const reeferMake = body?.reeferMake?.trim();
    const reeferModel = body?.reeferModel?.trim();
    const reeferSerialNumber = body?.reeferSerialNumber?.trim();

    const minTemp = Number(body?.minTempCapabilityCelsius);
    const maxTemp = Number(body?.maxTempCapabilityCelsius);

    const calibrationExpiryDate =
      body?.calibrationExpiryDate?.trim();

    if (
      !vehicleId ||
      !reeferMake ||
      !reeferModel ||
      !reeferSerialNumber ||
      body?.minTempCapabilityCelsius === undefined ||
      body?.maxTempCapabilityCelsius === undefined ||
      !calibrationExpiryDate
    ) {
      throw new BadRequestException(
        'All required reefer and hygiene details must be provided',
      );
    }

    // Validate UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(vehicleId)) {
      throw new BadRequestException('Invalid vehicle ID');
    }

    // Validate temperatures
    if (
      !Number.isFinite(minTemp) ||
      !Number.isFinite(maxTemp) ||
      minTemp >= maxTemp
    ) {
      throw new BadRequestException(
        'Minimum temperature must be less than maximum temperature',
      );
    }

    // Validate expiry date
    const isValidDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    const today = new Date().toISOString().slice(0, 10);

    if (
      !isValidDate(calibrationExpiryDate) ||
      calibrationExpiryDate <= today
    ) {
      throw new BadRequestException(
        'Calibration expiry date must be a valid future date in YYYY-MM-DD format',
      );
    }

    // Validate required documents
    const calibrationCert = files?.calibrationCert?.[0];
    const pestControlCert = files?.pestControlCert?.[0];
    const containerInteriorPhoto =
      files?.containerInteriorPhoto?.[0];

    if (
      !calibrationCert ||
      !pestControlCert ||
      !containerInteriorPhoto
    ) {
      throw new BadRequestException(
        'Calibration certificate, pest control certificate and container interior photo are required',
      );
    }

    // Verify actual file content
    const isValidFile = (file: any) => {
      if (!file?.buffer || file.buffer.length === 0) {
        return false;
      }

      if (file.mimetype === 'application/pdf') {
        return (
          file.buffer.toString('ascii', 0, 5) === '%PDF-'
        );
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          file.buffer.length >= 3 &&
          file.buffer[0] === 0xff &&
          file.buffer[1] === 0xd8 &&
          file.buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return file.buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ]),
        );
      }

      if (file.mimetype === 'image/webp') {
        return (
          file.buffer.toString('ascii', 0, 4) === 'RIFF' &&
          file.buffer.toString('ascii', 8, 12) === 'WEBP'
        );
      }

      return false;
    };

    if (
      !isValidFile(calibrationCert) ||
      !isValidFile(pestControlCert) ||
      !isValidFile(containerInteriorPhoto)
    ) {
      throw new BadRequestException(
        'One or more uploaded documents have invalid file content',
      );
    }

    // The interior photo must be an image, not a PDF
    if (
      containerInteriorPhoto.mimetype === 'application/pdf'
    ) {
      throw new BadRequestException(
        'Container interior photo must be an image',
      );
    }

    // Verify vehicle ownership and permitted partner role
    const vehicleResult = await this.db.query(
      `SELECT v.id
       FROM vehicles v
       JOIN users u ON u.id = $2
       WHERE v.id = $1
         AND (
           (
             u.partner_role = 'OWNER_CUM_DRIVER'
             AND v.owner_user_id = $2
           )
           OR
           (
             u.partner_role = 'FLEET_OWNER'
             AND EXISTS (
               SELECT 1
               FROM fleets f
               WHERE f.id = v.fleet_id
                 AND f.owner_user_id = $2
                 AND f.is_active = TRUE
             )
           )
         )
       LIMIT 1`,
      [vehicleId, userId],
    );

    if (vehicleResult.rows.length === 0) {
      throw new NotFoundException(
        'Vehicle not found or you are not authorized to submit its hygiene details',
      );
    }

    // Store documents privately
    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'reefer-hygiene',
    );

    const savedFilePaths: string[] = [];

    const saveDocument = async (file: any) => {
      const extension =
        file.mimetype === 'application/pdf'
          ? '.pdf'
          : file.mimetype === 'image/jpeg'
            ? '.jpg'
            : file.mimetype === 'image/png'
              ? '.png'
              : '.webp';

      const filename = `${randomUUID()}${extension}`;
      const filePath = join(storageDirectory, filename);

      await writeFile(filePath, file.buffer, {
        flag: 'wx',
      });

      savedFilePaths.push(filePath);

      return `private://reefer-hygiene/${filename}`;
    };

    try {
      await mkdir(storageDirectory, { recursive: true });

      const calibrationCertUrl =
        await saveDocument(calibrationCert);

      const pestControlCertUrl =
        await saveDocument(pestControlCert);

      const containerInteriorPhotoUrl =
        await saveDocument(containerInteriorPhoto);

      const updateResult = await this.db.query(
        `UPDATE vehicles
         SET
           reefer_make = $1,
           reefer_model = $2,
           reefer_serial_number = $3,
           min_temp_capability_c = $4,
           max_temp_capability_c = $5,
           calibration_expiry_date = $6,
           calibration_cert_url = $7,
           pest_control_cert_url = $8,
           container_interior_photo_url = $9,
           updated_at = NOW()
         WHERE id = $10
         RETURNING
           id,
           reefer_make,
           min_temp_capability_c,
           max_temp_capability_c`,
        [
          reeferMake,
          reeferModel,
          reeferSerialNumber,
          minTemp,
          maxTemp,
          calibrationExpiryDate,
          calibrationCertUrl,
          pestControlCertUrl,
          containerInteriorPhotoUrl,
          vehicleId,
        ],
      );

      if (updateResult.rows.length === 0) {
        throw new NotFoundException('Vehicle not found');
      }

      const savedVehicle = updateResult.rows[0];

      return {
        vehicleId: savedVehicle.id,
        reeferMake: savedVehicle.reefer_make,
        minTempCapabilityCelsius: Number(
          savedVehicle.min_temp_capability_c,
        ),
        maxTempCapabilityCelsius: Number(
          savedVehicle.max_temp_capability_c,
        ),
        hygieneStatus: 'SUBMITTED',
        nextStep: 'BANK_PAYOUT_VERIFICATION',
      };
    } catch (error: any) {
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }
  // DEBUG: Inspect tables required for Driver API 16.1

  async inspectTripCargoSchema() {
    const result = await this.db.query(
      `
    SELECT
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND (
        column_name IN (
          'id',
          'trip_ref',
          'trip_id',
          'driver_user_id',
          'fleet_assigned_driver_id',
          'booking_id',
          'status',
          'created_at',
          'updated_at'
        )
        OR column_name ILIKE '%receiver%'
        OR column_name ILIKE '%pod%'
        OR column_name ILIKE '%epod%'
        OR column_name ILIKE '%signature%'
        OR column_name ILIKE '%stamp%'
        OR column_name ILIKE '%delivery%'
        OR column_name ILIKE '%outcome%'
        OR column_name ILIKE '%lorry%'
        OR column_name ILIKE '%handover%'
      )
    ORDER BY ordinal_position
    `,
    );

    return {
      columns: result.rows,
    };
  }



  // API 10.1 - Accept Dispatch Job Offer
  async acceptDispatchOffer(
    userId: string,
    tripId: string,
    body: {
      acceptedAtLatitude: number | string;
      acceptedAtLongitude: number | string;
    },
  ) {
    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and Trip ID are required',
      );
    }

    const latitude = Number(body?.acceptedAtLatitude);
    const longitude = Number(body?.acceptedAtLongitude);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new BadRequestException(
        'Valid acceptedAtLatitude is required',
      );
    }

    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException(
        'Valid acceptedAtLongitude is required',
      );
    }

    // Accept only an existing, eligible offer linked to this driver.
    const result = await this.db.query(
      `UPDATE trips t
       SET
         driver_user_id = $2,
         vehicle_id = COALESCE(t.vehicle_id, d.assigned_vehicle_id),
         fleet_id = COALESCE(t.fleet_id, d.fleet_id),
         accepted_at_latitude = $3,
         accepted_at_longitude = $4,
         accepted_at = NOW(),
         status = 'ACCEPTED',
         updated_at = NOW()
       FROM drivers d
       WHERE d.user_id = $2
         AND d.is_active IS DISTINCT FROM FALSE

         AND (t.trip_ref = $1 OR t.trip_id = $1)

         AND (
           t.driver_user_id IS NULL
           OR t.driver_user_id = $2
         )

         AND (
           t.fleet_assigned_driver_id IS NULL
           OR t.fleet_assigned_driver_id = d.id
         )

         AND (
           t.offer_expires_at IS NULL
           OR t.offer_expires_at > NOW()
         )

         AND UPPER(COALESCE(t.status, '')) NOT IN (
           'ACCEPTED',
           'IN_PROGRESS',
           'COMPLETED',
           'CANCELLED',
           'CANCELED',
           'DECLINED',
           'OFFER_DECLINED'
         )

         AND NOT EXISTS (
           SELECT 1
           FROM bookings b
           WHERE b.id = t.booking_id
             AND b.assigned_driver_id IS NOT NULL
             AND b.assigned_driver_id <> d.id
         )

         AND (
           t.driver_user_id = $2

           OR t.fleet_assigned_driver_id = d.id

           OR EXISTS (
             SELECT 1
             FROM bookings b
             WHERE b.id = t.booking_id
               AND b.assigned_driver_id = d.id
           )

           OR d.trip_ref = t.trip_ref

           OR (
             d.trip_id IS NOT NULL
             AND d.trip_id = t.trip_id
           )

           OR EXISTS (
             SELECT 1
             FROM fleet_trip_assignments fta
             WHERE fta.trip_id IN (t.trip_ref, t.trip_id)
               AND fta.driver_id = d.id
           )
         )
       RETURNING t.trip_ref, t.trip_id, t.status`,
      [tripId.trim(), userId, latitude, longitude],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(
        'Dispatch offer not found, expired, or not assigned to this driver',
      );
    }

    const acceptedTrip = result.rows[0];

    return {
      tripId:
        acceptedTrip.trip_ref ||
        acceptedTrip.trip_id ||
        tripId,
      status: 'ACCEPTED',
      nextStep: 'PRE_TRIP_INSPECTION',
    };
  }


  // API 16.1 - Submit Cargo Condition & Core Temperature Intake Check
  async submitCargoIntakeCheck(
    userId: string,
    tripId: string,
    body: {
      cargoIntakeTempCelsius: string;
      tempProbeId: string;
      packagingCondition: string;
      labelCompliance: string;
      cargoAccepted: string;
    },
    files: {
      cargoIntakeTempProbePhoto?: any[];
      cargoPhotos?: any[];
    },
  ) {
    if (!tripId || !userId) {
      throw new BadRequestException('Trip ID and authentication are required');
    }

    const temperature = Number(body?.cargoIntakeTempCelsius);
    const tempProbeId = body?.tempProbeId?.trim();
    const packagingCondition = body?.packagingCondition?.trim();
    const labelCompliance = body?.labelCompliance?.trim();

    if (!Number.isFinite(temperature)) {
      throw new BadRequestException('Valid cargo intake temperature is required');
    }

    if (!tempProbeId) {
      throw new BadRequestException('Temperature probe ID is required');
    }

    const allowedPackaging = [
      'GOOD_SEALED',
      'DAMAGED',
      'WET_LEAKING',
      'INCORRECT_PACKAGING',
      'LABELS_MISSING',
    ];

    if (!allowedPackaging.includes(packagingCondition)) {
      throw new BadRequestException('Invalid packaging condition');
    }

    if (!['COMPLIANT', 'ISSUE_FOUND'].includes(labelCompliance)) {
      throw new BadRequestException('Invalid label compliance value');
    }

    const acceptedValue = String(body?.cargoAccepted).toLowerCase();

    if (!['true', 'false'].includes(acceptedValue)) {
      throw new BadRequestException('cargoAccepted must be true or false');
    }

    const cargoAccepted = acceptedValue === 'true';

    const probePhoto = files?.cargoIntakeTempProbePhoto?.[0];
    const cargoPhotos = files?.cargoPhotos || [];

    if (!probePhoto) {
      throw new BadRequestException(
        'Cargo intake temperature probe photo is mandatory',
      );
    }

    if (cargoPhotos.length < 1) {
      throw new BadRequestException(
        'At least one cargo condition photo is required',
      );
    }

    const allPhotos = [probePhoto, ...cargoPhotos];

    const isValidImage = (file: any) => {
      const buffer: Buffer = file?.buffer;

      if (!buffer || buffer.length === 0) return false;

      if (file.mimetype === 'image/jpeg') {
        return (
          buffer.length >= 3 &&
          buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ]),
        );
      }

      if (file.mimetype === 'image/webp') {
        return (
          buffer.toString('ascii', 0, 4) === 'RIFF' &&
          buffer.toString('ascii', 8, 12) === 'WEBP'
        );
      }

      return false;
    };

    if (!allPhotos.every(isValidImage)) {
      throw new BadRequestException(
        'One or more uploaded images have invalid file content',
      );
    }

    // Find trip and verify that it belongs to this driver.
    const tripResult = await this.db.query(
      `SELECT t.id, t.trip_ref, t.trip_id
       FROM trips t
       WHERE (t.trip_ref = $1 OR t.trip_id = $1)
         AND (
           t.driver_user_id = $2
           OR EXISTS (
             SELECT 1
             FROM drivers d
             WHERE d.id = t.fleet_assigned_driver_id
               AND d.user_id = $2
           )
           OR EXISTS (
             SELECT 1
             FROM bookings b
             JOIN drivers d ON d.id = b.assigned_driver_id
             WHERE b.id = t.booking_id
               AND d.user_id = $2
           )
         )
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [tripId, userId],
    );

    if (tripResult.rows.length === 0) {
      throw new NotFoundException(
        'Trip not found or you are not authorized to update this trip',
      );
    }

    const trip = tripResult.rows[0];

    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-cargo-intake',
    );

    const savedFilePaths: string[] = [];

    const saveImage = async (file: any) => {
      const extension =
        file.mimetype === 'image/jpeg'
          ? '.jpg'
          : file.mimetype === 'image/png'
            ? '.png'
            : '.webp';

      const filename = `${randomUUID()}${extension}`;
      const filePath = join(storageDirectory, filename);

      await writeFile(filePath, file.buffer, { flag: 'wx' });

      savedFilePaths.push(filePath);

      return `private://trip-cargo-intake/${filename}`;
    };

    try {
      await mkdir(storageDirectory, { recursive: true });

      const probePhotoUrl = await saveImage(probePhoto);

      const cargoPhotoUrls: string[] = [];

      for (const photo of cargoPhotos) {
        cargoPhotoUrls.push(await saveImage(photo));
      }

      const cargoCheckStatus = cargoAccepted
        ? 'ACCEPTED'
        : 'REFUSED';

      // Update trip and save all cargo photos in one SQL statement.
      const updateResult = await this.db.query(
        `WITH updated_trip AS (
           UPDATE trips
           SET
             cargo_intake_temp_c = $1,
             cargo_temp_probe_id = $2,
             cargo_probe_photo_url = $3,
             cargo_packaging_condition = $4,
             cargo_label_compliance = $5,
             cargo_check_status = $6,
             cargo_check_submitted_at = NOW(),
             updated_at = NOW()
           WHERE id = $7
             AND driver_user_id = $8
           RETURNING id, trip_ref
         ),
         inserted_photos AS (
           INSERT INTO trip_cargo_intake_photos
             (trip_id, photo_url, photo_order)
           SELECT
             ut.id,
             uploaded.photo_url,
             uploaded.photo_order::INTEGER
           FROM updated_trip ut
           CROSS JOIN UNNEST($9::TEXT[])
             WITH ORDINALITY
             AS uploaded(photo_url, photo_order)
           RETURNING id
         )
         SELECT
           ut.trip_ref,
           (SELECT COUNT(*)::INTEGER FROM inserted_photos)
             AS cargo_photo_count
         FROM updated_trip ut`,
        [
          temperature,
          tempProbeId,
          probePhotoUrl,
          packagingCondition,
          labelCompliance,
          cargoCheckStatus,
          trip.id,
          userId,
          cargoPhotoUrls,
        ],
      );

      if (updateResult.rows.length === 0) {
        throw new NotFoundException(
          'Trip could not be updated for this driver',
        );
      }

      return {
        tripId: updateResult.rows[0].trip_ref,
        cargoIntakeTempCelsius: temperature,
        cargoCheckStatus,
        cargoPhotoCount: updateResult.rows[0].cargo_photo_count,
        nextStep: cargoAccepted
          ? 'LOADING'
          : 'CARGO_REFUSAL_DETAILS',
      };
    } catch (error) {
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }

  // API 17.1 - Submit Cargo Refusal with Evidence
  async submitCargoRefusal(
    userId: string,
    tripId: string,
    body: {
      refusalReason: string;
      measuredTempCelsius: string;
      totalLoadedCount: string;
      refusedCount: string;
      quantityUnit: string;
      refusalRemarks: string;
      shipperRepresentativeName: string;
      detentionClaimRequired: string;
    },
    files: {
      shipperAcknowledgementPhoto?: any[];
      refusalEvidencePhotos?: any[];
    },
  ) {
    if (!userId || !tripId) {
      throw new BadRequestException(
        'Driver authentication and Trip ID are required',
      );
    }

    const refusalReason = body?.refusalReason?.trim().toUpperCase();
    const quantityUnit = body?.quantityUnit?.trim().toUpperCase();
    const refusalRemarks = body?.refusalRemarks?.trim();
    const representativeName =
      body?.shipperRepresentativeName?.trim();

    const measuredTempRaw = body?.measuredTempCelsius?.trim();
    const totalLoadedRaw = body?.totalLoadedCount?.trim();
    const refusedRaw = body?.refusedCount?.trim();

    if (
      !refusalReason ||
      !measuredTempRaw ||
      !totalLoadedRaw ||
      !refusedRaw ||
      !quantityUnit ||
      !refusalRemarks ||
      !representativeName
    ) {
      throw new BadRequestException(
        'All cargo refusal fields are required',
      );
    }

    const allowedReasons = [
      'PRODUCT_TOO_WARM',
      'CARGO_DAMAGED',
      'WRONG_PACKAGING',
      'WET_LEAKING',
      'INCORRECT_CARGO',
      'OTHER',
    ];

    if (!allowedReasons.includes(refusalReason)) {
      throw new BadRequestException('Invalid refusal reason');
    }

    const allowedUnits = [
      'BOXES',
      'PALLETS',
      'CARTONS',
      'KG',
    ];

    if (!allowedUnits.includes(quantityUnit)) {
      throw new BadRequestException('Invalid quantity unit');
    }

    const measuredTempCelsius = Number(measuredTempRaw);
    const totalLoadedCount = Number(totalLoadedRaw);
    const refusedCount = Number(refusedRaw);

    if (!Number.isFinite(measuredTempCelsius)) {
      throw new BadRequestException(
        'Valid measured temperature is required',
      );
    }

    if (
      !Number.isInteger(totalLoadedCount) ||
      totalLoadedCount < 1
    ) {
      throw new BadRequestException(
        'Total loaded count must be a positive integer',
      );
    }

    if (
      !Number.isInteger(refusedCount) ||
      refusedCount < 1 ||
      refusedCount > totalLoadedCount
    ) {
      throw new BadRequestException(
        'Refused count must be positive and cannot exceed total loaded count',
      );
    }

    if (
      refusalReason === 'OTHER' &&
      refusalRemarks.length < 5
    ) {
      throw new BadRequestException(
        'Please provide detailed remarks for OTHER refusal reason',
      );
    }

    if (representativeName.length < 2) {
      throw new BadRequestException(
        'Valid shipper representative name is required',
      );
    }

    const detentionValue = String(
      body?.detentionClaimRequired,
    ).trim().toLowerCase();

    if (!['true', 'false'].includes(detentionValue)) {
      throw new BadRequestException(
        'detentionClaimRequired must be true or false',
      );
    }

    const detentionClaimRequired = detentionValue === 'true';

    const acknowledgementPhoto =
      files?.shipperAcknowledgementPhoto?.[0];

    const evidencePhotos = files?.refusalEvidencePhotos || [];

    if (!acknowledgementPhoto) {
      throw new BadRequestException(
        'Shipper acknowledgement photo is mandatory',
      );
    }

    if (evidencePhotos.length < 2) {
      throw new BadRequestException(
        'At least two refusal evidence photos are required',
      );
    }

    const allPhotos = [
      acknowledgementPhoto,
      ...evidencePhotos,
    ];

    const isValidImage = (file: any) => {
      const buffer: Buffer = file?.buffer;

      if (!buffer || buffer.length === 0) {
        return false;
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          buffer.length >= 3 &&
          buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ]),
        );
      }

      if (file.mimetype === 'image/webp') {
        return (
          buffer.toString('ascii', 0, 4) === 'RIFF' &&
          buffer.toString('ascii', 8, 12) === 'WEBP'
        );
      }

      return false;
    };

    if (!allPhotos.every(isValidImage)) {
      throw new BadRequestException(
        'One or more uploaded images have invalid file content',
      );
    }

    // Find the trip and verify that it belongs to this driver.
    const tripResult = await this.db.query(
      `SELECT t.id, t.trip_ref, t.trip_id
       FROM trips t
       WHERE (t.trip_ref = $1 OR t.trip_id = $1)
         AND (
           t.driver_user_id = $2
           OR EXISTS (
             SELECT 1
             FROM drivers d
             WHERE d.id = t.fleet_assigned_driver_id
               AND d.user_id = $2
           )
           OR EXISTS (
             SELECT 1
             FROM bookings b
             JOIN drivers d ON d.id = b.assigned_driver_id
             WHERE b.id = t.booking_id
               AND d.user_id = $2
           )
         )
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [tripId, userId],
    );

    if (tripResult.rows.length === 0) {
      throw new NotFoundException(
        'Trip not found or you are not authorized to update this trip',
      );
    }

    const trip = tripResult.rows[0];

    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-cargo-refusal',
    );

    const savedFilePaths: string[] = [];

    const saveImage = async (file: any) => {
      const extension =
        file.mimetype === 'image/jpeg'
          ? '.jpg'
          : file.mimetype === 'image/png'
            ? '.png'
            : '.webp';

      const filename = `${randomUUID()}${extension}`;
      const filePath = join(storageDirectory, filename);

      await writeFile(filePath, file.buffer, { flag: 'wx' });
      savedFilePaths.push(filePath);

      return `private://trip-cargo-refusal/${filename}`;
    };

    try {
      await mkdir(storageDirectory, { recursive: true });

      const acknowledgementPhotoUrl =
        await saveImage(acknowledgementPhoto);

      const evidencePhotoUrls: string[] = [];

      for (const photo of evidencePhotos) {
        evidencePhotoUrls.push(await saveImage(photo));
      }

      // Save the refusal record in PostgreSQL.
      // No Ops ticket or notification is created by this insert.
      const insertResult = await this.db.query(
        `INSERT INTO trip_cargo_refusals (
           id,
           trip_id,
           refusal_reason,
           measured_temp_c,
           total_loaded_count,
           refused_count,
           quantity_unit,
           refusal_remarks,
           shipper_representative_name,
           shipper_acknowledgement_photo_url,
           refusal_evidence_photo_urls,
           detention_claim_required,
           ops_ticket_id,
           penalty_applied,
           submitted_at
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10::BIGINT,
           $11, $12, NULL, FALSE, NOW()
         )
         RETURNING id, ops_ticket_id, penalty_applied, submitted_at`,
        [
          randomUUID(),
          trip.id,
          refusalReason,
          measuredTempCelsius,
          totalLoadedCount,
          refusedCount,
          quantityUnit,
          refusalRemarks,
          representativeName,
          acknowledgementPhotoUrl,
          evidencePhotoUrls,
          detentionClaimRequired,
        ],
      );

      if (insertResult.rows.length === 0) {
        throw new Error('Cargo refusal record was not saved');
      }

      const savedRecord = insertResult.rows[0];

      return {
        refusalId: savedRecord.id,
        tripId: trip.trip_ref || trip.trip_id,
        refusalStatus: 'RECORDED',
        opsTicketId: savedRecord.ops_ticket_id,
        penaltyApplied: savedRecord.penalty_applied,
        detentionClaimRaised: detentionClaimRequired,
        evidencePhotoCount: evidencePhotoUrls.length,
        nextStep: 'AWAIT_OPS_INSTRUCTION',
        submittedAt: savedRecord.submitted_at,
      };
    } catch (error) {
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }

  // API 18.1 - Submit Loading Proof, Cargo Counts & Door Exposure Log
  async submitLoadingProof(
    userId: string,
    tripId: string,
    body: {
      compartmentNumber: string;
      palletCount: string;
      cartonCount: string;
      cargoDescription: string;
      doorOpenTimestamp: string;
      doorCloseTimestamp: string;
      doorOpenDurationSeconds: string;
      loadingSequenceConfirmed: string;
      boltSealNumber: string;
    },
    files: {
      boltSealPhoto?: any[];
      loadingPhotos?: any[];
    },
  ) {
    if (!userId || !tripId) {
      throw new BadRequestException(
        'Driver authentication and Trip ID are required',
      );
    }

    const compartmentNumber = Number(body?.compartmentNumber);
    const palletCount = Number(body?.palletCount);
    const cartonCount = Number(body?.cartonCount);

    const cargoDescription = body?.cargoDescription?.trim();
    const boltSealNumber = body?.boltSealNumber?.trim();

    const openTimestamp = body?.doorOpenTimestamp?.trim();
    const closeTimestamp = body?.doorCloseTimestamp?.trim();

    if (![1, 2].includes(compartmentNumber)) {
      throw new BadRequestException(
        'Compartment number must be 1 or 2',
      );
    }

    if (
      !Number.isInteger(palletCount) ||
      palletCount < 0
    ) {
      throw new BadRequestException(
        'Pallet count must be a non-negative integer',
      );
    }

    if (
      !Number.isInteger(cartonCount) ||
      cartonCount < 0
    ) {
      throw new BadRequestException(
        'Carton count must be a non-negative integer',
      );
    }

    if (palletCount === 0 && cartonCount === 0) {
      throw new BadRequestException(
        'At least one pallet or carton must be loaded',
      );
    }

    if (!cargoDescription) {
      throw new BadRequestException(
        'Cargo description is required',
      );
    }

    if (!boltSealNumber) {
      throw new BadRequestException(
        'Bolt seal number is required',
      );
    }

    if (!openTimestamp || !closeTimestamp) {
      throw new BadRequestException(
        'Door open and close timestamps are required',
      );
    }

    const openDate = new Date(openTimestamp);
    const closeDate = new Date(closeTimestamp);

    if (
      Number.isNaN(openDate.getTime()) ||
      Number.isNaN(closeDate.getTime())
    ) {
      throw new BadRequestException(
        'Door timestamps must be valid ISO date-time values',
      );
    }

    if (closeDate.getTime() <= openDate.getTime()) {
      throw new BadRequestException(
        'Door close timestamp must be after door open timestamp',
      );
    }

    // Calculate duration from the actual timestamps.
    const calculatedDurationSeconds = Math.round(
      (closeDate.getTime() - openDate.getTime()) / 1000,
    );

    const suppliedDuration = Number(
      body?.doorOpenDurationSeconds,
    );

    if (
      !Number.isInteger(suppliedDuration) ||
      suppliedDuration !== calculatedDurationSeconds
    ) {
      throw new BadRequestException(
        `Door open duration must match timestamps: ${calculatedDurationSeconds} seconds`,
      );
    }

    const sequenceValue = String(
      body?.loadingSequenceConfirmed,
    ).trim().toLowerCase();

    if (!['true', 'false'].includes(sequenceValue)) {
      throw new BadRequestException(
        'loadingSequenceConfirmed must be true or false',
      );
    }

    const loadingSequenceConfirmed = sequenceValue === 'true';

    const boltSealPhoto = files?.boltSealPhoto?.[0];
    const loadingPhotos = files?.loadingPhotos || [];

    if (!boltSealPhoto) {
      throw new BadRequestException(
        'Bolt seal photo is mandatory',
      );
    }

    if (loadingPhotos.length < 2) {
      throw new BadRequestException(
        'At least two loading photos are required',
      );
    }

    const allPhotos = [boltSealPhoto, ...loadingPhotos];

    const isValidImage = (file: any) => {
      const buffer: Buffer = file?.buffer;

      if (!buffer || buffer.length === 0) {
        return false;
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          buffer.length >= 3 &&
          buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ]),
        );
      }

      if (file.mimetype === 'image/webp') {
        return (
          buffer.toString('ascii', 0, 4) === 'RIFF' &&
          buffer.toString('ascii', 8, 12) === 'WEBP'
        );
      }

      return false;
    };

    if (!allPhotos.every(isValidImage)) {
      throw new BadRequestException(
        'One or more uploaded images have invalid file content',
      );
    }

    // Find the trip and verify driver ownership.
    // Also require the selected compartment to exist.
    const tripResult = await this.db.query(
      `SELECT
         t.id,
         t.trip_ref,
         t.trip_id
       FROM trips t
       WHERE (t.trip_ref = $1 OR t.trip_id = $1)
         AND (
           t.driver_user_id = $2
           OR EXISTS (
             SELECT 1
             FROM drivers d
             WHERE d.id = t.fleet_assigned_driver_id
               AND d.user_id = $2
           )
           OR EXISTS (
             SELECT 1
             FROM bookings b
             JOIN drivers d ON d.id = b.assigned_driver_id
             WHERE b.id = t.booking_id
               AND d.user_id = $2
           )
         )
         AND EXISTS (
           SELECT 1
           FROM trip_compartments tc
           WHERE (
             (tc.trip_ref = t.trip_ref AND tc.trip_ref IS NOT NULL)
             OR
             (tc.trip_id = t.trip_id AND tc.trip_id IS NOT NULL)
           )
           AND tc.compartment_number = $3
         )
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [tripId, userId, compartmentNumber],
    );

    if (tripResult.rows.length === 0) {
      throw new NotFoundException(
        'Trip or assigned compartment not found for this driver',
      );
    }

    const trip = tripResult.rows[0];

    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-loading',
    );

    const savedFilePaths: string[] = [];

    const saveImage = async (file: any) => {
      const extension =
        file.mimetype === 'image/jpeg'
          ? '.jpg'
          : file.mimetype === 'image/png'
            ? '.png'
            : '.webp';

      const filename = `${randomUUID()}${extension}`;
      const filePath = join(storageDirectory, filename);

      await writeFile(filePath, file.buffer, { flag: 'wx' });
      savedFilePaths.push(filePath);

      return `private://trip-loading/${filename}`;
    };

    try {
      await mkdir(storageDirectory, { recursive: true });

      const boltSealPhotoUrl = await saveImage(boltSealPhoto);

      const loadingPhotoUrls: string[] = [];

      for (const photo of loadingPhotos) {
        loadingPhotoUrls.push(await saveImage(photo));
      }

      // Save trip-level loading data and compartment-level data.
      const updateResult = await this.db.query(
        `WITH authorized_trip AS (
           SELECT t.id, t.trip_ref, t.trip_id
           FROM trips t
           WHERE t.id = $1
             AND (
               t.driver_user_id = $2
               OR EXISTS (
                 SELECT 1
                 FROM drivers d
                 WHERE d.id = t.fleet_assigned_driver_id
                   AND d.user_id = $2
               )
               OR EXISTS (
                 SELECT 1
                 FROM bookings b
                 JOIN drivers d ON d.id = b.assigned_driver_id
                 WHERE b.id = t.booking_id
                   AND d.user_id = $2
               )
             )
         ),
         updated_trip AS (
           UPDATE trips t
           SET
             loading_pallet_count = $3,
             loading_carton_count = $4,
             loading_cargo_description = $5,
             loading_door_open_timestamp = $6,
             loading_door_close_timestamp = $7,
             loading_door_open_duration_seconds = $8,
             loading_sequence_confirmed = $9,
             bolt_seal_number = $10,
             bolt_seal_photo_url = $11,
             loading_photo_urls = $12::TEXT[],
             loading_status = 'RECORDED',
             updated_at = NOW()
           FROM authorized_trip a
           WHERE t.id = a.id
           RETURNING t.id, t.trip_ref, t.trip_id
         ),
         updated_compartment AS (
           UPDATE trip_compartments tc
           SET
             pallet_count = $3,
             pallets_loaded = $3,
             cargo_description = $5
           FROM updated_trip ut
           WHERE (
             (tc.trip_ref = ut.trip_ref AND tc.trip_ref IS NOT NULL)
             OR
             (tc.trip_id = ut.trip_id AND tc.trip_id IS NOT NULL)
           )
             AND tc.compartment_number = $13
           RETURNING tc.id
         )
         SELECT
           ut.trip_ref,
           ut.trip_id,
           (SELECT COUNT(*)::INTEGER FROM updated_compartment)
             AS compartment_rows_updated
         FROM updated_trip ut`,
        [
          trip.id,
          userId,
          palletCount,
          cartonCount,
          cargoDescription,
          openDate.toISOString(),
          closeDate.toISOString(),
          calculatedDurationSeconds,
          loadingSequenceConfirmed,
          boltSealNumber,
          boltSealPhotoUrl,
          loadingPhotoUrls,
          compartmentNumber,
        ],
      );

      if (
        updateResult.rows.length === 0 ||
        Number(updateResult.rows[0].compartment_rows_updated) < 1
      ) {
        throw new NotFoundException(
          'Loading data could not be saved for the selected compartment',
        );
      }

      return {
        tripId:
          updateResult.rows[0].trip_ref ||
          updateResult.rows[0].trip_id,
        loadingStatus: 'RECORDED',
        compartmentNumber,
        palletCount,
        cartonCount,
        doorOpenDurationSeconds: calculatedDurationSeconds,
        boltSealNumber,
        loadingPhotoCount: loadingPhotoUrls.length,
        nextStep: 'SHIPPER_SIGNOFF',
      };
    } catch (error) {
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }

  // API 19.1 - Submit Shipper Sign-Off & Handover
  async submitShipperSignoff(
    userId: string,
    tripId: string,
    body: {
      shipperContactName: string;
      shipperOtp?: string;
      lorryReceiptNumber: string;
      driverConfirmationCheck: string;
      pickupCompletedTimestamp: string;
    },
    files: {
      shipperSignaturePhoto?: any[];
    },
  ) {
    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and Trip ID are required',
      );
    }

    const shipperContactName =
      body?.shipperContactName?.trim();

    const shipperOtp = body?.shipperOtp?.trim();

    const lorryReceiptNumber =
      body?.lorryReceiptNumber?.trim();

    const confirmationValue = String(
      body?.driverConfirmationCheck,
    ).trim().toLowerCase();

    const pickupTimestamp =
      body?.pickupCompletedTimestamp?.trim();

    const signaturePhoto =
      files?.shipperSignaturePhoto?.[0];

    if (!shipperContactName || shipperContactName.length < 2) {
      throw new BadRequestException(
        'Valid shipper contact name is required',
      );
    }

    if (!lorryReceiptNumber) {
      throw new BadRequestException(
        'Lorry receipt number is required',
      );
    }

    if (confirmationValue !== 'true') {
      throw new BadRequestException(
        'Driver must confirm the loading temperature, cargo counts and seal details',
      );
    }

    if (!pickupTimestamp) {
      throw new BadRequestException(
        'Pickup completed timestamp is required',
      );
    }

    const pickupDate = new Date(pickupTimestamp);

    if (Number.isNaN(pickupDate.getTime())) {
      throw new BadRequestException(
        'Pickup completed timestamp must be a valid ISO date-time',
      );
    }

    const otpProvided = Boolean(shipperOtp);
    const signatureProvided = Boolean(signaturePhoto);

    // The API accepts either OTP or signature fallback, not neither.
    if (otpProvided === signatureProvided) {
      throw new BadRequestException(
        'Provide either a shipper OTP or a shipper signature photo',
      );
    }

    if (shipperOtp && !/^\d{6}$/.test(shipperOtp)) {
      throw new BadRequestException(
        'Shipper OTP must contain exactly 6 digits',
      );
    }

    // Find the trip and verify driver ownership.
    const tripResult = await this.db.query(
      `SELECT
         t.id,
         t.trip_ref,
         t.trip_id,
         t.loading_status,
         t.shipper_otp_verified
       FROM trips t
       WHERE (t.trip_ref = $1 OR t.trip_id = $1)
         AND (
           t.driver_user_id = $2
           OR EXISTS (
             SELECT 1
             FROM drivers d
             WHERE d.id = t.fleet_assigned_driver_id
               AND d.user_id = $2
           )
           OR EXISTS (
             SELECT 1
             FROM bookings b
             JOIN drivers d ON d.id = b.assigned_driver_id
             WHERE b.id = t.booking_id
               AND d.user_id = $2
           )
         )
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [tripId.trim(), userId],
    );

    if (tripResult.rows.length === 0) {
      throw new NotFoundException(
        'Trip not found or you are not authorized to update this trip',
      );
    }

    const trip = tripResult.rows[0];

    if (
      String(trip.loading_status || '').toUpperCase() !==
      'RECORDED'
    ) {
      throw new ConflictException(
        'Loading proof must be recorded before shipper sign-off',
      );
    }

    let otpVerified = false;

    if (shipperOtp) {
      // Do not trust a six-digit value without prior verification.
      if (trip.shipper_otp_verified !== true) {
        throw new BadRequestException(
          'Shipper OTP has not been verified. Complete the OTP verification flow first or use the signature photo fallback.',
        );
      }

      otpVerified = true;
    }

    const isValidImage = (file: any) => {
      const buffer: Buffer = file?.buffer;

      if (!buffer || buffer.length === 0) {
        return false;
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          buffer.length >= 3 &&
          buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ]),
        );
      }

      if (file.mimetype === 'image/webp') {
        return (
          buffer.toString('ascii', 0, 4) === 'RIFF' &&
          buffer.toString('ascii', 8, 12) === 'WEBP'
        );
      }

      return false;
    };

    if (signatureProvided && !isValidImage(signaturePhoto)) {
      throw new BadRequestException(
        'Shipper signature must be a valid JPG, PNG or WEBP image',
      );
    }

    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-shipper-signoff',
    );

    const savedFilePaths: string[] = [];

    try {
      let signaturePhotoUrl: string | null = null;

      if (signatureProvided) {
        await mkdir(storageDirectory, { recursive: true });

        const extension =
          signaturePhoto.mimetype === 'image/jpeg'
            ? '.jpg'
            : signaturePhoto.mimetype === 'image/png'
              ? '.png'
              : '.webp';

        const filename = `${randomUUID()}${extension}`;
        const filePath = join(storageDirectory, filename);

        await writeFile(filePath, signaturePhoto.buffer, {
          flag: 'wx',
        });

        savedFilePaths.push(filePath);

        signaturePhotoUrl =
          `private://trip-shipper-signoff/${filename}`;
      }

      const updateResult = await this.db.query(
        `UPDATE trips t
         SET
           shipper_contact_name = $1,
           shipper_otp_verified = $2,
           shipper_signature_photo_url = $3,
           lr_number = $4,
           pickup_completed_timestamp = $5,
           pickup_status = 'COMPLETED',
           status = 'IN_TRANSIT',
           updated_at = NOW()
         WHERE t.id = $6
           AND UPPER(COALESCE(t.loading_status, '')) = 'RECORDED'
           AND (
             t.driver_user_id = $7
             OR EXISTS (
               SELECT 1
               FROM drivers d
               WHERE d.id = t.fleet_assigned_driver_id
                 AND d.user_id = $7
             )
             OR EXISTS (
               SELECT 1
               FROM bookings b
               JOIN drivers d ON d.id = b.assigned_driver_id
               WHERE b.id = t.booking_id
                 AND d.user_id = $7
             )
           )
         RETURNING
           t.trip_ref,
           t.trip_id,
           t.lr_number,
           t.pickup_completed_timestamp,
           t.pickup_status,
           t.status`,
        [
          shipperContactName,
          otpVerified,
          signaturePhotoUrl,
          lorryReceiptNumber,
          pickupDate.toISOString(),
          trip.id,
          userId,
        ],
      );

      if (updateResult.rows.length === 0) {
        throw new ConflictException(
          'Sign-off could not be saved. Check the trip assignment and loading status.',
        );
      }

      const saved = updateResult.rows[0];

      return {
        tripId: saved.trip_ref || saved.trip_id,
        pickupStatus: saved.pickup_status,
        lorryReceiptNumber: saved.lr_number,
        pickupCompletedAt: saved.pickup_completed_timestamp,
        tripStatus: saved.status,
        nextStep: 'HIGHWAY_TRANSIT',
      };
    } catch (error) {
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }



  async getMyTripsForDebug(userId: string) {
    const result = await this.db.query(
      `SELECT
       t.id,
       t.trip_ref,
       t.trip_id,
       t.booking_id,
       t.status,
       t.fleet_assignment_status
     FROM trips t
     WHERE t.driver_user_id = $1
        OR EXISTS (
          SELECT 1
          FROM drivers d
          WHERE d.id = t.fleet_assigned_driver_id
            AND d.user_id = $1
        )
        OR EXISTS (
          SELECT 1
          FROM bookings b
          JOIN drivers d ON d.id = b.assigned_driver_id
          WHERE b.id = t.booking_id
            AND d.user_id = $1
        )
     ORDER BY t.accepted_at DESC NULLS LAST
     LIMIT 20`,
      [userId],
    );

    return {
      totalTrips: result.rows.length,
      trips: result.rows,
    };
  }
  // API 20.1 - Get Active Trip Status & Live Telematics
  async getActiveTripLiveStatus(userId: string, tripId: string) {
    // 1. Find the trip and verify driver ownership.
    const tripResult = await this.db.query(
      `
    SELECT
      t.id::text AS id,
      t.trip_ref,
      t.trip_id,
      t.status AS trip_status,
      t.pickup_status,
      t.loading_status,
      t.pickup_completed_timestamp,
      t.delivery_arrival_timestamp,
      t.handover_timestamp,

      b.scheduled_delivery_eta,
      b.eway_bill_number,
      b.eway_bill_status,
      b.eway_bill_valid_until,

      cp.checkpoint_id,
      cp.trip_progress_percent,

      CASE
        WHEN cp.logged_at IS NOT NULL
          AND (
            u.last_ping_at IS NULL
            OR cp.logged_at >= u.last_ping_at
          )
        THEN cp.checkpoint_name
        ELSE u.last_location_name
      END AS current_location_name,

      CASE
        WHEN cp.logged_at IS NOT NULL
          AND (
            u.last_ping_at IS NULL
            OR cp.logged_at >= u.last_ping_at
          )
        THEN cp.checkpoint_latitude
        ELSE u.last_known_latitude
      END AS current_latitude,

      CASE
        WHEN cp.logged_at IS NOT NULL
          AND (
            u.last_ping_at IS NULL
            OR cp.logged_at >= u.last_ping_at
          )
        THEN cp.checkpoint_longitude
        ELSE u.last_known_longitude
      END AS current_longitude,

      CASE
        WHEN cp.logged_at IS NOT NULL
          AND (
            u.last_ping_at IS NULL
            OR cp.logged_at >= u.last_ping_at
          )
        THEN cp.logged_at
        ELSE u.last_ping_at
      END AS current_location_updated_at

    FROM trips t

    LEFT JOIN bookings b
      ON b.id = t.booking_id

    LEFT JOIN users u
      ON u.id = $2::uuid

    LEFT JOIN LATERAL (
      SELECT
        c.id::text AS checkpoint_id,
        c.checkpoint_name,
        c.checkpoint_latitude,
        c.checkpoint_longitude,
        c.trip_progress_percent,
        c.logged_at

      FROM trip_checkpoints c

      WHERE c.trip_id = t.id

      ORDER BY
        c.logged_at DESC NULLS LAST,
        c.id DESC

      LIMIT 1
    ) cp ON TRUE

    WHERE
      (
        t.trip_ref = $1
        OR t.trip_id = $1
        OR t.id::text = $1
      )

      AND (
        t.driver_user_id = $2::uuid

        OR EXISTS (
          SELECT 1
          FROM drivers d
          WHERE d.id = t.fleet_assigned_driver_id
            AND d.user_id = $2::uuid
        )

        OR EXISTS (
          SELECT 1
          FROM bookings assigned_booking
          JOIN drivers d
            ON d.id = assigned_booking.assigned_driver_id

          WHERE assigned_booking.id = t.booking_id
            AND d.user_id = $2::uuid
        )
      )

    LIMIT 1
    `,
      [tripId, userId],
    );

    if (tripResult.rows.length === 0) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    // Helper: safely convert database values into numbers.
    const toNumberOrNull = (value: any): number | null => {
      if (
        value === null ||
        value === undefined ||
        value === ''
      ) {
        return null;
      }

      const numberValue = Number(value);

      return Number.isFinite(numberValue)
        ? numberValue
        : null;
    };

    // 2. Fetch configured compartments and their saved temperatures.
    const compartmentResult = await this.db.query(
      `
    SELECT
      compartment_number,
      compartment_index,

      COALESCE(
        zone_name,
        compartment_name,
        temperature_zone,
        zone
      ) AS zone_name,

      COALESCE(
        current_temperature_celsius,
        current_temperature_c,
        current_temp_c
      ) AS current_temp,

      COALESCE(
        target_temperature_celsius,
        target_temperature_c,
        target_temp_c,
        target_temperature,
        target_temp,
        setpoint_celsius,
        setpoint
      ) AS target_temp,

      COALESCE(
        min_temperature_celsius,
        min_temp_c,
        min_temp
      ) AS min_temp,

      COALESCE(
        max_temperature_celsius,
        max_temp_c,
        max_temp
      ) AS max_temp,

      sensor_imei,
      sensor_id,
      sensor_mac,
      probe_id,
      probe_serial,
      has_door_sensor

    FROM trip_compartments

    WHERE
      (
        trip_ref = $1
        OR trip_id = $2
        OR trip_id = $3
        OR trip_id = $4
      )

      AND is_active IS DISTINCT FROM FALSE

    ORDER BY
      compartment_number ASC NULLS LAST,
      compartment_index ASC NULLS LAST
    `,
      [
        trip.trip_ref,
        trip.id,
        trip.trip_id || '',
        tripId,
      ],
    );

    // 3. Format compartment information.
    const compartments = compartmentResult.rows.map(
      (item: any) => {
        const currentTemp = toNumberOrNull(
          item.current_temp,
        );

        const targetTemp = toNumberOrNull(
          item.target_temp,
        );

        const minTemp = toNumberOrNull(
          item.min_temp,
        );

        const maxTemp = toNumberOrNull(
          item.max_temp,
        );

        let tempStatus = 'UNKNOWN';

        if (
          currentTemp !== null &&
          minTemp !== null &&
          maxTemp !== null
        ) {
          tempStatus =
            currentTemp >= minTemp &&
              currentTemp <= maxTemp
              ? 'IN_RANGE'
              : 'OUT_OF_RANGE';
        }

        const sensorConfigured = Boolean(
          item.sensor_imei ||
          item.sensor_id ||
          item.sensor_mac ||
          item.probe_id ||
          item.probe_serial,
        );

        let doorStatus = 'UNKNOWN';

        if (item.has_door_sensor === false) {
          doorStatus = 'NOT_CONFIGURED';
        }

        return {
          compartmentNumber:
            item.compartment_number ??
            item.compartment_index ??
            null,

          zoneName: item.zone_name || null,

          currentTempCelsius: currentTemp,
          targetTempCelsius: targetTemp,

          tempStatus,

          iotSignalStatus: sensorConfigured
            ? 'UNKNOWN'
            : 'NOT_CONFIGURED',

          doorStatus,
        };
      },
    );

    // 4. Read saved trip progress from the latest checkpoint.
    const savedProgress = toNumberOrNull(
      trip.trip_progress_percent,
    );

    const progressPercent =
      savedProgress === null
        ? null
        : Math.max(
          0,
          Math.min(100, Math.round(savedProgress)),
        );

    // 5. Calculate e-way bill expiry countdown.
    const expiryDate = trip.eway_bill_valid_until
      ? new Date(trip.eway_bill_valid_until)
      : null;

    const validExpiryDate =
      expiryDate &&
        !Number.isNaN(expiryDate.getTime())
        ? expiryDate
        : null;

    const hoursRemaining =
      validExpiryDate !== null
        ? Math.max(
          0,
          Math.round(
            (
              (validExpiryDate.getTime() - Date.now()) /
              3600000
            ) * 10,
          ) / 10,
        )
        : null;

    const ewayStatus = trip.eway_bill_status || null;

    const extensionAlert =
      String(ewayStatus || '').toUpperCase() ===
      'EXPIRED' ||
      (
        hoursRemaining !== null &&
        hoursRemaining <= 6
      );

    // 6. Prepare the six trip milestones.
    const tripStatus = String(
      trip.trip_status || '',
    ).toUpperCase();

    const pickupStatus = String(
      trip.pickup_status || '',
    ).toUpperCase();

    const loadingStatus = String(
      trip.loading_status || '',
    ).toUpperCase();

    const pickupCompleted =
      Boolean(trip.pickup_completed_timestamp) ||
      pickupStatus === 'COMPLETED';

    const loadingCompleted =
      loadingStatus === 'RECORDED';

    const inTransit = [
      'IN_TRANSIT',
      'AT_CHECKPOINT',
      'DELIVERY_ARRIVED',
      'DELIVERED',
      'COMPLETED',
    ].includes(tripStatus);

    // Corrected: a saved checkpoint ID indicates a checkpoint record.
    const checkpointRecorded = Boolean(
      trip.checkpoint_id,
    );

    const destinationReached = Boolean(
      trip.delivery_arrival_timestamp,
    );

    const delivered =
      Boolean(trip.handover_timestamp) ||
      [
        'DELIVERED',
        'COMPLETED',
      ].includes(tripStatus);

    const milestones = [
      {
        step: 1,
        label: 'Reached Pickup',
        status: pickupCompleted
          ? 'COMPLETED'
          : 'PENDING',
      },
      {
        step: 2,
        label: 'Loading Completed',
        status: loadingCompleted
          ? 'COMPLETED'
          : 'PENDING',
      },
      {
        step: 3,
        label: 'In Transit',
        status: inTransit
          ? 'COMPLETED'
          : 'PENDING',
      },
      {
        step: 4,
        label: 'Checkpoint / Toll',
        status: checkpointRecorded
          ? 'COMPLETED'
          : inTransit
            ? 'IN_PROGRESS'
            : 'PENDING',
      },
      {
        step: 5,
        label: 'Reached Destination',
        status: destinationReached
          ? 'COMPLETED'
          : 'PENDING',
      },
      {
        step: 6,
        label: 'Delivered',
        status: delivered
          ? 'COMPLETED'
          : 'PENDING',
      },
    ];

    // 7. Return the Active Trip Control Center response.
    return {
      tripId: trip.trip_ref || trip.trip_id,
      tripStatus: trip.trip_status,

      progressPercent,

      currentLocationName:
        trip.current_location_name || null,

      currentLocation: {
        latitude: toNumberOrNull(
          trip.current_latitude,
        ),

        longitude: toNumberOrNull(
          trip.current_longitude,
        ),

        updatedAt:
          trip.current_location_updated_at || null,
      },

      estimatedArrivalTimestamp:
        trip.scheduled_delivery_eta || null,

      compartments,

      ewayBill: {
        ewbNumber: trip.eway_bill_number || null,
        status: ewayStatus,

        expiryTimestamp: validExpiryDate
          ? validExpiryDate.toISOString()
          : null,

        hoursRemaining,
        extensionAlert,
      },

      milestones,
    };
  }

  // API 20.2 - Log Trip Checkpoint / Milestone Update
  async logTripCheckpoint(
    userId: string,
    tripId: string,
    body: any,
    files: {
      tollReceiptPhoto?: any[];
      checkpointPhoto?: any[];
    },
  ) {
    if (!tripId || !userId) {
      throw new BadRequestException(
        'Trip ID and authentication are required',
      );
    }

    // 1. Validate milestone type.
    const allowedMilestoneTypes = [
      'TOLL_PLAZA',
      'STATE_BORDER_CHECKPOST',
      'REST_STOP',
      'ROUTE_DELAY',
      'REACHED_DESTINATION',
    ];

    const milestoneType = String(
      body?.milestoneType || '',
    ).trim().toUpperCase();

    if (!allowedMilestoneTypes.includes(milestoneType)) {
      throw new BadRequestException('Invalid milestone type');
    }

    // 2. Validate checkpoint name.
    const checkpointName =
      typeof body?.checkpointName === 'string'
        ? body.checkpointName.trim()
        : '';

    if (!checkpointName) {
      throw new BadRequestException(
        'Checkpoint name is required',
      );
    }

    // 3. Validate GPS coordinates.
    const latitude = Number(body?.checkpointLatitude);
    const longitude = Number(body?.checkpointLongitude);

    if (
      body?.checkpointLatitude === undefined ||
      body?.checkpointLatitude === '' ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new BadRequestException(
        'Valid checkpoint latitude is required',
      );
    }

    if (
      body?.checkpointLongitude === undefined ||
      body?.checkpointLongitude === '' ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException(
        'Valid checkpoint longitude is required',
      );
    }

    // 4. Validate odometer.
    const odometer = Number(body?.odometerAtCheckpointKm);

    if (
      body?.odometerAtCheckpointKm === undefined ||
      body?.odometerAtCheckpointKm === '' ||
      !Number.isInteger(odometer) ||
      odometer < 0
    ) {
      throw new BadRequestException(
        'Valid integer odometer reading is required',
      );
    }

    // 5. Validate optional vehicle speed.
    let vehicleSpeed: number | null = null;

    if (
      body?.vehicleSpeedKmph !== undefined &&
      body?.vehicleSpeedKmph !== ''
    ) {
      vehicleSpeed = Number(body.vehicleSpeedKmph);

      if (
        !Number.isInteger(vehicleSpeed) ||
        vehicleSpeed < 0
      ) {
        throw new BadRequestException(
          'Vehicle speed must be a valid non-negative integer',
        );
      }
    }

    // 6. Read uploaded files.
    const tollReceiptPhoto = files?.tollReceiptPhoto?.[0];
    const checkpointPhoto = files?.checkpointPhoto?.[0];

    // 7. Validate toll amount and receipt.
    let tollAmountInr: number | null = null;
    let tollAmountMinor: number | null = null;

    if (milestoneType === 'TOLL_PLAZA') {
      if (
        body?.tollAmountPaidInr === undefined ||
        body?.tollAmountPaidInr === ''
      ) {
        throw new BadRequestException(
          'Toll amount is required for a toll plaza',
        );
      }

      tollAmountInr = Number(body.tollAmountPaidInr);

      if (
        !Number.isFinite(tollAmountInr) ||
        tollAmountInr <= 0
      ) {
        throw new BadRequestException(
          'Enter a valid toll amount greater than zero',
        );
      }

      tollAmountMinor = Math.round(tollAmountInr * 100);

      if (!tollReceiptPhoto) {
        throw new BadRequestException(
          'Toll receipt photo is mandatory for a toll plaza',
        );
      }
    }

    // 8. Validate actual uploaded image content.
    const uploadedPhotos = [
      tollReceiptPhoto,
      checkpointPhoto,
    ].filter(Boolean);

    const isValidImage = (file: any) => {
      const buffer: Buffer = file?.buffer;

      if (!buffer || buffer.length === 0) {
        return false;
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          buffer.length >= 3 &&
          buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ]),
        );
      }

      if (file.mimetype === 'image/webp') {
        return (
          buffer.toString('ascii', 0, 4) === 'RIFF' &&
          buffer.toString('ascii', 8, 12) === 'WEBP'
        );
      }

      return false;
    };

    if (!uploadedPhotos.every(isValidImage)) {
      throw new BadRequestException(
        'One or more uploaded images have invalid file content',
      );
    }

    // 9. Find trip and verify driver ownership.
    const tripResult = await this.db.query(
      `
      SELECT
        t.id,
        t.trip_ref,
        t.trip_id,
        t.status,
        t.total_trip_distance_km,
        t.pickup_odometer_km,
        t.pretrip_odometer_km

      FROM trips t

      WHERE
        (
          t.trip_ref = $1
          OR t.trip_id = $1
          OR t.id::text = $1
        )

        AND (
          t.driver_user_id = $2::uuid

          OR EXISTS (
            SELECT 1
            FROM drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $2::uuid
          )

          OR EXISTS (
            SELECT 1
            FROM bookings b
            JOIN drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $2::uuid
          )
        )

      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [tripId, userId],
    );

    if (tripResult.rows.length === 0) {
      throw new NotFoundException(
        'Trip not found or you are not authorized to update this trip',
      );
    }

    const trip = tripResult.rows[0];

    // 10. Calculate trip progress from saved trip distance.
    let tripProgressPercent: number | null = null;

    const totalDistance = Number(
      trip.total_trip_distance_km,
    );

    const startingOdometerValue =
      trip.pickup_odometer_km ??
      trip.pretrip_odometer_km;

    const startingOdometer =
      startingOdometerValue === null ||
        startingOdometerValue === undefined
        ? null
        : Number(startingOdometerValue);

    if (milestoneType === 'REACHED_DESTINATION') {
      tripProgressPercent = 100;
    } else if (
      Number.isFinite(totalDistance) &&
      totalDistance > 0 &&
      startingOdometer !== null &&
      Number.isFinite(startingOdometer)
    ) {
      tripProgressPercent = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((odometer - startingOdometer) /
              totalDistance) * 100,
          ),
        ),
      );
    }

    // 11. Save images privately.
    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-checkpoints',
    );

    const savedFilePaths: string[] = [];

    const saveImage = async (file: any) => {
      const extension =
        file.mimetype === 'image/jpeg'
          ? '.jpg'
          : file.mimetype === 'image/png'
            ? '.png'
            : '.webp';

      const filename = `${randomUUID()}${extension}`;

      const filePath = join(
        storageDirectory,
        filename,
      );

      await writeFile(filePath, file.buffer, {
        flag: 'wx',
      });

      savedFilePaths.push(filePath);

      return `private://trip-checkpoints/${filename}`;
    };

    try {
      await mkdir(storageDirectory, {
        recursive: true,
      });

      const tollReceiptPhotoUrl = tollReceiptPhoto
        ? await saveImage(tollReceiptPhoto)
        : null;

      const checkpointPhotoUrl = checkpointPhoto
        ? await saveImage(checkpointPhoto)
        : null;

      const checkpointId = randomUUID();
      const checkpointRef = `chk_${checkpointId}`;

      const expenseId = randomUUID();
      const expenseRef = `EXP-${randomUUID()}`;

      const notes =
        typeof body?.notes === 'string'
          ? body.notes.trim()
          : null;

      // 12. Insert checkpoint and, for tolls, a pre-filled expense.
      const insertResult = await this.db.query(
        `
        WITH inserted_checkpoint AS (
          INSERT INTO trip_checkpoints (
            id,
            trip_id,
            checkpoint_ref,
            milestone_type,
            checkpoint_name,
            checkpoint_latitude,
            checkpoint_longitude,
            odometer_at_checkpoint_km,
            vehicle_speed_kmph,
            toll_amount_paid_minor,
            toll_receipt_photo_url,
            checkpoint_photo_url,
            notes,
            cumulative_toll_minor,
            trip_progress_percent,
            logged_at
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10::BIGINT,
            $11,
            $12,
            $13,

            COALESCE(
              (
                SELECT SUM(previous.toll_amount_paid_minor)
                FROM trip_checkpoints previous
                WHERE previous.trip_id = $2
              ),
              0::BIGINT
            ) + COALESCE($10::BIGINT, 0::BIGINT),

            $14,
            NOW()
          )

          RETURNING
            id,
            checkpoint_ref,
            milestone_type,
            toll_amount_paid_minor,
            cumulative_toll_minor,
            trip_progress_percent
        ),

        updated_trip AS (
          UPDATE trips t

          SET
            delivery_arrival_latitude = $6,
            delivery_arrival_longitude = $7,
            delivery_arrival_timestamp = NOW(),
            updated_at = NOW()

          FROM inserted_checkpoint ic

          WHERE
            t.id = $2
            AND $4 = 'REACHED_DESTINATION'

          RETURNING t.id
        ),

        inserted_expense AS (
          INSERT INTO trip_expenses (
            id,
            trip_id,
            driver_user_id,
            expense_ref,
            expense_type,
            amount_minor,
            receipt_photo_url,
            location_latitude,
            location_longitude,
            location_name,
            is_pre_filled,
            checkpoint_log_ref,
            notes
          )

          SELECT
            $15,
            $2,
            $16::uuid,
            $17,
            'TOLL',
            $10::BIGINT,
            $11,
            $6,
            $7,
            $5,
            TRUE,
            ic.checkpoint_ref,
            $13

          FROM inserted_checkpoint ic

          WHERE $4 = 'TOLL_PLAZA'

          RETURNING id
        )

        SELECT
          ic.id,
          ic.checkpoint_ref,
          ic.milestone_type,
          ic.toll_amount_paid_minor,
          ic.cumulative_toll_minor,
          ic.trip_progress_percent,

          (
            SELECT COUNT(*)::INTEGER
            FROM inserted_expense
          ) AS expense_prefilled_count,

          (
            SELECT COUNT(*)::INTEGER
            FROM updated_trip
          ) AS destination_update_count

        FROM inserted_checkpoint ic
        `,
        [
          checkpointId,
          trip.id,
          checkpointRef,
          milestoneType,
          checkpointName,
          latitude,
          longitude,
          odometer,
          vehicleSpeed,
          tollAmountMinor,
          tollReceiptPhotoUrl,
          checkpointPhotoUrl,
          notes,
          tripProgressPercent,
          expenseId,
          userId,
          expenseRef,
        ],
      );

      if (insertResult.rows.length === 0) {
        throw new BadRequestException(
          'Checkpoint could not be saved',
        );
      }

      const saved = insertResult.rows[0];

      const cumulativeTollMinor = Number(
        saved.cumulative_toll_minor || 0,
      );

      return {
        tripId: trip.trip_ref || trip.trip_id || trip.id,

        checkpointId: saved.checkpoint_ref,

        milestoneType: saved.milestone_type,

        tollAmountPaidInr:
          saved.toll_amount_paid_minor === null
            ? null
            : Number(saved.toll_amount_paid_minor) / 100,

        cumulativeTollPaidInr:
          cumulativeTollMinor / 100,

        tripProgressPercent:
          saved.trip_progress_percent === null
            ? null
            : Number(saved.trip_progress_percent),

        tollExpensePrefilled:
          Number(saved.expense_prefilled_count) > 0,

        checkpointPhotoSaved:
          Boolean(checkpointPhotoUrl),

        tollReceiptPhotoSaved:
          Boolean(tollReceiptPhotoUrl),
      };
    } catch (error) {
      // Remove uploaded files if the database operation fails.
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }

  // API 21.1 - Submit Manual Temperature Log
  async submitManualTemperatureLog(
    userId: string,
    tripId: string,
    body: any,
    files: { thermometerPhoto?: any[] },
  ) {
    // 1. Validate input.
    const compartmentNumber = Number(body?.compartmentNumber);
    const manualTempCelsius = Number(body?.manualTempCelsius);
    const readingTimestamp = new Date(body?.readingTimestamp);

    const isIotOffline =
      String(body?.isIotOffline).toLowerCase() === 'true';

    const isTempOutOfRange =
      String(body?.isTempOutOfRange).toLowerCase() === 'true';

    const allowedReasons = [
      'NO_MOBILE_SIGNAL',
      'DEVICE_BATTERY_DEAD',
      'SENSOR_ERROR',
      'DEVICE_DISCONNECTED',
      'OTHER',
    ];

    if (![1, 2].includes(compartmentNumber)) {
      throw new BadRequestException(
        'Compartment number must be 1 or 2',
      );
    }

    if (!Number.isFinite(manualTempCelsius)) {
      throw new BadRequestException(
        'A valid manual temperature reading is required',
      );
    }

    if (
      !body?.readingTimestamp ||
      Number.isNaN(readingTimestamp.getTime())
    ) {
      throw new BadRequestException(
        'A valid ISO reading timestamp is required',
      );
    }

    if (!isIotOffline) {
      throw new BadRequestException(
        'Manual temperature fallback is allowed only when IoT is offline',
      );
    }

    const reasonCode = String(
      body?.iotOfflineReasonCode || '',
    ).trim().toUpperCase();

    if (!allowedReasons.includes(reasonCode)) {
      throw new BadRequestException(
        'Invalid IoT offline reason code',
      );
    }

    const thermometerPhoto = files?.thermometerPhoto?.[0];

    if (!thermometerPhoto) {
      throw new BadRequestException(
        'Thermometer photo is required',
      );
    }

    if (
      !thermometerPhoto.buffer ||
      !Buffer.isBuffer(thermometerPhoto.buffer)
    ) {
      throw new BadRequestException(
        'Invalid thermometer photo',
      );
    }

    // 2. Validate image content.
    const buffer = thermometerPhoto.buffer;

    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const isPng =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47,
          0x0d, 0x0a, 0x1a, 0x0a,
        ]),
      );

    const isWebp =
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';

    if (!isJpeg && !isPng && !isWebp) {
      throw new BadRequestException(
        'Uploaded file is not a valid JPG, PNG or WEBP image',
      );
    }

    // 3. Validate GPS when the driver reports an out-of-range reading.
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (isTempOutOfRange) {
      latitude = Number(body?.currentLatitude);
      longitude = Number(body?.currentLongitude);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new BadRequestException(
          'Valid driver GPS coordinates are required for an out-of-range reading',
        );
      }
    }

    // 4. Find trip and verify driver ownership.
    const tripResult = await this.db.query(
      `
      SELECT
        t.id,
        t.trip_ref,
        t.trip_id,
        t.status
      FROM trips t
      WHERE
        (
          t.trip_ref = $1
          OR t.trip_id = $1
          OR t.id::text = $1
        )
        AND (
          t.driver_user_id = $2::uuid
          OR EXISTS (
            SELECT 1
            FROM drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $2::uuid
          )
          OR EXISTS (
            SELECT 1
            FROM bookings b
            JOIN drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $2::uuid
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    // 5. Find the requested compartment.
    const compartmentResult = await this.db.query(
      `
      SELECT *
      FROM trip_compartments
      WHERE
        (
          trip_ref = $1
          OR trip_id = $2
        )
        AND compartment_number = $3
        AND is_active IS DISTINCT FROM FALSE
      LIMIT 1
      `,
      [
        trip.trip_ref,
        trip.id,
        compartmentNumber,
      ],
    );

    if (!compartmentResult.rows.length) {
      throw new NotFoundException(
        'The requested active compartment was not found for this trip',
      );
    }

    const compartment = compartmentResult.rows[0];

    // 6. Read configured temperature limits.
    const minTempValue =
      compartment.min_temperature_celsius ??
      compartment.min_temp_c ??
      compartment.min_temp ??
      null;

    const maxTempValue =
      compartment.max_temperature_celsius ??
      compartment.max_temp_c ??
      compartment.max_temp ??
      null;

    const minTemp =
      minTempValue === null ? null : Number(minTempValue);

    const maxTemp =
      maxTempValue === null ? null : Number(maxTempValue);

    let tempStatus = 'UNKNOWN';

    if (
      minTemp !== null &&
      maxTemp !== null &&
      Number.isFinite(minTemp) &&
      Number.isFinite(maxTemp)
    ) {
      tempStatus =
        manualTempCelsius >= minTemp &&
          manualTempCelsius <= maxTemp
          ? 'IN_RANGE'
          : 'OUT_OF_RANGE';

      if (
        isTempOutOfRange !==
        (tempStatus === 'OUT_OF_RANGE')
      ) {
        throw new BadRequestException(
          'isTempOutOfRange does not match the configured compartment temperature limits',
        );
      }
    } else if (isTempOutOfRange) {
      tempStatus = 'DRIVER_REPORTED_OUT_OF_RANGE';
    }

    // 7. Save thermometer photo privately.
    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-manual-temperature',
    );

    const extension = isJpeg
      ? '.jpg'
      : isPng
        ? '.png'
        : '.webp';

    const filename = `${randomUUID()}${extension}`;
    const filePath = join(storageDirectory, filename);

    const photoPath =
      `private://trip-manual-temperature/${filename}`;

    let fileSaved = false;

    try {
      await mkdir(storageDirectory, {
        recursive: true,
      });

      await writeFile(filePath, buffer, {
        flag: 'wx',
      });

      fileSaved = true;

      // 8. Update the existing compartment temperature.
      // Only use a column that actually exists in the returned row.
      const currentTempColumns = [
        'current_temperature_celsius',
        'current_temperature_c',
        'current_temp_c',
      ];

      const currentTempColumn =
        currentTempColumns.find((column) =>
          Object.prototype.hasOwnProperty.call(
            compartment,
            column,
          ),
        );

      if (!currentTempColumn) {
        throw new BadRequestException(
          'No supported current-temperature column exists in trip_compartments',
        );
      }

      await this.db.query(
        `
        UPDATE trip_compartments
        SET ${currentTempColumn} = $1
        WHERE id = $2
        `,
        [
          manualTempCelsius,
          compartment.id,
        ],
      );

      // 9. Return saved latest reading details.
      return {
        tripId: trip.trip_ref || trip.trip_id || trip.id,
        compartmentNumber,
        manualTempCelsius,
        readingTimestamp: readingTimestamp.toISOString(),
        readingSource: 'DRIVER_ENTERED',
        iotOffline: true,
        iotOfflineReasonCode: reasonCode,
        tempStatus,
        thermometerPhotoUrl: photoPath,
        photoSavedLocally: true,
        temperatureHistorySaved: false,
        opsAlertTriggered: false,
        opsAlertStatus: isTempOutOfRange
          ? 'PENDING_INTEGRATION'
          : 'NOT_REQUIRED',
        driverLocation:
          isTempOutOfRange
            ? { latitude, longitude }
            : null,
      };
    } catch (error) {
      if (fileSaved) {
        await unlink(filePath).catch(() => undefined);
      }

      throw error;
    }
  }

  // API 22.1 - Trigger Emergency SOS Incident Alert
  async triggerEmergencySOS(
    userId: string,
    tripId: string,
    body: any,
    files: { evidenceMedia?: any[] },
  ) {
    // 1. Validate emergency type.
    const allowedEmergencyTypes = [
      'REEFER_FAILURE',
      'VEHICLE_BREAKDOWN',
      'ACCIDENT',
      'THEFT_HIJACK',
      'MEDICAL_EMERGENCY',
    ];

    const emergencyType = String(
      body?.emergencyType || '',
    ).trim().toUpperCase();

    if (!allowedEmergencyTypes.includes(emergencyType)) {
      throw new BadRequestException(
        'Invalid emergency type',
      );
    }

    // 2. Validate silent alert.
    const isSilentAlert =
      String(body?.isSilentAlert).toLowerCase() === 'true';

    if (
      emergencyType === 'THEFT_HIJACK' &&
      !isSilentAlert
    ) {
      throw new BadRequestException(
        'THEFT_HIJACK must use silent alert mode',
      );
    }

    if (
      emergencyType !== 'THEFT_HIJACK' &&
      isSilentAlert
    ) {
      throw new BadRequestException(
        'Silent alert mode is only allowed for THEFT_HIJACK',
      );
    }

    // 3. Validate GPS coordinates.
    const latitude = Number(body?.currentLatitude);
    const longitude = Number(body?.currentLongitude);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException(
        'Valid current GPS coordinates are required',
      );
    }

    const incidentDescription =
      typeof body?.incidentDescription === 'string'
        ? body.incidentDescription.trim()
        : null;

    // 4. Verify trip and driver ownership.
    const tripResult = await this.db.query(
      `
      SELECT
        t.id,
        t.trip_ref,
        t.trip_id,
        t.status
      FROM trips t
      WHERE
        (
          t.trip_ref = $1
          OR t.trip_id = $1
          OR t.id::text = $1
        )
        AND (
          t.driver_user_id = $2::uuid

          OR EXISTS (
            SELECT 1
            FROM drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $2::uuid
          )

          OR EXISTS (
            SELECT 1
            FROM bookings b
            JOIN drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $2::uuid
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    // 5. Validate optional evidence media.
    const evidenceMedia = files?.evidenceMedia?.[0];

    let evidenceMediaPath: string | null = null;
    let savedFilePath: string | null = null;

    if (evidenceMedia) {
      if (
        !evidenceMedia.buffer ||
        !Buffer.isBuffer(evidenceMedia.buffer)
      ) {
        throw new BadRequestException(
          'Invalid evidence media file',
        );
      }

      const allowedMediaTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
      ];

      if (!allowedMediaTypes.includes(evidenceMedia.mimetype)) {
        throw new BadRequestException(
          'Unsupported evidence media format',
        );
      }
    }

    // 6. Save optional evidence privately.
    try {
      if (evidenceMedia) {
        const extensionByType: Record<string, string> = {
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/webp': '.webp',
          'video/mp4': '.mp4',
          'video/quicktime': '.mov',
        };

        const extension =
          extensionByType[evidenceMedia.mimetype];

        const filename = `${randomUUID()}${extension}`;

        const storageDirectory = resolve(
          process.cwd(),
          'private_uploads',
          'trip-emergency-sos',
        );

        savedFilePath = join(
          storageDirectory,
          filename,
        );

        await mkdir(storageDirectory, {
          recursive: true,
        });

        await writeFile(
          savedFilePath,
          evidenceMedia.buffer,
          { flag: 'wx' },
        );

        evidenceMediaPath =
          `private://trip-emergency-sos/${filename}`;
      }

      // 7. Return validated incident details.
      // Actual incident persistence and Ops notification
      // require the project's incident/alert integration.
      return {
        tripId: trip.trip_ref || trip.trip_id || trip.id,
        emergencyType,
        isSilentAlert,
        currentLatitude: latitude,
        currentLongitude: longitude,
        incidentDescription,
        evidenceMediaUrl: evidenceMediaPath,
        evidenceMediaSaved: Boolean(evidenceMediaPath),
        incidentRecorded: false,
        opsNotified: false,
        opsNotificationStatus: 'PENDING_INTEGRATION',
      };
    } catch (error) {
      if (savedFilePath) {
        await unlink(savedFilePath).catch(() => undefined);
      }

      throw error;
    }
  }
  // API 23.1 - Record Delivery Arrival & Door Exposure
  async recordDeliveryArrival(
    userId: string,
    tripId: string,
    body: any,
  ) {
    if (!userId || !tripId) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    // 1. Validate GPS coordinates.
    const latitude = Number(body?.arrivalLatitude);
    const longitude = Number(body?.arrivalLongitude);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException(
        'Valid arrival latitude and longitude are required',
      );
    }

    // 2. Validate timestamps.
    const arrivalTimestamp = new Date(
      body?.arrivalTimestamp,
    );

    const doorOpenTimestamp = new Date(
      body?.doorOpenTimestamp,
    );

    const doorCloseTimestamp = new Date(
      body?.doorCloseTimestamp,
    );

    if (
      !body?.arrivalTimestamp ||
      !Number.isFinite(arrivalTimestamp.getTime()) ||
      !body?.doorOpenTimestamp ||
      !Number.isFinite(doorOpenTimestamp.getTime()) ||
      !body?.doorCloseTimestamp ||
      !Number.isFinite(doorCloseTimestamp.getTime())
    ) {
      throw new BadRequestException(
        'Valid arrival, door-open and door-close timestamps are required',
      );
    }

    if (
      doorOpenTimestamp < arrivalTimestamp ||
      doorCloseTimestamp < doorOpenTimestamp
    ) {
      throw new BadRequestException(
        'Door timestamps must follow the delivery arrival timestamp',
      );
    }

    // 3. Validate odometer, compartment and temperature.
    const odometer = Number(body?.odometerAtDeliveryKm);
    const compartmentNumber = Number(
      body?.compartmentNumber,
    );
    const finalTemperature = Number(
      body?.finalChamberTempAtArrivalCelsius,
    );
    const doorDuration = Number(
      body?.doorOpenDurationSeconds,
    );

    if (
      !Number.isInteger(odometer) ||
      odometer <= 0
    ) {
      throw new BadRequestException(
        'Delivery odometer must be a positive whole number',
      );
    }

    if (![1, 2].includes(compartmentNumber)) {
      throw new BadRequestException(
        'Compartment number must be 1 or 2',
      );
    }

    if (!Number.isFinite(finalTemperature)) {
      throw new BadRequestException(
        'A valid final chamber temperature is required',
      );
    }

    if (
      !Number.isInteger(doorDuration) ||
      doorDuration < 0
    ) {
      throw new BadRequestException(
        'Door open duration must be a non-negative whole number',
      );
    }

    // Check submitted duration against timestamps.
    const calculatedDuration = Math.round(
      (doorCloseTimestamp.getTime() -
        doorOpenTimestamp.getTime()) / 1000,
    );

    if (doorDuration !== calculatedDuration) {
      throw new BadRequestException(
        'Door open duration does not match the submitted timestamps',
      );
    }

    // 4. Validate door exposure reason.
    const allowedReasons = [
      'NOT_EXCEEDED',
      'LARGE_UNLOAD',
      'RECEIVER_DELAY',
      'DOCK_CONGESTION',
      'OTHER',
    ];

    const doorExceededReason = String(
      body?.doorExceededReason || '',
    ).trim().toUpperCase();

    if (!allowedReasons.includes(doorExceededReason)) {
      throw new BadRequestException(
        'Invalid door exceeded reason',
      );
    }

    // 5. Verify trip ownership.
    const tripResult = await this.db.query(
      `
      SELECT
        t.id,
        t.trip_ref,
        t.trip_id,
        t.status,
        t.delivery_arrival_timestamp
      FROM trips t
      WHERE
        (
          t.trip_ref = $1
          OR t.trip_id = $1
          OR t.id::text = $1
        )
        AND (
          t.driver_user_id = $2::uuid
          OR EXISTS (
            SELECT 1
            FROM drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $2::uuid
          )
          OR EXISTS (
            SELECT 1
            FROM bookings b
            JOIN drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $2::uuid
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    if (trip.delivery_arrival_timestamp) {
      throw new BadRequestException(
        'Delivery arrival has already been recorded for this trip',
      );
    }

    // 6. Save the confirmed arrival information.
    // These three columns are already used by API 20.2.
    await this.db.query(
      `
      UPDATE trips
      SET
        delivery_arrival_latitude = $1,
        delivery_arrival_longitude = $2,
        delivery_arrival_timestamp = $3,
        updated_at = NOW()
      WHERE id = $4
      `,
      [
        latitude,
        longitude,
        arrivalTimestamp,
        trip.id,
      ],
    );

    // 7. Return the validated delivery information.
    // Door exposure fields are returned but need confirmed
    // database columns before we can claim they are persisted.
    return {
      tripId:
        trip.trip_ref || trip.trip_id || trip.id,
      deliveryLocationName: null,
      arrivalLatitude: latitude,
      arrivalLongitude: longitude,
      arrivalTimestamp: arrivalTimestamp.toISOString(),
      odometerAtDeliveryKm: odometer,
      compartmentNumber,
      finalChamberTempAtArrivalCelsius:
        finalTemperature,
      doorOpenTimestamp:
        doorOpenTimestamp.toISOString(),
      doorCloseTimestamp:
        doorCloseTimestamp.toISOString(),
      doorOpenDurationSeconds: doorDuration,
      doorExceededReason,
      arrivalLocationSaved: true,
      doorExposureDetailsSaved: false,
      detentionClaimEligible:
        doorExceededReason !== 'NOT_EXCEEDED',
      nextStep: 'HANDOVER_EVIDENCE',
    };
  }

  // API 24.1 - Submit Delivery Handover Evidence
  async submitDeliveryHandoverEvidence(
    userId: string,
    tripId: string,
    body: any,
    files: {
      boltSealCutPhoto?: any[];
      cargoConditionPhotos?: any[];
    },
  ) {
    // 1. Validate authentication and trip ID.
    if (!userId || !tripId) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    // 2. Validate handover timestamp.
    const handoverTimestamp = new Date(
      body?.handoverTimestamp,
    );

    if (
      !body?.handoverTimestamp ||
      !Number.isFinite(handoverTimestamp.getTime())
    ) {
      throw new BadRequestException(
        'A valid handoverTimestamp in ISO 8601 format is required',
      );
    }

    // 3. Validate bolt seal status.
    const rawBoltSealIntact = body?.boltSealIntact;

    if (
      !['true', 'false', true, false].includes(
        rawBoltSealIntact,
      )
    ) {
      throw new BadRequestException(
        'boltSealIntact must be true or false',
      );
    }

    const boltSealIntact =
      String(rawBoltSealIntact).toLowerCase() === 'true';

    // 4. Parse compartment temperatures.
    let compartmentHandoverTemps: any[];

    try {
      const rawTemps = body?.compartmentHandoverTemps;

      compartmentHandoverTemps =
        typeof rawTemps === 'string'
          ? JSON.parse(rawTemps)
          : rawTemps;
    } catch {
      throw new BadRequestException(
        'compartmentHandoverTemps must contain valid JSON',
      );
    }

    if (
      !Array.isArray(compartmentHandoverTemps) ||
      compartmentHandoverTemps.length === 0
    ) {
      throw new BadRequestException(
        'Compartment handover temperatures are required',
      );
    }

    const submittedNumbers = new Set<number>();

    for (const item of compartmentHandoverTemps) {
      const compartmentNumber = Number(
        item?.compartmentNumber,
      );

      const handoverTempCelsius = Number(
        item?.handoverTempCelsius,
      );

      if (
        !Number.isInteger(compartmentNumber) ||
        compartmentNumber <= 0 ||
        !Number.isFinite(handoverTempCelsius)
      ) {
        throw new BadRequestException(
          'Each compartment requires a valid compartmentNumber and handoverTempCelsius',
        );
      }

      if (submittedNumbers.has(compartmentNumber)) {
        throw new BadRequestException(
          'Duplicate compartment numbers are not allowed',
        );
      }

      submittedNumbers.add(compartmentNumber);
    }

    // 5. Validate mandatory photos.
    const boltSealCutPhoto =
      files?.boltSealCutPhoto?.[0];

    const cargoConditionPhotos =
      files?.cargoConditionPhotos || [];

    if (!boltSealCutPhoto) {
      throw new BadRequestException(
        'Bolt seal cut photo is required',
      );
    }

    if (cargoConditionPhotos.length < 2) {
      throw new BadRequestException(
        'At least two cargo condition photos are required',
      );
    }

    // 6. Validate actual JPG / PNG file content.
    const isValidImage = (file: any): boolean => {
      if (
        !file?.buffer ||
        !Buffer.isBuffer(file.buffer) ||
        file.buffer.length === 0
      ) {
        return false;
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          file.buffer.length >= 3 &&
          file.buffer[0] === 0xff &&
          file.buffer[1] === 0xd8 &&
          file.buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return file.buffer
          .subarray(0, 8)
          .equals(
            Buffer.from([
              0x89, 0x50, 0x4e, 0x47,
              0x0d, 0x0a, 0x1a, 0x0a,
            ]),
          );
      }

      return false;
    };

    const allPhotos = [
      boltSealCutPhoto,
      ...cargoConditionPhotos,
    ];

    if (!allPhotos.every(isValidImage)) {
      throw new BadRequestException(
        'One or more uploaded photos are invalid. Only valid JPG and PNG images are accepted.',
      );
    }

    // 7. Verify trip ownership and retrieve existing seal number.
    const tripResult = await this.db.query(
      `
      SELECT
        t.id,
        t.trip_ref,
        t.trip_id,
        t.status,
        t.delivery_arrival_timestamp,
        t.bolt_seal_number
      FROM trips t
      WHERE
        (
          t.trip_ref = $1
          OR t.trip_id = $1
          OR t.id::text = $1
        )
        AND (
          t.driver_user_id = $2::uuid
          OR EXISTS (
            SELECT 1
            FROM drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $2::uuid
          )
          OR EXISTS (
            SELECT 1
            FROM bookings b
            JOIN drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $2::uuid
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    if (!trip.delivery_arrival_timestamp) {
      throw new BadRequestException(
        'Delivery arrival must be recorded before handover evidence',
      );
    }

    // 8. Verify active compartments declared for this trip.
    const compartmentResult = await this.db.query(
      `
      SELECT
        compartment_number,
        compartment_index
      FROM trip_compartments
      WHERE
        (
          trip_ref = $1
          OR trip_id = $2
          OR trip_id = $3
          OR trip_id = $4
        )
        AND is_active IS DISTINCT FROM FALSE
      ORDER BY
        compartment_number ASC NULLS LAST,
        compartment_index ASC NULLS LAST
      `,
      [
        trip.trip_ref,
        trip.id,
        trip.trip_id || '',
        tripId,
      ],
    );

    if (!compartmentResult.rows.length) {
      throw new BadRequestException(
        'No active compartments were found for this trip',
      );
    }

    const activeCompartmentNumbers = compartmentResult.rows
      .map((item: any) =>
        Number(
          item.compartment_number ??
          item.compartment_index,
        ),
      )
      .filter((number: number) => Number.isInteger(number));

    if (
      activeCompartmentNumbers.length !==
      submittedNumbers.size
    ) {
      throw new BadRequestException(
        'Temperature readings must contain exactly one entry for every active compartment',
      );
    }

    for (const number of activeCompartmentNumbers) {
      if (!submittedNumbers.has(number)) {
        throw new BadRequestException(
          `Handover temperature missing for compartment ${number}`,
        );
      }
    }

    // 9. Validate optional text fields.
    const receiverDockNumber =
      typeof body?.receiverDockNumber === 'string'
        ? body.receiverDockNumber.trim()
        : null;

    const handoverNotes =
      typeof body?.handoverNotes === 'string'
        ? body.handoverNotes.trim()
        : null;

    const receiverRepresentativeName =
      typeof body?.receiverRepresentativeName === 'string'
        ? body.receiverRepresentativeName.trim()
        : null;

    // 10. Save uploaded evidence privately.
    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-handover-evidence',
    );

    const savedFilePaths: string[] = [];

    try {
      await mkdir(storageDirectory, {
        recursive: true,
      });

      const savePrivateImage = async (file: any) => {
        const extension =
          file.mimetype === 'image/jpeg'
            ? '.jpg'
            : '.png';

        const filename = `${randomUUID()}${extension}`;

        const filePath = join(
          storageDirectory,
          filename,
        );

        await writeFile(filePath, file.buffer, {
          flag: 'wx',
        });

        savedFilePaths.push(filePath);

        return `private://trip-handover-evidence/${filename}`;
      };

      const boltSealCutPhotoUrl =
        await savePrivateImage(boltSealCutPhoto);

      const cargoConditionPhotoUrls: string[] = [];

      for (const photo of cargoConditionPhotos) {
        cargoConditionPhotoUrls.push(
          await savePrivateImage(photo),
        );
      }

      // 11. Return validated evidence.
      // Database evidence columns and Ops alert integration
      // must be connected before claiming those operations succeeded.
      return {
        tripId:
          trip.trip_ref ||
          trip.trip_id ||
          trip.id,

        handoverTimestamp:
          handoverTimestamp.toISOString(),

        boltSealIntact,

        boltSealCutPhotoUrl,
        cargoConditionPhotoUrls,

        compartmentHandoverTemps,

        receiverDockNumber,
        handoverNotes,
        receiverRepresentativeName,

        evidencePhotosSaved: true,

        evidenceDatabaseSaved: false,

        boltSealAlertRaised: false,

        boltSealAlertStatus: boltSealIntact
          ? 'NOT_REQUIRED'
          : 'PENDING_OPS_INTEGRATION',

        boltSealNumber:
          trip.bolt_seal_number || null,

        nextStep: 'RECEIVER_OUTCOME',
      };
    } catch (error) {
      // Remove all uploaded files if the operation fails.
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }

  // API 25.1 - Record Receiver Outcome Choice
  async recordDeliveryOutcomeChoice(
    userId: string,
    tripId: string,
    body: {
      deliveryOutcome: string;
      outcomeSelectedTimestamp: string;
    },
  ) {
    // 1. Validate authentication and trip ID.
    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    // 2. Validate allowed receiver outcomes.
    const allowedOutcomes = [
      'FULL_ACCEPTANCE',
      'PARTIAL_ACCEPTANCE',
      'EXCURSION_CLAIM',
      'FULL_REJECTION',
      'FAILED_DELIVERY',
    ];

    const deliveryOutcome = String(
      body?.deliveryOutcome || '',
    ).trim().toUpperCase();

    if (!allowedOutcomes.includes(deliveryOutcome)) {
      throw new BadRequestException(
        `Invalid deliveryOutcome. Allowed values: ${allowedOutcomes.join(', ')}`,
      );
    }

    // 3. Validate ISO 8601 timestamp.
    const timestampValue = String(
      body?.outcomeSelectedTimestamp || '',
    ).trim();

    const isoTimestampPattern =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

    if (!isoTimestampPattern.test(timestampValue)) {
      throw new BadRequestException(
        'outcomeSelectedTimestamp must be a valid ISO 8601 timestamp',
      );
    }

    const outcomeSelectedTimestamp = new Date(
      timestampValue,
    );

    if (
      !Number.isFinite(
        outcomeSelectedTimestamp.getTime(),
      )
    ) {
      throw new BadRequestException(
        'Invalid outcomeSelectedTimestamp',
      );
    }

    // 4. Verify trip belongs to the authenticated driver.
    const tripResult = await this.db.query(
      `
      SELECT
        t.id,
        t.trip_ref,
        t.trip_id,
        t.status,
        t.delivery_arrival_timestamp
      FROM trips t
      WHERE
        (
          t.trip_ref = $1
          OR t.trip_id = $1
          OR t.id::text = $1
        )
        AND (
          t.driver_user_id = $2::uuid

          OR EXISTS (
            SELECT 1
            FROM drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $2::uuid
          )

          OR EXISTS (
            SELECT 1
            FROM bookings b
            JOIN drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $2::uuid
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    // Delivery arrival must already have been recorded.
    if (!trip.delivery_arrival_timestamp) {
      throw new BadRequestException(
        'Record delivery arrival before selecting the receiver outcome',
      );
    }

    // 5. Inspect actual trips-table columns.
    // This avoids assuming database column names.
    const outcomeColumnCandidates = [
      'delivery_outcome',
      'receiver_delivery_outcome',
      'delivery_outcome_choice',
    ];

    const timestampColumnCandidates = [
      'outcome_selected_timestamp',
      'delivery_outcome_selected_timestamp',
      'receiver_outcome_selected_timestamp',
    ];

    const schemaResult = await this.db.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trips'
        AND column_name = ANY($1::text[])
      `,
      [
        [
          ...outcomeColumnCandidates,
          ...timestampColumnCandidates,
        ],
      ],
    );

    const existingColumns = new Set(
      schemaResult.rows.map(
        (row: any) => row.column_name,
      ),
    );

    const outcomeColumn =
      outcomeColumnCandidates.find(
        (column) => existingColumns.has(column),
      );

    const timestampColumn =
      timestampColumnCandidates.find(
        (column) => existingColumns.has(column),
      );

    // 6. Do not execute UPDATE against guessed/missing columns.
    if (!outcomeColumn || !timestampColumn) {
      throw new ConflictException(
        'API 25.1 database persistence columns are missing. The trips table must have a delivery outcome column and an outcome selected timestamp column. Please ask the database owner to verify the schema.',
      );
    }

    // 7. Save the selected outcome immediately.
    // Column names are selected only from the fixed allowlists above.
    const updateResult = await this.db.query(
      `
      UPDATE trips
      SET
        "${outcomeColumn}" = $1,
        "${timestampColumn}" = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, trip_ref, trip_id
      `,
      [
        deliveryOutcome,
        outcomeSelectedTimestamp,
        trip.id,
      ],
    );

    if (!updateResult.rows.length) {
      throw new NotFoundException(
        'Unable to save receiver delivery outcome',
      );
    }

    // 8. Determine next POD flow.
    const nextStepByOutcome: Record<string, string> = {
      FULL_ACCEPTANCE: 'POD_FULL_ACCEPTANCE',
      PARTIAL_ACCEPTANCE: 'POD_PARTIAL_ACCEPTANCE',
      EXCURSION_CLAIM: 'POD_EXCURSION_CLAIM',
      FULL_REJECTION: 'POD_FULL_REJECTION',
      FAILED_DELIVERY: 'POD_FAILED_DELIVERY',
    };

    return {
      tripId:
        trip.trip_ref ||
        trip.trip_id ||
        trip.id,

      deliveryOutcome,

      outcomeSelectedTimestamp:
        outcomeSelectedTimestamp.toISOString(),

      nextStep: nextStepByOutcome[deliveryOutcome],
    };
  }

  // API 26.1 - Submit Full Acceptance Proof of Delivery
  async submitFullAcceptancePOD(
    userId: string,
    tripId: string,
    body: any,
    files: {
      receiverSignaturePhoto?: any[];
      podPhotos?: any[];
      receiverStampPhoto?: any[];
    },
  ) {
    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    // 1. Validate fixed delivery outcome.
    const deliveryOutcome = String(
      body?.deliveryOutcome || '',
    ).trim().toUpperCase();

    if (deliveryOutcome !== 'FULL_ACCEPTANCE') {
      throw new BadRequestException(
        'deliveryOutcome must be FULL_ACCEPTANCE',
      );
    }

    // 2. Validate receiver details.
    const receiverName = String(
      body?.receiverName || '',
    ).trim();

    const receiverDesignation = String(
      body?.receiverDesignation || '',
    ).trim();

    const receiverContactNumber = String(
      body?.receiverContactNumber || '',
    ).trim();

    const receiverOtp = String(
      body?.receiverOtp || '',
    ).trim();

    const receiverSignaturePhoto =
      files?.receiverSignaturePhoto?.[0];

    const receiverStampPhoto =
      files?.receiverStampPhoto?.[0];

    const podPhotos = files?.podPhotos || [];

    if (receiverName.length < 2) {
      throw new BadRequestException(
        'Valid receiverName is required',
      );
    }

    if (receiverDesignation.length < 2) {
      throw new BadRequestException(
        'Valid receiverDesignation is required',
      );
    }

    if (
      receiverContactNumber &&
      !/^\+?[0-9]{10,15}$/.test(receiverContactNumber)
    ) {
      throw new BadRequestException(
        'receiverContactNumber must be a valid phone number',
      );
    }

    // 3. Receiver must sign using OTP or signature photo.
    const otpProvided = Boolean(receiverOtp);
    const signatureProvided = Boolean(
      receiverSignaturePhoto,
    );

    if (otpProvided === signatureProvided) {
      throw new BadRequestException(
        'Provide either receiverOtp or receiverSignaturePhoto',
      );
    }

    if (
      receiverOtp &&
      !/^\d{6}$/.test(receiverOtp)
    ) {
      throw new BadRequestException(
        'receiverOtp must contain exactly 6 digits',
      );
    }

    // 4. Validate Lorry Receipt acknowledgement.
    const lorryReceiptAcknowledged =
      String(body?.lorryReceiptAcknowledged)
        .trim()
        .toLowerCase() === 'true';

    if (!lorryReceiptAcknowledged) {
      throw new BadRequestException(
        'lorryReceiptAcknowledged must be true',
      );
    }

    // 5. Validate submission timestamp.
    const timestampValue = String(
      body?.podSubmittedTimestamp || '',
    ).trim();

    const isoTimestampPattern =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

    if (!isoTimestampPattern.test(timestampValue)) {
      throw new BadRequestException(
        'podSubmittedTimestamp must be a valid ISO 8601 timestamp',
      );
    }

    const podSubmittedDate = new Date(timestampValue);

    if (!Number.isFinite(podSubmittedDate.getTime())) {
      throw new BadRequestException(
        'Invalid podSubmittedTimestamp',
      );
    }

    // 6. Validate mandatory POD photo.
    if (podPhotos.length < 1) {
      throw new BadRequestException(
        'At least one podPhotos image is required',
      );
    }

    // 7. Validate actual JPG / PNG file contents.
    const isValidImage = (file: any): boolean => {
      const buffer: Buffer = file?.buffer;

      if (
        !buffer ||
        !Buffer.isBuffer(buffer) ||
        buffer.length === 0
      ) {
        return false;
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          buffer.length >= 3 &&
          buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return (
          buffer.length >= 8 &&
          buffer.subarray(0, 8).equals(
            Buffer.from([
              0x89, 0x50, 0x4e, 0x47,
              0x0d, 0x0a, 0x1a, 0x0a,
            ]),
          )
        );
      }

      return false;
    };

    if (
      signatureProvided &&
      !isValidImage(receiverSignaturePhoto)
    ) {
      throw new BadRequestException(
        'receiverSignaturePhoto must be a valid JPG or PNG image',
      );
    }

    for (const photo of podPhotos) {
      if (!isValidImage(photo)) {
        throw new BadRequestException(
          'Every podPhotos file must be a valid JPG or PNG image',
        );
      }
    }

    if (
      receiverStampPhoto &&
      !isValidImage(receiverStampPhoto)
    ) {
      throw new BadRequestException(
        'receiverStampPhoto must be a valid JPG or PNG image',
      );
    }

    // 8. Inspect actual trips-table columns.
    const schemaResult = await this.db.query(
      `
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trips'
      `,
    );

    const schema = new Map<string, any>(
      schemaResult.rows.map((row: any) => [
        row.column_name,
        row,
      ]),
    );

    const findColumn = (candidates: string[]) =>
      candidates.find((name) => schema.has(name));

    const columns = {
      outcome: findColumn([
        'delivery_outcome',
        'receiver_delivery_outcome',
        'delivery_outcome_choice',
      ]),

      outcomeTimestamp: findColumn([
        'outcome_selected_timestamp',
        'delivery_outcome_selected_timestamp',
        'receiver_outcome_selected_timestamp',
      ]),

      receiverName: findColumn([
        'receiver_name',
        'pod_receiver_name',
        'delivery_receiver_name',
        'full_acceptance_receiver_name',
      ]),

      receiverDesignation: findColumn([
        'receiver_designation',
        'pod_receiver_designation',
        'delivery_receiver_designation',
      ]),

      receiverContactNumber: findColumn([
        'receiver_contact_number',
        'pod_receiver_contact_number',
        'delivery_receiver_contact_number',
      ]),

      receiverOtpVerified: findColumn([
        'receiver_otp_verified',
        'consignee_otp_verified',
      ]),

      receiverSignaturePhoto: findColumn([
        'receiver_signature_photo_url',
        'pod_receiver_signature_photo_url',
        'delivery_receiver_signature_photo_url',
      ]),

      podPhotos: findColumn([
        'pod_photo_urls',
        'delivery_pod_photo_urls',
        'full_acceptance_pod_photo_urls',
      ]),

      receiverStampPhoto: findColumn([
        'receiver_stamp_photo_url',
        'pod_receiver_stamp_photo_url',
      ]),

      lorryReceiptAcknowledged: findColumn([
        'lorry_receipt_acknowledged',
        'pod_lorry_receipt_acknowledged',
      ]),

      podRemarks: findColumn([
        'pod_remarks',
        'delivery_pod_remarks',
      ]),

      podSubmittedTimestamp: findColumn([
        'pod_submitted_timestamp',
        'delivery_pod_submitted_timestamp',
      ]),

      epodReference: findColumn([
        'epod_reference',
        'delivery_epod_reference',
      ]),
    };

    // Required DB fields must really exist.
    const missingColumns = [
      'outcome',
      'outcomeTimestamp',
      'receiverName',
      'receiverDesignation',
      'podPhotos',
      'lorryReceiptAcknowledged',
      'podSubmittedTimestamp',
      'epodReference',
    ].filter((key) => !columns[key]);

    if (
      signatureProvided &&
      !columns.receiverSignaturePhoto
    ) {
      missingColumns.push('receiverSignaturePhoto');
    }

    if (missingColumns.length > 0) {
      throw new ConflictException(
        `POD database columns are missing: ${missingColumns.join(', ')}. Please ask the database owner to verify the trips table schema.`,
      );
    }

    // 9. Verify trip ownership and API 25.1 selection.
    const tripResult = await this.db.query(
      `
      SELECT
        t.id,
        t.trip_ref,
        t.trip_id,
        t.delivery_arrival_timestamp,
        t."${columns.outcome}" AS delivery_outcome,
        t."${columns.outcomeTimestamp}" AS outcome_selected_timestamp,
        t."${columns.podSubmittedTimestamp}" AS existing_pod_timestamp
        ${columns.receiverOtpVerified
        ? `, t."${columns.receiverOtpVerified}" AS receiver_otp_verified`
        : ''
      }
      FROM trips t
      WHERE
        (
          t.trip_ref = $1
          OR t.trip_id = $1
          OR t.id::text = $1
        )
        AND (
          t.driver_user_id = $2::uuid

          OR EXISTS (
            SELECT 1
            FROM drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $2::uuid
          )

          OR EXISTS (
            SELECT 1
            FROM bookings b
            JOIN drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $2::uuid
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    if (!trip.delivery_arrival_timestamp) {
      throw new ConflictException(
        'Delivery arrival must be recorded before submitting the POD',
      );
    }

    if (
      String(trip.delivery_outcome || '').toUpperCase() !==
      'FULL_ACCEPTANCE'
    ) {
      throw new ConflictException(
        'Select FULL_ACCEPTANCE using API 25.1 before submitting this POD',
      );
    }

    if (trip.existing_pod_timestamp) {
      throw new ConflictException(
        'Full acceptance POD has already been submitted for this trip',
      );
    }

    if (
      trip.outcome_selected_timestamp &&
      podSubmittedDate <
      new Date(trip.outcome_selected_timestamp)
    ) {
      throw new BadRequestException(
        'podSubmittedTimestamp cannot be earlier than the selected delivery outcome timestamp',
      );
    }

    // 10. If OTP is used, require prior verified receiver OTP state.
    // Never trust a six-digit OTP merely because it was submitted.
    if (otpProvided) {
      if (
        !columns.receiverOtpVerified ||
        trip.receiver_otp_verified !== true
      ) {
        throw new BadRequestException(
          'Receiver OTP has not been verified. Complete the receiver OTP verification flow first or use receiverSignaturePhoto.',
        );
      }
    }

    // 11. Prepare e-POD reference.
    const referenceDate = podSubmittedDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    const referenceTripId = String(
      trip.trip_ref || trip.trip_id || trip.id,
    ).replace(/[^A-Za-z0-9-]/g, '');

    const epodReference =
      `EPOD-${referenceTripId}-${referenceDate}`;

    // 12. Save uploaded images privately.
    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-full-acceptance-pod',
    );

    const savedFilePaths: string[] = [];

    const saveImage = async (file: any) => {
      const extension =
        file.mimetype === 'image/jpeg'
          ? '.jpg'
          : '.png';

      const filename = `${randomUUID()}${extension}`;
      const filePath = join(
        storageDirectory,
        filename,
      );

      await writeFile(filePath, file.buffer, {
        flag: 'wx',
      });

      savedFilePaths.push(filePath);

      return (
        `private://trip-full-acceptance-pod/${filename}`
      );
    };

    try {
      await mkdir(storageDirectory, {
        recursive: true,
      });

      let receiverSignaturePhotoUrl: string | null =
        null;

      if (signatureProvided) {
        receiverSignaturePhotoUrl =
          await saveImage(receiverSignaturePhoto);
      }

      const podPhotoUrls: string[] = [];

      for (const photo of podPhotos) {
        podPhotoUrls.push(await saveImage(photo));
      }

      let receiverStampPhotoUrl: string | null =
        null;

      if (receiverStampPhoto) {
        receiverStampPhotoUrl =
          await saveImage(receiverStampPhoto);
      }

      // 13. Prepare safe database update.
      const values: any[] = [];
      const assignments: string[] = [];

      const addAssignment = (
        column: string,
        value: any,
        cast = '',
      ) => {
        values.push(value);
        assignments.push(
          `"${column}" = $${values.length}${cast}`,
        );
      };

      addAssignment(
        columns.receiverName!,
        receiverName,
      );

      addAssignment(
        columns.receiverDesignation!,
        receiverDesignation,
      );

      addAssignment(
        columns.lorryReceiptAcknowledged!,
        true,
      );

      addAssignment(
        columns.podSubmittedTimestamp!,
        podSubmittedDate.toISOString(),
      );

      addAssignment(
        columns.epodReference!,
        epodReference,
      );

      // Handle POD photo storage according to the real DB type.
      const podPhotoColumn =
        schema.get(columns.podPhotos!);

      let podPhotoCast = '';
      let podPhotoValue: any = podPhotoUrls;

      if (
        podPhotoColumn.data_type === 'ARRAY' &&
        podPhotoColumn.udt_name === '_text'
      ) {
        podPhotoCast = '::text[]';
      } else if (
        podPhotoColumn.data_type === 'jsonb'
      ) {
        podPhotoCast = '::jsonb';
        podPhotoValue = JSON.stringify(podPhotoUrls);
      } else if (
        podPhotoColumn.data_type === 'json'
      ) {
        podPhotoCast = '::json';
        podPhotoValue = JSON.stringify(podPhotoUrls);
      } else if (
        ['text', 'character varying'].includes(
          podPhotoColumn.data_type,
        )
      ) {
        podPhotoValue = JSON.stringify(podPhotoUrls);
      } else {
        throw new ConflictException(
          'The POD photo database column must support text arrays, JSON or JSONB storage',
        );
      }

      addAssignment(
        columns.podPhotos!,
        podPhotoValue,
        podPhotoCast,
      );

      if (columns.receiverSignaturePhoto) {
        addAssignment(
          columns.receiverSignaturePhoto,
          receiverSignaturePhotoUrl,
        );
      }

      if (columns.receiverStampPhoto) {
        addAssignment(
          columns.receiverStampPhoto,
          receiverStampPhotoUrl,
        );
      }

      if (columns.receiverContactNumber) {
        addAssignment(
          columns.receiverContactNumber,
          receiverContactNumber || null,
        );
      }

      if (columns.podRemarks) {
        addAssignment(
          columns.podRemarks,
          String(body?.podRemarks || '').trim() || null,
        );
      }

      // Prevent an update if another request already submitted POD.
      values.push(trip.id);
      const tripIdParameter = values.length;

      values.push(userId);
      const userIdParameter = values.length;

      const updateResult = await this.db.query(
        `
        UPDATE trips t
        SET
          ${assignments.join(',\n          ')},
          updated_at = NOW()
        WHERE t.id = $${tripIdParameter}
          AND t."${columns.outcome}" = 'FULL_ACCEPTANCE'
          AND t."${columns.podSubmittedTimestamp}" IS NULL
          AND t.delivery_arrival_timestamp IS NOT NULL
          AND (
            t.driver_user_id = $${userIdParameter}::uuid

            OR EXISTS (
              SELECT 1
              FROM drivers d
              WHERE d.id = t.fleet_assigned_driver_id
                AND d.user_id = $${userIdParameter}::uuid
            )

            OR EXISTS (
              SELECT 1
              FROM bookings b
              JOIN drivers d
                ON d.id = b.assigned_driver_id
              WHERE b.id = t.booking_id
                AND d.user_id = $${userIdParameter}::uuid
            )
          )
        RETURNING t.id
        `,
        values,
      );

      if (!updateResult.rows.length) {
        throw new ConflictException(
          'POD could not be saved. Verify trip assignment and confirm that another POD has not already been submitted.',
        );
      }

      // 14. Return API 26.1 response.
      return {
        tripId:
          trip.trip_ref ||
          trip.trip_id ||
          trip.id,
        deliveryOutcome: 'FULL_ACCEPTANCE',
        podSubmittedTimestamp:
          podSubmittedDate.toISOString(),
        epodReference,
        nextStep: 'TRIP_EXPENSES',
      };
    } catch (error) {
      // Remove saved files if the DB save fails.
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }

  // API 27.1 - Submit Partial Acceptance Proof of Delivery
  async submitPartialAcceptancePOD(
    userId: string,
    tripId: string,
    body: any,
    files: {
      receiverSignaturePhoto?: any[];
      podPhotos?: any[];
      receiverStampPhoto?: any[];
      quantityMismatchPhotos?: any[];
    },
  ) {
    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    // 1. Validate delivery outcome.
    const deliveryOutcome = String(
      body?.deliveryOutcome || '',
    ).trim().toUpperCase();

    if (deliveryOutcome !== 'PARTIAL_ACCEPTANCE') {
      throw new BadRequestException(
        'deliveryOutcome must be PARTIAL_ACCEPTANCE',
      );
    }

    // 2. Validate receiver information.
    const receiverName = String(
      body?.receiverName || '',
    ).trim();

    const receiverDesignation = String(
      body?.receiverDesignation || '',
    ).trim();

    const receiverContactNumber = String(
      body?.receiverContactNumber || '',
    ).trim();

    if (receiverName.length < 2) {
      throw new BadRequestException(
        'Valid receiverName is required',
      );
    }

    if (receiverDesignation.length < 2) {
      throw new BadRequestException(
        'Valid receiverDesignation is required',
      );
    }

    if (
      receiverContactNumber &&
      !/^\+?[0-9]{10,15}$/.test(receiverContactNumber)
    ) {
      throw new BadRequestException(
        'Invalid receiverContactNumber',
      );
    }

    // 3. Validate delivered and rejected counts.
    const deliveredCount = Number(body?.deliveredCount);
    const rejectedCount = Number(body?.rejectedCount);

    if (
      !Number.isInteger(deliveredCount) ||
      deliveredCount <= 0
    ) {
      throw new BadRequestException(
        'deliveredCount must be a positive whole number',
      );
    }

    if (
      !Number.isInteger(rejectedCount) ||
      rejectedCount <= 0
    ) {
      throw new BadRequestException(
        'rejectedCount must be a positive whole number',
      );
    }

    // 4. Validate quantity unit.
    const quantityUnit = String(
      body?.quantityUnit || '',
    ).trim().toUpperCase();

    const allowedUnits = [
      'CARTONS',
      'PALLETS',
      'BAGS',
      'PIECES',
    ];

    if (!allowedUnits.includes(quantityUnit)) {
      throw new BadRequestException(
        'quantityUnit must be CARTONS, PALLETS, BAGS or PIECES',
      );
    }

    // 5. Validate rejected item description.
    const rejectedItemDescription = String(
      body?.rejectedItemDescription || '',
    ).trim();

    if (!rejectedItemDescription) {
      throw new BadRequestException(
        'rejectedItemDescription is required',
      );
    }

    // 6. Validate discrepancy reason.
    const discrepancyReason = String(
      body?.discrepancyReason || '',
    ).trim().toUpperCase();

    const allowedReasons = [
      'DAMAGED_PACKAGING',
      'QUANTITY_MISMATCH',
      'WRONG_ITEM',
      'TEMP_BREACH',
      'OTHER',
    ];

    if (!allowedReasons.includes(discrepancyReason)) {
      throw new BadRequestException(
        'Invalid discrepancyReason',
      );
    }

    const discrepancyRemarks =
      String(body?.discrepancyRemarks || '').trim();

    // 7. Validate receiver sign-off.
    const receiverOtp = String(
      body?.receiverOtp || '',
    ).trim();

    const receiverSignaturePhoto =
      files?.receiverSignaturePhoto?.[0];

    const otpProvided = Boolean(receiverOtp);
    const signatureProvided = Boolean(
      receiverSignaturePhoto,
    );

    if (otpProvided === signatureProvided) {
      throw new BadRequestException(
        'Provide either receiverOtp or receiverSignaturePhoto',
      );
    }

    if (
      receiverOtp &&
      !/^\d{6}$/.test(receiverOtp)
    ) {
      throw new BadRequestException(
        'receiverOtp must contain exactly 6 digits',
      );
    }

    // 8. Validate Lorry Receipt acknowledgement.
    const lorryReceiptAcknowledged =
      String(body?.lorryReceiptAcknowledged)
        .trim()
        .toLowerCase() === 'true';

    if (!lorryReceiptAcknowledged) {
      throw new BadRequestException(
        'lorryReceiptAcknowledged must be true',
      );
    }

    // 9. Validate POD timestamp.
    const timestampValue = String(
      body?.podSubmittedTimestamp || '',
    ).trim();

    const isoTimestampPattern =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

    if (!isoTimestampPattern.test(timestampValue)) {
      throw new BadRequestException(
        'podSubmittedTimestamp must be a valid ISO 8601 timestamp',
      );
    }

    const podSubmittedDate = new Date(timestampValue);

    if (
      !Number.isFinite(podSubmittedDate.getTime())
    ) {
      throw new BadRequestException(
        'Invalid podSubmittedTimestamp',
      );
    }

    // 10. Validate mandatory uploaded files.
    const quantityMismatchPhotos =
      files?.quantityMismatchPhotos || [];

    const podPhotos = files?.podPhotos || [];

    const receiverStampPhoto =
      files?.receiverStampPhoto?.[0];

    if (quantityMismatchPhotos.length < 2) {
      throw new BadRequestException(
        'At least two quantityMismatchPhotos are required',
      );
    }

    if (podPhotos.length < 1) {
      throw new BadRequestException(
        'At least one podPhotos image is required',
      );
    }

    // 11. Verify image contents (JPG/PNG only).
    const isValidImage = (file: any): boolean => {
      const buffer: Buffer = file?.buffer;

      if (
        !buffer ||
        !Buffer.isBuffer(buffer) ||
        buffer.length === 0
      ) {
        return false;
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          buffer.length >= 3 &&
          buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return (
          buffer.length >= 8 &&
          buffer.subarray(0, 8).equals(
            Buffer.from([
              0x89, 0x50, 0x4e, 0x47,
              0x0d, 0x0a, 0x1a, 0x0a,
            ]),
          )
        );
      }

      return false;
    };

    if (
      signatureProvided &&
      !isValidImage(receiverSignaturePhoto)
    ) {
      throw new BadRequestException(
        'receiverSignaturePhoto must be a valid JPG or PNG image',
      );
    }

    if (
      !quantityMismatchPhotos.every(isValidImage) ||
      !podPhotos.every(isValidImage)
    ) {
      throw new BadRequestException(
        'All uploaded photos must be valid JPG or PNG images',
      );
    }

    if (
      receiverStampPhoto &&
      !isValidImage(receiverStampPhoto)
    ) {
      throw new BadRequestException(
        'receiverStampPhoto must be a valid JPG or PNG image',
      );
    }

    // 12. Confirm partial POD columns exist in the real schema.
    const requiredPartialColumns = [
      'delivered_count',
      'rejected_count',
      'quantity_unit',
      'rejected_item_description',
      'discrepancy_reason',
      'discrepancy_remarks',
      'quantity_mismatch_photo_urls',
    ];

    const schemaResult = await this.db.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trips'
        AND column_name = ANY($1::text[])
      `,
      [requiredPartialColumns],
    );

    const existingColumns = new Set(
      schemaResult.rows.map(
        (row: any) => row.column_name,
      ),
    );

    const missingColumns = requiredPartialColumns.filter(
      (column) => !existingColumns.has(column),
    );

    if (missingColumns.length > 0) {
      throw new ConflictException(
        `Partial POD database columns are missing: ${missingColumns.join(', ')}`,
      );
    }

    // 13. Verify driver ownership, API 25 outcome and API 18 loading.
    const tripResult = await this.db.query(
      `
      SELECT
        t.id,
        t.trip_ref,
        t.trip_id,
        t.delivery_arrival_timestamp,
        t.delivery_outcome,
        t.outcome_selected_timestamp,
        t.loading_status,
        t.loading_carton_count,
        t.loading_pallet_count,
        t.receiver_otp_verified,
        t.pod_submitted_timestamp
      FROM trips t
      WHERE
        (
          t.trip_ref = $1
          OR t.trip_id = $1
          OR t.id::text = $1
        )
        AND (
          t.driver_user_id = $2::uuid

          OR EXISTS (
            SELECT 1
            FROM drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $2::uuid
          )

          OR EXISTS (
            SELECT 1
            FROM bookings b
            JOIN drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $2::uuid
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    if (!trip.delivery_arrival_timestamp) {
      throw new ConflictException(
        'Delivery arrival must be recorded before submitting POD',
      );
    }

    if (
      String(trip.delivery_outcome || '').toUpperCase() !==
      'PARTIAL_ACCEPTANCE'
    ) {
      throw new ConflictException(
        'Select PARTIAL_ACCEPTANCE using API 25.1 before submitting this POD',
      );
    }

    if (
      String(trip.loading_status || '').toUpperCase() !==
      'RECORDED'
    ) {
      throw new ConflictException(
        'Loading proof must be recorded before partial acceptance POD',
      );
    }

    if (trip.pod_submitted_timestamp) {
      throw new ConflictException(
        'A POD has already been submitted for this trip',
      );
    }

    if (
      trip.outcome_selected_timestamp &&
      podSubmittedDate <
      new Date(trip.outcome_selected_timestamp)
    ) {
      throw new BadRequestException(
        'podSubmittedTimestamp cannot be earlier than outcomeSelectedTimestamp',
      );
    }

    // 14. Cross-check against API 18.1 loaded count.
    let totalLoadedCount: number;

    if (quantityUnit === 'CARTONS') {
      totalLoadedCount = Number(
        trip.loading_carton_count,
      );
    } else if (quantityUnit === 'PALLETS') {
      totalLoadedCount = Number(
        trip.loading_pallet_count,
      );
    } else {
      throw new ConflictException(
        `API 18.1 does not currently expose a confirmed loaded total for ${quantityUnit}. Use CARTONS or PALLETS until the corresponding loaded-count source is available.`,
      );
    }

    if (
      !Number.isInteger(totalLoadedCount) ||
      totalLoadedCount <= 0
    ) {
      throw new ConflictException(
        `No valid API 18.1 loaded count is available for ${quantityUnit}`,
      );
    }

    if (
      deliveredCount + rejectedCount !==
      totalLoadedCount
    ) {
      throw new BadRequestException(
        `Delivered count plus rejected count must equal the loaded count. Expected ${totalLoadedCount} ${quantityUnit}, received ${deliveredCount + rejectedCount}.`,
      );
    }

    // 15. OTP must already be verified. Do not trust typed OTP alone.
    if (
      otpProvided &&
      trip.receiver_otp_verified !== true
    ) {
      throw new BadRequestException(
        'Receiver OTP has not been verified. Complete the receiver OTP verification flow first or use receiverSignaturePhoto.',
      );
    }

    // 16. Generate e-POD reference.
    const referenceDate = podSubmittedDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    const referenceTripId = String(
      trip.trip_ref || trip.trip_id || trip.id,
    ).replace(/[^A-Za-z0-9-]/g, '');

    const epodReference =
      `EPOD-${referenceTripId}-${referenceDate}`;

    // 17. Save files privately.
    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-partial-acceptance-pod',
    );

    const savedFilePaths: string[] = [];

    const saveImage = async (file: any) => {
      const extension =
        file.mimetype === 'image/jpeg'
          ? '.jpg'
          : '.png';

      const filename = `${randomUUID()}${extension}`;
      const filePath = join(
        storageDirectory,
        filename,
      );

      await writeFile(filePath, file.buffer, {
        flag: 'wx',
      });

      savedFilePaths.push(filePath);

      return (
        `private://trip-partial-acceptance-pod/${filename}`
      );
    };

    try {
      await mkdir(storageDirectory, {
        recursive: true,
      });

      let receiverSignaturePhotoUrl: string | null =
        null;

      if (signatureProvided) {
        receiverSignaturePhotoUrl =
          await saveImage(receiverSignaturePhoto);
      }

      const mismatchPhotoUrls: string[] = [];

      for (const photo of quantityMismatchPhotos) {
        mismatchPhotoUrls.push(
          await saveImage(photo),
        );
      }

      const podPhotoUrls: string[] = [];

      for (const photo of podPhotos) {
        podPhotoUrls.push(await saveImage(photo));
      }

      let receiverStampPhotoUrl: string | null =
        null;

      if (receiverStampPhoto) {
        receiverStampPhotoUrl =
          await saveImage(receiverStampPhoto);
      }

      // 18. Save partial POD and shared receiver evidence.
      const updateResult = await this.db.query(
        `
        UPDATE trips
        SET
          receiver_name = $1,
          receiver_designation = $2,
          receiver_contact_number = $3,
          receiver_otp_verified = $4,
          receiver_signature_photo_url = $5,
          pod_photo_urls = $6::text[],
          receiver_stamp_photo_url = $7,
          lorry_receipt_acknowledged = TRUE,
          pod_remarks = $8,
          pod_submitted_timestamp = $9,
          epod_reference = $10,

          delivered_count = $11,
          rejected_count = $12,
          quantity_unit = $13,
          rejected_item_description = $14,
          discrepancy_reason = $15,
          discrepancy_remarks = $16,
          quantity_mismatch_photo_urls = $17::text[],

          updated_at = NOW()
        WHERE id = $18
          AND delivery_outcome = 'PARTIAL_ACCEPTANCE'
          AND pod_submitted_timestamp IS NULL
          AND delivery_arrival_timestamp IS NOT NULL
          AND (
            driver_user_id = $19::uuid

            OR EXISTS (
              SELECT 1
              FROM drivers d
              WHERE d.id = fleet_assigned_driver_id
                AND d.user_id = $19::uuid
            )

            OR EXISTS (
              SELECT 1
              FROM bookings b
              JOIN drivers d
                ON d.id = b.assigned_driver_id
              WHERE b.id = booking_id
                AND d.user_id = $19::uuid
            )
          )
        RETURNING id
        `,
        [
          receiverName,
          receiverDesignation,
          receiverContactNumber || null,
          otpProvided,
          receiverSignaturePhotoUrl,
          podPhotoUrls,
          receiverStampPhotoUrl,
          String(body?.podRemarks || '').trim() || null,
          podSubmittedDate.toISOString(),
          epodReference,
          deliveredCount,
          rejectedCount,
          quantityUnit,
          rejectedItemDescription,
          discrepancyReason,
          discrepancyRemarks || null,
          mismatchPhotoUrls,
          trip.id,
          userId,
        ],
      );

      if (!updateResult.rows.length) {
        throw new ConflictException(
          'Partial acceptance POD could not be saved. Verify trip assignment and check whether a POD was already submitted.',
        );
      }

      // 19. Return API 27.1 response.
      return {
        tripId:
          trip.trip_ref ||
          trip.trip_id ||
          trip.id,
        deliveryOutcome: 'PARTIAL_ACCEPTANCE',
        deliveredCount,
        rejectedCount,
        quantityUnit,
        epodReference,
        podSubmittedTimestamp:
          podSubmittedDate.toISOString(),
        nextStep: 'TRIP_EXPENSES',
      };
    } catch (error) {
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }

  // API 28.1 - Submit Excursion Claim Proof of Delivery

  async submitExcursionClaimPOD(
    userId: string,
    tripId: string,
    body: any,
    files: {
      receiverSignaturePhoto?: any[];
      podPhotos?: any[];
      receiverStampPhoto?: any[];
      excursionPhotos?: any[];
    },
  ) {
    // 1. Validate authentication and trip ID.
    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    // 2. Validate delivery outcome.
    const deliveryOutcome = String(
      body?.deliveryOutcome || '',
    ).trim().toUpperCase();

    if (deliveryOutcome !== 'EXCURSION_CLAIM') {
      throw new BadRequestException(
        'deliveryOutcome must be EXCURSION_CLAIM',
      );
    }

    // 3. Validate receiver details.
    const receiverName = String(
      body?.receiverName || '',
    ).trim();

    const receiverDesignation = String(
      body?.receiverDesignation || '',
    ).trim();

    const receiverContactNumber = String(
      body?.receiverContactNumber || '',
    ).trim();

    if (receiverName.length < 2) {
      throw new BadRequestException(
        'Valid receiverName is required',
      );
    }

    if (receiverDesignation.length < 2) {
      throw new BadRequestException(
        'Valid receiverDesignation is required',
      );
    }

    if (
      receiverContactNumber &&
      !/^\+?[0-9]{10,15}$/.test(receiverContactNumber)
    ) {
      throw new BadRequestException(
        'Invalid receiverContactNumber',
      );
    }

    // 4. Validate receiver OTP or signature.
    const receiverOtp = String(
      body?.receiverOtp || '',
    ).trim();

    const receiverSignaturePhoto =
      files?.receiverSignaturePhoto?.[0];

    const otpProvided = Boolean(receiverOtp);

    const signatureProvided = Boolean(
      receiverSignaturePhoto,
    );

    if (otpProvided === signatureProvided) {
      throw new BadRequestException(
        'Provide either receiverOtp or receiverSignaturePhoto',
      );
    }

    if (
      otpProvided &&
      !/^\d{6}$/.test(receiverOtp)
    ) {
      throw new BadRequestException(
        'receiverOtp must contain exactly 6 digits',
      );
    }

    // 5. Validate compartment number.
    const excursionCompartmentNumber = Number(
      body?.excursionCompartmentNumber,
    );

    if (
      !Number.isInteger(excursionCompartmentNumber) ||
      excursionCompartmentNumber <= 0
    ) {
      throw new BadRequestException(
        'excursionCompartmentNumber must be a positive integer',
      );
    }

    // 6. Validate maximum recorded temperature.
    const excursionMaxTempRecordedCelsius = Number(
      body?.excursionMaxTempRecordedCelsius,
    );

    if (
      !Number.isFinite(
        excursionMaxTempRecordedCelsius,
      )
    ) {
      throw new BadRequestException(
        'Valid excursionMaxTempRecordedCelsius is required',
      );
    }

    // 7. Validate excursion start timestamp.
    const excursionStartDate = new Date(
      body?.excursionStartTimestamp,
    );

    if (
      !body?.excursionStartTimestamp ||
      !Number.isFinite(excursionStartDate.getTime())
    ) {
      throw new BadRequestException(
        'Valid excursionStartTimestamp is required',
      );
    }

    // 8. Validate excursion duration.
    const excursionDurationMinutes = Number(
      body?.excursionDurationMinutes,
    );

    if (
      !Number.isInteger(excursionDurationMinutes) ||
      excursionDurationMinutes <= 0
    ) {
      throw new BadRequestException(
        'excursionDurationMinutes must be a positive integer',
      );
    }

    // 9. Validate excursion reason.
    const excursionReason = String(
      body?.excursionReason || '',
    ).trim().toUpperCase();

    const allowedReasons = [
      'DOOR_OPENED_TOO_LONG',
      'REEFER_FAILURE',
      'ROUTE_DELAY',
      'PRECOOLING_INSUFFICIENT',
      'OTHER',
    ];

    if (!allowedReasons.includes(excursionReason)) {
      throw new BadRequestException(
        'Invalid excursionReason',
      );
    }

    // 10. Validate IoT log reference.
    const iotExcursionLogReference = String(
      body?.iotExcursionLogReference || '',
    ).trim();

    if (!iotExcursionLogReference) {
      throw new BadRequestException(
        'iotExcursionLogReference is required',
      );
    }

    // 11. Validate acceptance under protest.
    const receiverAcceptedUnderProtest =
      String(body?.receiverAcceptedUnderProtest)
        .trim()
        .toLowerCase() === 'true';

    if (!receiverAcceptedUnderProtest) {
      throw new BadRequestException(
        'receiverAcceptedUnderProtest must be true',
      );
    }

    // 12. Validate claim flag.
    const claimRaisedValue = String(
      body?.claimRaisedByReceiver ?? '',
    ).trim().toLowerCase();

    if (
      !['true', 'false'].includes(claimRaisedValue)
    ) {
      throw new BadRequestException(
        'claimRaisedByReceiver must be true or false',
      );
    }

    const claimRaisedByReceiver =
      claimRaisedValue === 'true';

    const receiverRemarks = String(
      body?.receiverRemarks || '',
    ).trim();

    const podRemarks = String(
      body?.podRemarks || '',
    ).trim();

    // 13. Validate Lorry Receipt acknowledgement.
    const lorryReceiptAcknowledged =
      String(body?.lorryReceiptAcknowledged)
        .trim()
        .toLowerCase() === 'true';

    if (!lorryReceiptAcknowledged) {
      throw new BadRequestException(
        'lorryReceiptAcknowledged must be true',
      );
    }

    // 14. Validate POD timestamp.
    const podSubmittedDate = new Date(
      body?.podSubmittedTimestamp,
    );

    if (
      !body?.podSubmittedTimestamp ||
      !Number.isFinite(podSubmittedDate.getTime())
    ) {
      throw new BadRequestException(
        'Valid podSubmittedTimestamp is required',
      );
    }

    if (excursionStartDate > podSubmittedDate) {
      throw new BadRequestException(
        'Excursion start timestamp cannot be after POD submission',
      );
    }

    // 15. Validate uploaded files.
    const excursionPhotos =
      files?.excursionPhotos || [];

    const podPhotos =
      files?.podPhotos || [];

    const receiverStampPhoto =
      files?.receiverStampPhoto?.[0];

    if (excursionPhotos.length < 2) {
      throw new BadRequestException(
        'At least two excursionPhotos are required',
      );
    }

    if (podPhotos.length < 1) {
      throw new BadRequestException(
        'At least one podPhotos image is required',
      );
    }

    // 16. Validate actual JPG / PNG file contents.
    const isValidImage = (file: any): boolean => {
      const buffer: Buffer = file?.buffer;

      if (
        !buffer ||
        !Buffer.isBuffer(buffer) ||
        buffer.length === 0
      ) {
        return false;
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          buffer.length >= 3 &&
          buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return (
          buffer.length >= 8 &&
          buffer.subarray(0, 8).equals(
            Buffer.from([
              0x89, 0x50, 0x4e, 0x47,
              0x0d, 0x0a, 0x1a, 0x0a,
            ]),
          )
        );
      }

      return false;
    };

    if (
      signatureProvided &&
      !isValidImage(receiverSignaturePhoto)
    ) {
      throw new BadRequestException(
        'receiverSignaturePhoto must be a valid JPG or PNG image',
      );
    }

    if (
      !excursionPhotos.every(isValidImage) ||
      !podPhotos.every(isValidImage)
    ) {
      throw new BadRequestException(
        'All excursionPhotos and podPhotos must be valid JPG or PNG images',
      );
    }

    if (
      receiverStampPhoto &&
      !isValidImage(receiverStampPhoto)
    ) {
      throw new BadRequestException(
        'receiverStampPhoto must be a valid JPG or PNG image',
      );
    }

    // 17. Check whether receiver OTP verification exists.
    const otpColumnResult = await this.db.query(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trips'
        AND column_name = 'receiver_otp_verified'
      LIMIT 1
      `,
    );

    const hasOtpVerifiedColumn =
      otpColumnResult.rows.length > 0;

    if (
      otpProvided &&
      !hasOtpVerifiedColumn
    ) {
      throw new BadRequestException(
        'Receiver OTP verification is not configured. Use receiverSignaturePhoto.',
      );
    }

    const otpSelect = hasOtpVerifiedColumn
      ? ', t.receiver_otp_verified'
      : '';

    // 18. Find trip and verify driver ownership.
    const tripResult = await this.db.query(
      `
      SELECT
        t.id,
        t.trip_ref,
        t.trip_id,
        t.delivery_arrival_timestamp,
        t.delivery_outcome,
        t.outcome_selected_timestamp,
        t.pod_submitted_timestamp
        ${otpSelect}

      FROM trips t

      WHERE
        (
          t.trip_ref = $1
          OR t.trip_id = $1
          OR t.id::text = $1
        )

        AND (
          t.driver_user_id = $2::uuid

          OR EXISTS (
            SELECT 1
            FROM drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $2::uuid
          )

          OR EXISTS (
            SELECT 1
            FROM bookings b
            JOIN drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $2::uuid
          )
        )

      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    // 19. Verify receiver OTP if OTP was supplied.
    if (
      otpProvided &&
      trip.receiver_otp_verified !== true
    ) {
      throw new BadRequestException(
        'Receiver OTP has not been verified. Complete OTP verification first or use receiverSignaturePhoto.',
      );
    }

    // 20. Validate delivery arrival.
    if (!trip.delivery_arrival_timestamp) {
      throw new ConflictException(
        'Delivery arrival must be recorded before excursion POD',
      );
    }

    // 21. Validate API 25.1 outcome.
    if (
      String(trip.delivery_outcome || '')
        .trim()
        .toUpperCase() !== 'EXCURSION_CLAIM'
    ) {
      throw new ConflictException(
        'Select EXCURSION_CLAIM using API 25.1 before submitting this POD',
      );
    }

    if (trip.pod_submitted_timestamp) {
      throw new ConflictException(
        'A POD has already been submitted for this trip',
      );
    }

    if (
      trip.outcome_selected_timestamp &&
      podSubmittedDate <
      new Date(trip.outcome_selected_timestamp)
    ) {
      throw new BadRequestException(
        'podSubmittedTimestamp cannot be earlier than outcomeSelectedTimestamp',
      );
    }

    // 22. Verify that the compartment belongs to this trip.
    const compartmentResult = await this.db.query(
      `
      SELECT *
      FROM trip_compartments

      WHERE
        (
          trip_ref = $1
          OR trip_id = $2
        )

        AND compartment_number = $3
        AND is_active IS DISTINCT FROM FALSE

      LIMIT 1
      `,
      [
        trip.trip_ref,
        trip.id,
        excursionCompartmentNumber,
      ],
    );

    if (!compartmentResult.rows.length) {
      throw new NotFoundException(
        'Excursion compartment was not found for this trip',
      );
    }

    // 23. Verify actual IoT excursion log.
    const iotLogResult = await this.db.query(
      `
      SELECT
        id,
        log_reference,
        compartment_number,
        max_temperature_celsius,
        excursion_start_timestamp,
        excursion_duration_minutes

      FROM public.trip_iot_excursion_logs

      WHERE trip_id = $1
        AND log_reference = $2
        AND compartment_number = $3
        AND UPPER(source) = 'IOT'

      LIMIT 1
      `,
      [
        trip.id,
        iotExcursionLogReference,
        excursionCompartmentNumber,
      ],
    );

    if (!iotLogResult.rows.length) {
      throw new ConflictException(
        'IoT excursion log reference was not found for this trip and compartment',
      );
    }

    const iotLog = iotLogResult.rows[0];

    // 24. Cross-check temperature with IoT record.
    const loggedMaxTemp = Number(
      iotLog.max_temperature_celsius,
    );

    if (
      !Number.isFinite(loggedMaxTemp) ||
      Math.abs(
        loggedMaxTemp -
        excursionMaxTempRecordedCelsius
      ) > 0.01
    ) {
      throw new BadRequestException(
        'excursionMaxTempRecordedCelsius does not match the IoT log',
      );
    }

    // 25. Cross-check excursion start time.
    const loggedStartDate = new Date(
      iotLog.excursion_start_timestamp,
    );

    if (
      !Number.isFinite(loggedStartDate.getTime()) ||
      loggedStartDate.getTime() !==
      excursionStartDate.getTime()
    ) {
      throw new BadRequestException(
        'excursionStartTimestamp does not match the IoT log',
      );
    }

    // 26. Cross-check duration.
    const loggedDuration = Number(
      iotLog.excursion_duration_minutes,
    );

    if (
      !Number.isInteger(loggedDuration) ||
      loggedDuration !== excursionDurationMinutes
    ) {
      throw new BadRequestException(
        'excursionDurationMinutes does not match the IoT log',
      );
    }

    // 27. Generate POD and claim references.
    const referenceDate = podSubmittedDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    const referenceTripId = String(
      trip.trip_ref || trip.trip_id || trip.id,
    ).replace(/[^A-Za-z0-9-]/g, '');

    const epodReference =
      `EPOD-${referenceTripId}-${referenceDate}`;

    const claimId = randomUUID();

    const opsTicketId = claimRaisedByReceiver
      ? `OPS-CLAIM-${referenceTripId}-${randomUUID()
        .slice(0, 8)
        .toUpperCase()}`
      : null;

    const settlementStatus = claimRaisedByReceiver
      ? 'HOLD_PENDING_CLAIM_RESOLUTION'
      : 'NOT_ON_HOLD';

    const opsTicketStatus = claimRaisedByReceiver
      ? 'OPEN'
      : 'NOT_REQUIRED';

    const shipperNotificationStatus =
      claimRaisedByReceiver
        ? 'PENDING'
        : 'NOT_REQUIRED';

    // 28. Prepare private image storage.
    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-excursion-claim-pod',
    );

    const savedFilePaths: string[] = [];

    const saveImage = async (file: any) => {
      const extension =
        file.mimetype === 'image/jpeg'
          ? '.jpg'
          : '.png';

      const filename =
        `${randomUUID()}${extension}`;

      const filePath = join(
        storageDirectory,
        filename,
      );

      await writeFile(filePath, file.buffer, {
        flag: 'wx',
      });

      savedFilePaths.push(filePath);

      return (
        `private://trip-excursion-claim-pod/${filename}`
      );
    };

    try {
      await mkdir(storageDirectory, {
        recursive: true,
      });

      // 29. Save receiver signature.
      const receiverSignaturePhotoUrl =
        signatureProvided
          ? await saveImage(receiverSignaturePhoto)
          : null;

      // 30. Save excursion evidence.
      const excursionPhotoUrls: string[] = [];

      for (const photo of excursionPhotos) {
        excursionPhotoUrls.push(
          await saveImage(photo),
        );
      }

      // 31. Save POD photos.
      const podPhotoUrls: string[] = [];

      for (const photo of podPhotos) {
        podPhotoUrls.push(
          await saveImage(photo),
        );
      }

      // 32. Save optional stamp.
      const receiverStampPhotoUrl =
        receiverStampPhoto
          ? await saveImage(receiverStampPhoto)
          : null;

      const signoffMethod = otpProvided
        ? 'OTP'
        : 'SIGNATURE';

      const opsOutboxId = randomUUID();
      const shipperOutboxId = randomUUID();

      // 33. Save trip, excursion claim and notification events.
      // The trip update, claim insert and outbox insert
      // are linked in one PostgreSQL statement.
      const saveResult = await this.db.query(
        `
        WITH updated_trip AS (
          UPDATE public.trips t

          SET
            receiver_name = $3,
            receiver_designation = $4,
            receiver_contact_number = $5,
            receiver_signature_photo_url = $7,
            pod_photo_urls = $17::text[],
            receiver_stamp_photo_url = $18,
            lorry_receipt_acknowledged = TRUE,
            pod_remarks = $19,
            pod_submitted_timestamp = $20::timestamptz,
            epod_reference = $21,
            settlement_status = $23,
            ops_claim_ticket_id = $22,
            updated_at = NOW()

          WHERE t.id = $1

            AND UPPER(COALESCE(
              t.delivery_outcome, ''
            )) = 'EXCURSION_CLAIM'

            AND t.pod_submitted_timestamp IS NULL

            AND t.delivery_arrival_timestamp IS NOT NULL

            AND (
              t.driver_user_id = $2::uuid

              OR EXISTS (
                SELECT 1
                FROM drivers d
                WHERE d.id = t.fleet_assigned_driver_id
                  AND d.user_id = $2::uuid
              )

              OR EXISTS (
                SELECT 1
                FROM bookings b
                JOIN drivers d
                  ON d.id = b.assigned_driver_id
                WHERE b.id = t.booking_id
                  AND d.user_id = $2::uuid
              )
            )

          RETURNING t.id
        ),

        inserted_claim AS (
          INSERT INTO public.trip_excursion_claims (
            id,
            trip_id,
            receiver_name,
            receiver_designation,
            receiver_contact_number,
            signoff_method,
            receiver_signature_photo_url,
            excursion_compartment_number,
            excursion_max_temp_recorded_celsius,
            excursion_start_timestamp,
            excursion_duration_minutes,
            excursion_reason,
            iot_excursion_log_reference,
            receiver_accepted_under_protest,
            claim_raised_by_receiver,
            receiver_remarks,
            excursion_photo_urls,
            pod_photo_urls,
            receiver_stamp_photo_url,
            lorry_receipt_acknowledged,
            pod_remarks,
            pod_submitted_timestamp,
            epod_reference,
            ops_ticket_id,
            settlement_status,
            ops_ticket_status,
            shipper_notification_status,
            created_at,
            updated_at
          )

          SELECT
            $26,
            ut.id,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10::timestamptz,
            $11,
            $12,
            $13,
            TRUE,
            $14,
            $15,
            $16::text[],
            $17::text[],
            $18,
            TRUE,
            $19,
            $20::timestamptz,
            $21,
            $22,
            $23,
            $24,
            $25,
            NOW(),
            NOW()

          FROM updated_trip ut

          RETURNING id
        ),

        inserted_outbox AS (
          INSERT INTO public.trip_claim_notification_outbox (
            id,
            claim_id,
            event_type,
            payload,
            delivery_status,
            created_at
          )

          SELECT
            $27,
            ic.id,
            'OPS_INVESTIGATION_REQUESTED',
            jsonb_build_object(
              'tripId', $29::text,
              'claimId', ic.id::text,
              'opsTicketId', $22::text,
              'settlementStatus', $23::text
            ),
            'PENDING',
            NOW()

          FROM inserted_claim ic
          WHERE $14::boolean = TRUE

          UNION ALL

          SELECT
            $28,
            ic.id,
            'SHIPPER_EXCURSION_CLAIM',
            jsonb_build_object(
              'tripId', $29::text,
              'claimId', ic.id::text,
              'opsTicketId', $22::text,
              'settlementStatus', $23::text
            ),
            'PENDING',
            NOW()

          FROM inserted_claim ic
          WHERE $14::boolean = TRUE

          RETURNING id
        )

        SELECT
          ut.id,
          ic.id AS claim_id,

          (
            SELECT COUNT(*)::INTEGER
            FROM inserted_outbox
          ) AS queued_notification_count

        FROM updated_trip ut
        CROSS JOIN inserted_claim ic
        `,
        [
          trip.id,                              // $1
          userId,                               // $2
          receiverName,                         // $3
          receiverDesignation,                  // $4
          receiverContactNumber || null,        // $5
          signoffMethod,                        // $6
          receiverSignaturePhotoUrl,            // $7
          excursionCompartmentNumber,           // $8
          excursionMaxTempRecordedCelsius,      // $9
          excursionStartDate.toISOString(),     // $10
          excursionDurationMinutes,             // $11
          excursionReason,                      // $12
          iotExcursionLogReference,             // $13
          claimRaisedByReceiver,                // $14
          receiverRemarks || null,              // $15
          excursionPhotoUrls,                   // $16
          podPhotoUrls,                         // $17
          receiverStampPhotoUrl,                // $18
          podRemarks || null,                   // $19
          podSubmittedDate.toISOString(),       // $20
          epodReference,                        // $21
          opsTicketId,                          // $22
          settlementStatus,                     // $23
          opsTicketStatus,                      // $24
          shipperNotificationStatus,            // $25
          claimId,                              // $26
          opsOutboxId,                          // $27
          shipperOutboxId,                      // $28
          trip.trip_ref || trip.trip_id || trip.id, // $29
        ],
      );

      if (!saveResult.rows.length) {
        throw new ConflictException(
          'Excursion claim POD could not be saved. Verify trip assignment, outcome selection and existing POD status.',
        );
      }

      // 34. Return response.
      return {
        tripId:
          trip.trip_ref ||
          trip.trip_id ||
          trip.id,

        deliveryOutcome: 'EXCURSION_CLAIM',

        claimRaisedByReceiver,

        opsTicketId,

        opsTicketCreated: Boolean(opsTicketId),

        opsNotificationQueued:
          claimRaisedByReceiver,

        shipperNotificationQueued:
          claimRaisedByReceiver,

        notificationEventsQueued:
          Number(
            saveResult.rows[0].queued_notification_count,
          ),

        settlementStatus,

        epodReference,

        podSubmittedTimestamp:
          podSubmittedDate.toISOString(),

        nextStep: 'TRIP_EXPENSES',
      };

    } catch (error) {
      // 35. Remove files if the database save fails.
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }
  // ============================================================
  // API 29.1 - Submit Full Rejection Proof of Delivery
  // ============================================================

  async submitFullRejectionPOD(
    userId: string,
    tripId: string,
    body: any,
    files: {
      receiverSignaturePhoto?: any[];
      podPhotos?: any[];
      receiverStampPhoto?: any[];
      rejectionPhotos?: any[];
      receiverRefusalLetterPhoto?: any[];
    },
  ) {
    // ----------------------------------------------------------
    // 1. Validate driver and trip identifiers
    // ----------------------------------------------------------

    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    // ----------------------------------------------------------
    // 2. Validate delivery outcome
    // ----------------------------------------------------------

    const deliveryOutcome = String(
      body?.deliveryOutcome || '',
    ).trim().toUpperCase();

    if (deliveryOutcome !== 'FULL_REJECTION') {
      throw new BadRequestException(
        'deliveryOutcome must be FULL_REJECTION',
      );
    }

    // ----------------------------------------------------------
    // 3. Validate receiver details
    // ----------------------------------------------------------

    const receiverName = String(
      body?.receiverName || '',
    ).trim();

    const receiverDesignation = String(
      body?.receiverDesignation || '',
    ).trim();

    const receiverContactNumber = String(
      body?.receiverContactNumber || '',
    ).trim();

    if (receiverName.length < 2) {
      throw new BadRequestException(
        'Valid receiverName is required',
      );
    }

    if (receiverDesignation.length < 2) {
      throw new BadRequestException(
        'Valid receiverDesignation is required',
      );
    }

    if (
      receiverContactNumber &&
      !/^\+?[0-9]{10,15}$/.test(receiverContactNumber)
    ) {
      throw new BadRequestException(
        'receiverContactNumber must be a valid phone number',
      );
    }

    // ----------------------------------------------------------
    // 4. Validate receiver sign-off
    // ----------------------------------------------------------

    const receiverOtp = String(
      body?.receiverOtp || '',
    ).trim();

    const receiverSignaturePhoto =
      files?.receiverSignaturePhoto?.[0];

    const otpProvided = Boolean(receiverOtp);

    const signatureProvided = Boolean(
      receiverSignaturePhoto,
    );

    if (otpProvided === signatureProvided) {
      throw new BadRequestException(
        'Provide either receiverOtp or receiverSignaturePhoto, not both',
      );
    }

    if (
      receiverOtp &&
      !/^\d{6}$/.test(receiverOtp)
    ) {
      throw new BadRequestException(
        'receiverOtp must contain exactly 6 digits',
      );
    }

    // ----------------------------------------------------------
    // 5. Validate rejection reason
    // ----------------------------------------------------------

    const rejectionReason = String(
      body?.rejectionReason || '',
    ).trim().toUpperCase();

    const allowedRejectionReasons = [
      'TEMP_BREACH_ENTIRE_LOAD',
      'WRONG_PRODUCT',
      'EXPIRED_GOODS',
      'CONTAMINATION',
      'PACKAGING_FAILURE',
      'OTHER',
    ];

    if (!allowedRejectionReasons.includes(rejectionReason)) {
      throw new BadRequestException(
        'Invalid rejectionReason',
      );
    }

    // ----------------------------------------------------------
    // 6. Validate rejection remarks
    // ----------------------------------------------------------

    const rejectionRemarks = String(
      body?.rejectionRemarks || '',
    ).trim();

    if (rejectionRemarks.length < 5) {
      throw new BadRequestException(
        'Detailed rejectionRemarks are required',
      );
    }

    // ----------------------------------------------------------
    // 7. Validate rejected count
    // ----------------------------------------------------------

    const totalRejectedCount = Number(
      body?.totalRejectedCount,
    );

    if (
      !Number.isInteger(totalRejectedCount) ||
      totalRejectedCount <= 0
    ) {
      throw new BadRequestException(
        'totalRejectedCount must be a positive whole number',
      );
    }

    // ----------------------------------------------------------
    // 8. Validate quantity unit
    // ----------------------------------------------------------

    const quantityUnit = String(
      body?.quantityUnit || '',
    ).trim().toUpperCase();

    const allowedQuantityUnits = [
      'CARTONS',
      'PALLETS',
      'BAGS',
      'PIECES',
    ];

    if (!allowedQuantityUnits.includes(quantityUnit)) {
      throw new BadRequestException(
        'quantityUnit must be CARTONS, PALLETS, BAGS or PIECES',
      );
    }

    // ----------------------------------------------------------
    // 9. Validate cargo retention
    // ----------------------------------------------------------

    const cargoRetainedValue = String(
      body?.cargoRetainedInTruck ?? '',
    ).trim().toLowerCase();

    if (
      cargoRetainedValue !== 'true' &&
      cargoRetainedValue !== 'false'
    ) {
      throw new BadRequestException(
        'cargoRetainedInTruck must be true or false',
      );
    }

    const cargoRetainedInTruck =
      cargoRetainedValue === 'true';

    // The specification says that the driver must describe
    // where cargo was offloaded when it is not retained.
    const cargoOffloadLocation = String(
      body?.cargoOffloadLocation || '',
    ).trim();

    if (
      !cargoRetainedInTruck &&
      cargoOffloadLocation.length < 3
    ) {
      throw new BadRequestException(
        'cargoOffloadLocation is required when cargoRetainedInTruck is false',
      );
    }

    // ----------------------------------------------------------
    // 10. Validate IoT reference when required
    // ----------------------------------------------------------

    const iotExcursionLogReference = String(
      body?.iotExcursionLogReference || '',
    ).trim();

    if (
      rejectionReason === 'TEMP_BREACH_ENTIRE_LOAD' &&
      !iotExcursionLogReference
    ) {
      throw new BadRequestException(
        'iotExcursionLogReference is required for TEMP_BREACH_ENTIRE_LOAD',
      );
    }

    // ----------------------------------------------------------
    // 11. Validate lorry receipt acknowledgement
    // ----------------------------------------------------------

    const lorryReceiptAcknowledged =
      String(body?.lorryReceiptAcknowledged || '')
        .trim()
        .toLowerCase() === 'true';

    if (!lorryReceiptAcknowledged) {
      throw new BadRequestException(
        'lorryReceiptAcknowledged must be true',
      );
    }

    // ----------------------------------------------------------
    // 12. Validate POD timestamp
    // ----------------------------------------------------------

    const timestampValue = String(
      body?.podSubmittedTimestamp || '',
    ).trim();

    const isoTimestampPattern =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

    if (!isoTimestampPattern.test(timestampValue)) {
      throw new BadRequestException(
        'podSubmittedTimestamp must be a valid ISO 8601 timestamp',
      );
    }

    const podSubmittedDate = new Date(timestampValue);

    if (!Number.isFinite(podSubmittedDate.getTime())) {
      throw new BadRequestException(
        'Invalid podSubmittedTimestamp',
      );
    }

    // ----------------------------------------------------------
    // 13. Validate mandatory uploaded files
    // ----------------------------------------------------------

    const rejectionPhotos =
      files?.rejectionPhotos || [];

    const podPhotos =
      files?.podPhotos || [];

    const receiverRefusalLetterPhoto =
      files?.receiverRefusalLetterPhoto?.[0];

    const receiverStampPhoto =
      files?.receiverStampPhoto?.[0];

    if (rejectionPhotos.length < 3) {
      throw new BadRequestException(
        'At least three rejectionPhotos are required',
      );
    }

    if (!receiverRefusalLetterPhoto) {
      throw new BadRequestException(
        'receiverRefusalLetterPhoto is mandatory',
      );
    }

    if (podPhotos.length < 1) {
      throw new BadRequestException(
        'At least one podPhotos image is required',
      );
    }

    // ----------------------------------------------------------
    // 14. Validate actual JPG / PNG file contents
    // ----------------------------------------------------------

    const isValidImage = (file: any): boolean => {
      const buffer: Buffer = file?.buffer;

      if (
        !buffer ||
        !Buffer.isBuffer(buffer) ||
        buffer.length === 0
      ) {
        return false;
      }

      if (file.mimetype === 'image/jpeg') {
        return (
          buffer.length >= 3 &&
          buffer[0] === 0xff &&
          buffer[1] === 0xd8 &&
          buffer[2] === 0xff
        );
      }

      if (file.mimetype === 'image/png') {
        return (
          buffer.length >= 8 &&
          buffer.subarray(0, 8).equals(
            Buffer.from([
              0x89, 0x50, 0x4e, 0x47,
              0x0d, 0x0a, 0x1a, 0x0a,
            ]),
          )
        );
      }

      return false;
    };

    if (
      signatureProvided &&
      !isValidImage(receiverSignaturePhoto)
    ) {
      throw new BadRequestException(
        'receiverSignaturePhoto must be a valid JPG or PNG image',
      );
    }

    if (
      !rejectionPhotos.every(isValidImage) ||
      !podPhotos.every(isValidImage) ||
      !isValidImage(receiverRefusalLetterPhoto)
    ) {
      throw new BadRequestException(
        'All mandatory rejection and POD files must be valid JPG or PNG images',
      );
    }

    if (
      receiverStampPhoto &&
      !isValidImage(receiverStampPhoto)
    ) {
      throw new BadRequestException(
        'receiverStampPhoto must be a valid JPG or PNG image',
      );
    }

    // ----------------------------------------------------------
    // 15. Inspect actual trips table schema
    // ----------------------------------------------------------

    const schemaResult = await this.db.query(
      `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
    `,
    );

    const existingColumns = new Set(
      schemaResult.rows.map(
        (row: any) => row.column_name,
      ),
    );

    const requiredTripColumns = [
      'delivery_outcome',
      'outcome_selected_timestamp',
      'delivery_arrival_timestamp',
      'pod_submitted_timestamp',
      'receiver_name',
      'receiver_designation',
      'receiver_contact_number',
      'receiver_otp_verified',
      'receiver_signature_photo_url',
      'pod_photo_urls',
      'receiver_stamp_photo_url',
      'lorry_receipt_acknowledged',
      'pod_remarks',
      'epod_reference',
      'loading_status',
    ];

    const missingTripColumns =
      requiredTripColumns.filter(
        (column) => !existingColumns.has(column),
      );

    if (missingTripColumns.length > 0) {
      throw new ConflictException(
        `Full rejection POD database columns are missing: ${missingTripColumns.join(', ')}`,
      );
    }

    // ----------------------------------------------------------
    // 16. Verify driver ownership and trip
    // ----------------------------------------------------------

    const tripResult = await this.db.query(
      `
    SELECT
      t.id,
      t.trip_ref,
      t.trip_id,
      t.delivery_arrival_timestamp,
      t.delivery_outcome,
      t.outcome_selected_timestamp,
      t.loading_status,
      t.receiver_otp_verified,
      t.pod_submitted_timestamp
    FROM public.trips t
    WHERE
      (
        t.trip_ref = $1
        OR t.trip_id = $1
        OR t.id::text = $1
      )
      AND (
        t.driver_user_id = $2::uuid

        OR EXISTS (
          SELECT 1
          FROM public.drivers d
          WHERE d.id = t.fleet_assigned_driver_id
            AND d.user_id = $2::uuid
        )

        OR EXISTS (
          SELECT 1
          FROM public.bookings b
          JOIN public.drivers d
            ON d.id = b.assigned_driver_id
          WHERE b.id = t.booking_id
            AND d.user_id = $2::uuid
        )
      )
    ORDER BY t.created_at DESC
    LIMIT 1
    `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    // ----------------------------------------------------------
    // 17. Validate delivery arrival
    // ----------------------------------------------------------

    if (!trip.delivery_arrival_timestamp) {
      throw new ConflictException(
        'Delivery arrival must be recorded before submitting rejection POD',
      );
    }

    // ----------------------------------------------------------
    // 18. Validate API 25.1 selected outcome
    // ----------------------------------------------------------

    if (
      String(trip.delivery_outcome || '').toUpperCase() !==
      'FULL_REJECTION'
    ) {
      throw new ConflictException(
        'Select FULL_REJECTION using API 25.1 before submitting this POD',
      );
    }

    // ----------------------------------------------------------
    // 19. Prevent duplicate POD submission
    // ----------------------------------------------------------

    if (trip.pod_submitted_timestamp) {
      throw new ConflictException(
        'A POD has already been submitted for this trip',
      );
    }

    // ----------------------------------------------------------
    // 20. Verify loading was completed
    // ----------------------------------------------------------

    if (
      String(trip.loading_status || '').toUpperCase() !==
      'RECORDED'
    ) {
      throw new ConflictException(
        'Loading proof must be recorded before full rejection POD',
      );
    }

    // ----------------------------------------------------------
    // 21. Validate timestamp against API 25.1
    // ----------------------------------------------------------

    if (
      trip.outcome_selected_timestamp &&
      podSubmittedDate <
      new Date(trip.outcome_selected_timestamp)
    ) {
      throw new BadRequestException(
        'podSubmittedTimestamp cannot be earlier than outcomeSelectedTimestamp',
      );
    }

    // ----------------------------------------------------------
    // 22. Verify receiver OTP if OTP sign-off is used
    // ----------------------------------------------------------

    if (
      otpProvided &&
      trip.receiver_otp_verified !== true
    ) {
      throw new BadRequestException(
        'Receiver OTP has not been verified. Complete receiver OTP verification first or use receiverSignaturePhoto.',
      );
    }

    // ----------------------------------------------------------
    // 23. Verify actual API 18.1 loaded quantity
    // ----------------------------------------------------------

    const loadedCountColumnMap: Record<string, string[]> = {
      CARTONS: ['loading_carton_count'],
      PALLETS: ['loading_pallet_count'],
      BAGS: ['loading_bag_count', 'loaded_bag_count'],
      PIECES: ['loading_piece_count', 'loaded_piece_count'],
    };

    const candidateColumns =
      loadedCountColumnMap[quantityUnit];

    const loadedCountColumn =
      candidateColumns.find(
        (column) => existingColumns.has(column),
      );

    if (!loadedCountColumn) {
      throw new ConflictException(
        `No confirmed API 18.1 loaded-count column is available for ${quantityUnit}. Ask the database owner to verify the loading schema.`,
      );
    }

    const loadedCountResult = await this.db.query(
      `
    SELECT "${loadedCountColumn}" AS loaded_count
    FROM public.trips
    WHERE id = $1
    `,
      [trip.id],
    );

    const totalLoadedCount = Number(
      loadedCountResult.rows[0]?.loaded_count,
    );

    if (
      !Number.isInteger(totalLoadedCount) ||
      totalLoadedCount <= 0
    ) {
      throw new ConflictException(
        `A valid API 18.1 loaded quantity is not available for ${quantityUnit}`,
      );
    }

    if (totalRejectedCount !== totalLoadedCount) {
      throw new BadRequestException(
        `Full rejection count must equal the total loaded count. Expected ${totalLoadedCount} ${quantityUnit}, received ${totalRejectedCount}.`,
      );
    }

    // ----------------------------------------------------------
    // 24. Validate temperature excursion IoT reference
    // when the rejection reason is temperature breach
    // ----------------------------------------------------------

    if (rejectionReason === 'TEMP_BREACH_ENTIRE_LOAD') {
      const iotTableResult = await this.db.query(
        `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'trip_iot_excursion_logs'
      ) AS table_exists
      `,
      );

      if (!iotTableResult.rows[0]?.table_exists) {
        throw new ConflictException(
          'The saved IoT excursion log table is not available. Verify the temperature-log integration before submitting this rejection.',
        );
      }

      const iotResult = await this.db.query(
        `
      SELECT id
      FROM public.trip_iot_excursion_logs
      WHERE trip_id = $1
        AND log_reference = $2
      LIMIT 1
      `,
        [
          trip.id,
          iotExcursionLogReference,
        ],
      );

      if (!iotResult.rows.length) {
        throw new BadRequestException(
          'iotExcursionLogReference does not match a saved IoT temperature record for this trip',
        );
      }
    }

    // ----------------------------------------------------------
    // 25. Generate e-POD and Ops disposition references
    // ----------------------------------------------------------

    const referenceDate = podSubmittedDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    const referenceTripId = String(
      trip.trip_ref || trip.trip_id || trip.id,
    ).replace(/[^A-Za-z0-9-]/g, '');

    const epodReference =
      `EPOD-${referenceTripId}-${referenceDate}`;

    const opsDispositionTicketId =
      cargoRetainedInTruck
        ? `OPS-DISP-${referenceDate}-${randomUUID()
          .slice(0, 8)
          .toUpperCase()}`
        : null;

    // ----------------------------------------------------------
    // 26. Prepare private file storage
    // ----------------------------------------------------------

    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-full-rejection-pod',
    );

    const savedFilePaths: string[] = [];

    const saveImage = async (file: any) => {
      const extension =
        file.mimetype === 'image/jpeg'
          ? '.jpg'
          : '.png';

      const filename =
        `${randomUUID()}${extension}`;

      const filePath = join(
        storageDirectory,
        filename,
      );

      await writeFile(filePath, file.buffer, {
        flag: 'wx',
      });

      savedFilePaths.push(filePath);

      return (
        `private://trip-full-rejection-pod/${filename}`
      );
    };

    // ----------------------------------------------------------
    // 27. Save files and database records
    // ----------------------------------------------------------

    try {
      await mkdir(storageDirectory, {
        recursive: true,
      });

      let receiverSignaturePhotoUrl: string | null =
        null;

      if (signatureProvided) {
        receiverSignaturePhotoUrl =
          await saveImage(receiverSignaturePhoto);
      }

      const rejectionPhotoUrls: string[] = [];

      for (const photo of rejectionPhotos) {
        rejectionPhotoUrls.push(
          await saveImage(photo),
        );
      }

      const podPhotoUrls: string[] = [];

      for (const photo of podPhotos) {
        podPhotoUrls.push(
          await saveImage(photo),
        );
      }

      const receiverRefusalLetterPhotoUrl =
        await saveImage(receiverRefusalLetterPhoto);

      let receiverStampPhotoUrl: string | null =
        null;

      if (receiverStampPhoto) {
        receiverStampPhotoUrl =
          await saveImage(receiverStampPhoto);
      }

      // --------------------------------------------------------
      // 28. Save trip, rejection and Ops ticket atomically
      // --------------------------------------------------------

      const result = await this.db.query(
        `
      WITH updated_trip AS (
        UPDATE public.trips AS t
        SET
          receiver_name = $1,
          receiver_designation = $2,
          receiver_contact_number = $3,
          receiver_otp_verified = $4,
          receiver_signature_photo_url = $5,
          pod_photo_urls = $6::text[],
          receiver_stamp_photo_url = $7,
          lorry_receipt_acknowledged = TRUE,
          pod_remarks = $8,
          pod_submitted_timestamp = $9::timestamptz,
          epod_reference = $10,
          updated_at = NOW()
        WHERE t.id = $11
          AND t.delivery_outcome = 'FULL_REJECTION'
          AND t.pod_submitted_timestamp IS NULL
          AND t.delivery_arrival_timestamp IS NOT NULL
          AND (
            t.driver_user_id = $12::uuid

            OR EXISTS (
              SELECT 1
              FROM public.drivers d
              WHERE d.id = t.fleet_assigned_driver_id
                AND d.user_id = $12::uuid
            )

            OR EXISTS (
              SELECT 1
              FROM public.bookings b
              JOIN public.drivers d
                ON d.id = b.assigned_driver_id
              WHERE b.id = t.booking_id
                AND d.user_id = $12::uuid
            )
          )
        RETURNING t.id
      ),

      rejection_row AS (
        INSERT INTO public.trip_full_rejections (
          trip_id,
          rejection_reason,
          rejection_remarks,
          total_rejected_count,
          quantity_unit,
          cargo_retained_in_truck,
          cargo_offload_location,
          iot_excursion_log_reference,
          rejection_photo_urls,
          receiver_refusal_letter_photo_url,
          created_at,
          updated_at
        )
        SELECT
          id,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          $20::text[],
          $21,
          NOW(),
          NOW()
        FROM updated_trip
        RETURNING id, trip_id
      ),

      ops_ticket_row AS (
        INSERT INTO public.trip_ops_disposition_tickets (
          trip_id,
          ticket_ref,
          ticket_status,
          created_at,
          updated_at
        )
        SELECT
          trip_id,
          $22,
          'OPEN',
          NOW(),
          NOW()
        FROM rejection_row
        WHERE $17::boolean = TRUE
        RETURNING ticket_ref
      )

      SELECT
        updated_trip.id AS trip_id,
        rejection_row.id AS rejection_id,
        ops_ticket_row.ticket_ref AS ops_disposition_ticket_id
      FROM updated_trip
      JOIN rejection_row
        ON rejection_row.trip_id = updated_trip.id
      LEFT JOIN ops_ticket_row
        ON TRUE
      `,
        [
          receiverName,
          receiverDesignation,
          receiverContactNumber || null,
          otpProvided,
          receiverSignaturePhotoUrl,
          podPhotoUrls,
          receiverStampPhotoUrl,
          String(body?.podRemarks || '').trim() || null,
          podSubmittedDate.toISOString(),
          epodReference,
          trip.id,
          userId,
          rejectionReason,
          rejectionRemarks,
          totalRejectedCount,
          quantityUnit,
          cargoRetainedInTruck,
          cargoOffloadLocation || null,
          iotExcursionLogReference || null,
          rejectionPhotoUrls,
          receiverRefusalLetterPhotoUrl,
          opsDispositionTicketId,
        ],
      );

      if (!result.rows.length) {
        throw new ConflictException(
          'Full rejection POD could not be saved. Verify trip assignment and check whether another POD has already been submitted.',
        );
      }

      const saved = result.rows[0];

      // --------------------------------------------------------
      // 29. Return API 29.1 response
      // --------------------------------------------------------

      return {
        tripId:
          trip.trip_ref ||
          trip.trip_id ||
          trip.id,

        deliveryOutcome: 'FULL_REJECTION',

        totalRejectedCount,
        quantityUnit,

        cargoRetainedInTruck,

        opsDispositionTicketId:
          saved.ops_disposition_ticket_id || null,

        epodReference,

        podSubmittedTimestamp:
          podSubmittedDate.toISOString(),

        nextStep: cargoRetainedInTruck
          ? 'DISPOSITION'
          : 'TRIP_EXPENSES',
      };
    } catch (error) {
      // Remove uploaded files if database saving fails.
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }

  // ============================================================
  // SHARED API 30 HELPERS
  // ============================================================

  private async assertOpsDispositionSchema(): Promise<void> {
    const schemaResult = await this.db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trip_ops_disposition_tickets'
    `);

    const columns = new Set(
      schemaResult.rows.map((row: any) => row.column_name),
    );

    const requiredColumns = [
      'trip_id',
      'ticket_ref',
      'ticket_status',
      'ops_agent_name',
      'disposition_instruction',
      'disposition_instruction_note',
      'cold_store_address',
      'cold_store_contact_number',
      'cold_store_google_maps_link',
      'disposition_deadline_timestamp',
      'disposition_deadline_note',
      'reefer_must_stay_on',
      'driver_acknowledged',
      'acknowledgement_timestamp',
      'driver_current_latitude',
      'driver_current_longitude',
      'driver_note',
      'deadline_monitoring_started_at',
      'created_at',
      'updated_at',
    ];

    const missingColumns = requiredColumns.filter(
      (column) => !columns.has(column),
    );

    if (missingColumns.length > 0) {
      throw new ConflictException(
        `Ops disposition database columns are missing: ${missingColumns.join(', ')}. Apply the Ops disposition migration.`,
      );
    }
  }

  private async getDriverTripForDisposition(
    userId: string,
    tripId: string,
  ) {
    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    const result = await this.db.query(
      `
      SELECT
        t.id,
        t.trip_ref,
        t.trip_id,
        t.pod_submitted_timestamp
      FROM public.trips t
      WHERE
        (
          t.trip_ref = $1
          OR t.trip_id = $1
          OR t.id::text = $1
        )
        AND (
          t.driver_user_id = $2::uuid

          OR EXISTS (
            SELECT 1
            FROM public.drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $2::uuid
          )

          OR EXISTS (
            SELECT 1
            FROM public.bookings b
            JOIN public.drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $2::uuid
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [tripId, userId],
    );

    if (!result.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    return result.rows[0];
  }


  // ============================================================
  // SHARED API 30 HELPERS
  // ============================================================



  // ============================================================
  // API 30.1 - Fetch Ops Disposition Instruction
  // ============================================================

  async getOpsDispositionInstruction(
    userId: string,
    tripId: string,
  ) {
    await this.assertOpsDispositionSchema();

    const trip = await this.getDriverTripForDisposition(
      userId,
      tripId,
    );

    if (!trip.pod_submitted_timestamp) {
      throw new ConflictException(
        'Full rejection POD must be submitted before fetching Ops disposition',
      );
    }

    const ticketResult = await this.db.query(
      `
      SELECT
        ticket_ref,
        ticket_status,
        ops_agent_name,
        disposition_instruction,
        disposition_instruction_note,
        cold_store_address,
        cold_store_contact_number,
        cold_store_google_maps_link,
        disposition_deadline_timestamp,
        disposition_deadline_note,
        reefer_must_stay_on,
        driver_acknowledged
      FROM public.trip_ops_disposition_tickets
      WHERE trip_id = $1
        AND UPPER(ticket_status) = 'OPEN'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [trip.id],
    );

    if (!ticketResult.rows.length) {
      throw new NotFoundException(
        'No open Ops disposition ticket found for this trip',
      );
    }

    const ticket = ticketResult.rows[0];

    const allowedInstructions = [
      'HOLD_IN_VEHICLE',
      'RETURN_TO_ORIGIN',
      'MOVE_TO_COLD_STORE',
    ];

    const instruction = String(
      ticket.disposition_instruction || '',
    )
      .trim()
      .toUpperCase();

    if (!allowedInstructions.includes(instruction)) {
      throw new ConflictException(
        'Ops disposition instruction has not yet been assigned to this ticket',
      );
    }

    const opsAgentName = String(
      ticket.ops_agent_name || '',
    ).trim();

    if (!opsAgentName) {
      throw new ConflictException(
        'Ops agent details have not yet been assigned',
      );
    }

    if (
      !ticket.disposition_deadline_timestamp ||
      typeof ticket.reefer_must_stay_on !== 'boolean'
    ) {
      throw new ConflictException(
        'Ops deadline and reefer instructions are incomplete',
      );
    }

    const deadline = new Date(
      ticket.disposition_deadline_timestamp,
    );

    if (!Number.isFinite(deadline.getTime())) {
      throw new ConflictException(
        'Invalid Ops disposition deadline stored for this ticket',
      );
    }

    return {
      tripId:
        trip.trip_ref ||
        trip.trip_id ||
        trip.id,

      opsDispositionTicketId:
        ticket.ticket_ref,

      opsAgentName,

      dispositionInstruction:
        instruction,

      dispositionInstructionNote:
        ticket.disposition_instruction_note || null,

      coldStoreAddress:
        ticket.cold_store_address || null,

      coldStoreContactNumber:
        ticket.cold_store_contact_number || null,

      coldStoreGoogleMapsLink:
        ticket.cold_store_google_maps_link || null,

      dispositionDeadlineTimestamp:
        deadline.toISOString(),

      dispositionDeadlineNote:
        ticket.disposition_deadline_note || null,

      reeferMustStayOn:
        ticket.reefer_must_stay_on,

      driverAcknowledged:
        ticket.driver_acknowledged === true,
    };
  }

  // ============================================================
  // API 30.2 - Acknowledge Ops Disposition Instruction
  // ============================================================

  async acknowledgeOpsDisposition(
    userId: string,
    tripId: string,
    body: {
      opsTicketRef: string;
      dispositionInstruction: string;
      driverAcknowledged: boolean;
      acknowledgementTimestamp: string;
      opsAgentName: string;
      dispositionDeadlineTimestamp: string;
      driverCurrentLatitude: number;
      driverCurrentLongitude: number;
      driverNote?: string;
    },
  ) {
    await this.assertOpsDispositionSchema();

    const trip = await this.getDriverTripForDisposition(
      userId,
      tripId,
    );

    if (!trip.pod_submitted_timestamp) {
      throw new ConflictException(
        'Full rejection POD must be submitted before acknowledging disposition',
      );
    }

    const opsTicketRef = String(
      body?.opsTicketRef || '',
    ).trim();

    const instruction = String(
      body?.dispositionInstruction || '',
    )
      .trim()
      .toUpperCase();

    const opsAgentName = String(
      body?.opsAgentName || '',
    ).trim();

    const acknowledgementTimestamp = String(
      body?.acknowledgementTimestamp || '',
    ).trim();

    const dispositionDeadlineTimestamp = String(
      body?.dispositionDeadlineTimestamp || '',
    ).trim();

    const driverNote = String(
      body?.driverNote || '',
    ).trim();

    if (!opsTicketRef) {
      throw new BadRequestException(
        'opsTicketRef is required',
      );
    }

    const allowedInstructions = [
      'HOLD_IN_VEHICLE',
      'RETURN_TO_ORIGIN',
      'MOVE_TO_COLD_STORE',
    ];

    if (!allowedInstructions.includes(instruction)) {
      throw new BadRequestException(
        'Invalid dispositionInstruction',
      );
    }

    if (body?.driverAcknowledged !== true) {
      throw new BadRequestException(
        'driverAcknowledged must be true',
      );
    }

    if (opsAgentName.length < 2) {
      throw new BadRequestException(
        'opsAgentName is required',
      );
    }

    const isoPattern =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

    if (!isoPattern.test(acknowledgementTimestamp)) {
      throw new BadRequestException(
        'acknowledgementTimestamp must be a valid ISO 8601 timestamp',
      );
    }

    if (!isoPattern.test(dispositionDeadlineTimestamp)) {
      throw new BadRequestException(
        'dispositionDeadlineTimestamp must be a valid ISO 8601 timestamp',
      );
    }

    const acknowledgementDate = new Date(
      acknowledgementTimestamp,
    );

    const deadlineDate = new Date(
      dispositionDeadlineTimestamp,
    );

    if (
      !Number.isFinite(acknowledgementDate.getTime()) ||
      !Number.isFinite(deadlineDate.getTime())
    ) {
      throw new BadRequestException(
        'Invalid acknowledgement or disposition deadline timestamp',
      );
    }

    // Corrected GPS validation: coordinates must be numbers.
    const latitudeValue = body?.driverCurrentLatitude;
    const longitudeValue = body?.driverCurrentLongitude;

    if (
      typeof latitudeValue !== 'number' ||
      !Number.isFinite(latitudeValue)
    ) {
      throw new BadRequestException(
        'driverCurrentLatitude must be a valid number',
      );
    }

    if (
      typeof longitudeValue !== 'number' ||
      !Number.isFinite(longitudeValue)
    ) {
      throw new BadRequestException(
        'driverCurrentLongitude must be a valid number',
      );
    }

    const latitude = latitudeValue;
    const longitude = longitudeValue;

    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException(
        'driverCurrentLatitude must be between -90 and 90',
      );
    }

    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException(
        'driverCurrentLongitude must be between -180 and 180',
      );
    }

    if (driverNote.length > 2000) {
      throw new BadRequestException(
        'driverNote cannot exceed 2000 characters',
      );
    }

    const result = await this.db.query(
      `
      UPDATE public.trip_ops_disposition_tickets AS ticket
      SET
        driver_acknowledged = TRUE,
        acknowledgement_timestamp = $1::timestamptz,
        driver_current_latitude = $2,
        driver_current_longitude = $3,
        driver_note = $4,
        deadline_monitoring_started_at = NOW(),
        updated_at = NOW()
      FROM public.trips AS t
      WHERE ticket.trip_id = t.id
        AND t.id = $5
        AND ticket.ticket_ref = $6
        AND UPPER(ticket.ticket_status) = 'OPEN'
        AND UPPER(ticket.disposition_instruction) = $7
        AND LOWER(ticket.ops_agent_name) = LOWER($8)
        AND ticket.disposition_deadline_timestamp = $9::timestamptz
        AND ticket.driver_acknowledged IS NOT TRUE
        AND (
          t.driver_user_id = $10::uuid

          OR EXISTS (
            SELECT 1
            FROM public.drivers d
            WHERE d.id = t.fleet_assigned_driver_id
              AND d.user_id = $10::uuid
          )

          OR EXISTS (
            SELECT 1
            FROM public.bookings b
            JOIN public.drivers d
              ON d.id = b.assigned_driver_id
            WHERE b.id = t.booking_id
              AND d.user_id = $10::uuid
          )
        )
      RETURNING
        ticket.ticket_ref,
        ticket.disposition_instruction,
        ticket.acknowledgement_timestamp,
        ticket.disposition_deadline_timestamp,
        ticket.deadline_monitoring_started_at
      `,
      [
        acknowledgementDate.toISOString(),
        latitude,
        longitude,
        driverNote || null,
        trip.id,
        opsTicketRef,
        instruction,
        opsAgentName,
        deadlineDate.toISOString(),
        userId,
      ],
    );

    if (!result.rows.length) {
      throw new ConflictException(
        'No matching open Ops ticket found, the supplied instruction details do not match, or the ticket has already been acknowledged',
      );
    }

    const saved = result.rows[0];

    return {
      tripId:
        trip.trip_ref ||
        trip.trip_id ||
        trip.id,

      opsTicketRef:
        saved.ticket_ref,

      dispositionInstruction:
        saved.disposition_instruction,

      acknowledgementTimestamp:
        new Date(
          saved.acknowledgement_timestamp,
        ).toISOString(),

      dispositionDeadlineTimestamp:
        new Date(
          saved.disposition_deadline_timestamp,
        ).toISOString(),

      deadlineMonitoringActive:
        Boolean(saved.deadline_monitoring_started_at),

      nextStep: 'TRIP_EXPENSES',
    };
  }

  // ============================================================
  // API 31.1 - FAILED DELIVERY HELPERS
  // ============================================================

  private validateFailedDeliveryTimestamp(
    value: any,
    field: string,
  ): Date {
    const raw = String(value ?? '').trim();

    const pattern =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

    if (!pattern.test(raw)) {
      throw new BadRequestException(
        `${field} must be a valid ISO 8601 timestamp`,
      );
    }

    const date = new Date(raw);

    if (!Number.isFinite(date.getTime())) {
      throw new BadRequestException(`Invalid ${field}`);
    }

    return date;
  }


  private validateFailedDeliveryImage(file: any): boolean {
    const buffer: Buffer = file?.buffer;

    if (
      !buffer ||
      !Buffer.isBuffer(buffer) ||
      buffer.length === 0
    ) {
      return false;
    }

    if (file.mimetype === 'image/jpeg') {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    }

    if (file.mimetype === 'image/png') {
      return (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ]),
        )
      );
    }

    return false;
  }


  // ============================================================
  // API 31.1 - SUBMIT FAILED DELIVERY PROOF
  // ============================================================

  async submitFailedDeliveryPOD(
    userId: string,
    tripId: string,
    body: any,
    files: {
      receiverCallLogScreenshot?: any[];
      arrivalEvidencePhoto?: any[];
      failureEvidencePhotos?: any[];
    },
  ) {
    // ----------------------------------------------------------
    // 1. Validate identifiers
    // ----------------------------------------------------------

    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    // ----------------------------------------------------------
    // 2. Validate delivery outcome
    // ----------------------------------------------------------

    const deliveryOutcome = String(
      body?.deliveryOutcome || '',
    )
      .trim()
      .toUpperCase();

    if (deliveryOutcome !== 'FAILED_DELIVERY') {
      throw new BadRequestException(
        'deliveryOutcome must be FAILED_DELIVERY',
      );
    }

    // ----------------------------------------------------------
    // 3. Validate failure reason
    // ----------------------------------------------------------

    const allowedReasons = [
      'RECEIVER_ABSENT',
      'DOCK_CLOSED',
      'WRONG_ADDRESS',
      'OTP_REFUSED',
      'ACCESS_DENIED',
    ];

    const failureReason = String(
      body?.failureReason || '',
    )
      .trim()
      .toUpperCase();

    if (!allowedReasons.includes(failureReason)) {
      throw new BadRequestException(
        'Invalid failureReason',
      );
    }

    // ----------------------------------------------------------
    // 4. Validate failure remarks
    // ----------------------------------------------------------

    const failureRemarks = String(
      body?.failureRemarks || '',
    ).trim();

    if (failureRemarks.length < 5) {
      throw new BadRequestException(
        'Detailed failureRemarks are mandatory',
      );
    }

    // ----------------------------------------------------------
    // 5. Validate contact attempts and wait duration
    // ----------------------------------------------------------

    const contactAttempts = Number(body?.contactAttempts);

    const waitDurationMinutes = Number(
      body?.waitDurationMinutes,
    );

    if (
      !Number.isInteger(contactAttempts) ||
      contactAttempts < 1
    ) {
      throw new BadRequestException(
        'contactAttempts must be an integer greater than or equal to 1',
      );
    }

    if (
      !Number.isInteger(waitDurationMinutes) ||
      waitDurationMinutes < 0
    ) {
      throw new BadRequestException(
        'waitDurationMinutes must be a non-negative integer',
      );
    }

    // ----------------------------------------------------------
    // 6. Validate Ops escalation
    // ----------------------------------------------------------

    const opsEscalated =
      body?.opsEscalated === true ||
      String(body?.opsEscalated || '')
        .trim()
        .toLowerCase() === 'true';

    if (!opsEscalated) {
      throw new BadRequestException(
        'opsEscalated must be true. Contact Ops before leaving the location.',
      );
    }

    // ----------------------------------------------------------
    // 7. Validate timestamps
    // ----------------------------------------------------------

    const lastContactDate =
      this.validateFailedDeliveryTimestamp(
        body?.lastContactAttemptTimestamp,
        'lastContactAttemptTimestamp',
      );

    const opsEscalationDate =
      this.validateFailedDeliveryTimestamp(
        body?.opsEscalationTimestamp,
        'opsEscalationTimestamp',
      );

    const podSubmittedDate =
      this.validateFailedDeliveryTimestamp(
        body?.podSubmittedTimestamp,
        'podSubmittedTimestamp',
      );

    if (
      lastContactDate.getTime() > podSubmittedDate.getTime() ||
      opsEscalationDate.getTime() > podSubmittedDate.getTime()
    ) {
      throw new BadRequestException(
        'Contact and Ops escalation timestamps cannot be after POD submission',
      );
    }

    // ----------------------------------------------------------
    // 8. Validate GPS coordinates
    // ----------------------------------------------------------

    const latitude = Number(
      body?.driverCurrentLatitude,
    );

    const longitude = Number(
      body?.driverCurrentLongitude,
    );

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new BadRequestException(
        'driverCurrentLatitude must be between -90 and 90',
      );
    }

    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException(
        'driverCurrentLongitude must be between -180 and 180',
      );
    }

    // ----------------------------------------------------------
    // 9. Validate uploaded evidence
    // ----------------------------------------------------------

    const callLog =
      files?.receiverCallLogScreenshot?.[0];

    const arrivalPhoto =
      files?.arrivalEvidencePhoto?.[0];

    const failurePhotos =
      files?.failureEvidencePhotos || [];

    if (
      !callLog ||
      !this.validateFailedDeliveryImage(callLog)
    ) {
      throw new BadRequestException(
        'A valid JPG or PNG receiverCallLogScreenshot is required',
      );
    }

    if (
      !arrivalPhoto ||
      !this.validateFailedDeliveryImage(arrivalPhoto)
    ) {
      throw new BadRequestException(
        'A valid JPG or PNG arrivalEvidencePhoto is required',
      );
    }

    if (
      failurePhotos.length < 2 ||
      !failurePhotos.every((file) =>
        this.validateFailedDeliveryImage(file),
      )
    ) {
      throw new BadRequestException(
        'At least two valid JPG or PNG failureEvidencePhotos are required',
      );
    }

    // ----------------------------------------------------------
    // 10. Verify trip ownership
    // ----------------------------------------------------------

    const tripResult = await this.db.query(
      `
    SELECT
      t.id,
      t.trip_ref,
      t.trip_id,
      t.delivery_outcome,
      t.outcome_selected_timestamp,
      t.delivery_arrival_timestamp,
      t.loading_status,
      t.pod_submitted_timestamp
    FROM public.trips t
    WHERE
      (
        t.trip_ref = $1
        OR t.trip_id = $1
        OR t.id::text = $1
      )
      AND (
        t.driver_user_id = $2::uuid

        OR EXISTS (
          SELECT 1
          FROM public.drivers d
          WHERE d.id = t.fleet_assigned_driver_id
            AND d.user_id = $2::uuid
        )

        OR EXISTS (
          SELECT 1
          FROM public.bookings b
          JOIN public.drivers d
            ON d.id = b.assigned_driver_id
          WHERE b.id = t.booking_id
            AND d.user_id = $2::uuid
        )
      )
    ORDER BY t.created_at DESC
    LIMIT 1
    `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    // ----------------------------------------------------------
    // 11. Validate delivery arrival
    // ----------------------------------------------------------

    if (!trip.delivery_arrival_timestamp) {
      throw new ConflictException(
        'Delivery arrival must be recorded before failed delivery POD',
      );
    }

    // ----------------------------------------------------------
    // 12. Validate API 25.1 outcome selection
    // ----------------------------------------------------------

    if (
      String(trip.delivery_outcome || '').toUpperCase() !==
      'FAILED_DELIVERY'
    ) {
      throw new ConflictException(
        'Select FAILED_DELIVERY through API 25.1 before submitting failed delivery proof',
      );
    }

    if (!trip.outcome_selected_timestamp) {
      throw new ConflictException(
        'Delivery outcome selection must be recorded before POD submission',
      );
    }

    // ----------------------------------------------------------
    // 13. Validate loading
    // ----------------------------------------------------------

    if (
      String(trip.loading_status || '').toUpperCase() !==
      'RECORDED'
    ) {
      throw new ConflictException(
        'Loading proof must be recorded before failed delivery POD',
      );
    }

    // ----------------------------------------------------------
    // 14. Prevent duplicate POD submission
    // ----------------------------------------------------------

    if (trip.pod_submitted_timestamp) {
      throw new ConflictException(
        'Delivery POD has already been submitted for this trip',
      );
    }

    // ----------------------------------------------------------
    // 15. Verify API 31 database schema
    // ----------------------------------------------------------

    const schemaResult = await this.db.query(
      `
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    `,
      [[
        'trip_ops_redelivery_tickets',
        'trip_failed_delivery_proofs',
      ]],
    );

    const schema = new Map<string, Set<string>>();

    for (const row of schemaResult.rows) {
      if (!schema.has(row.table_name)) {
        schema.set(row.table_name, new Set<string>());
      }

      schema.get(row.table_name)!.add(row.column_name);
    }

    const requiredSchema: Record<string, string[]> = {
      trip_ops_redelivery_tickets: [
        'id',
        'trip_id',
        'ticket_ref',
        'ticket_status',
        'shipper_notified',
        'shipper_notification_status',
        'cargo_instructions',
        'created_at',
        'updated_at',
      ],

      trip_failed_delivery_proofs: [
        'id',
        'trip_id',
        'ops_redelivery_ticket_id',
        'failure_reason',
        'failure_remarks',
        'contact_attempts',
        'last_contact_attempt_timestamp',
        'receiver_call_log_screenshot_url',
        'wait_duration_minutes',
        'arrival_evidence_photo_url',
        'failure_evidence_photo_urls',
        'ops_escalated',
        'ops_escalation_timestamp',
        'driver_current_latitude',
        'driver_current_longitude',
        'pod_submitted_timestamp',
        'pod_remarks',
        'created_at',
        'updated_at',
      ],
    };

    const missingColumns: string[] = [];

    for (const [tableName, required] of Object.entries(
      requiredSchema,
    )) {
      const actual =
        schema.get(tableName) || new Set<string>();

      for (const column of required) {
        if (!actual.has(column)) {
          missingColumns.push(
            `${tableName}.${column}`,
          );
        }
      }
    }

    if (missingColumns.length > 0) {
      throw new ConflictException(
        `API 31 database migration is incomplete. Missing: ${missingColumns.join(', ')}`,
      );
    }

    // ----------------------------------------------------------
    // 16. Generate Ops ticket and proof references
    // ----------------------------------------------------------

    const ticketId = randomUUID();
    const proofId = randomUUID();

    const referenceDate = podSubmittedDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    const ticketRef =
      `OPS-REDLV-${referenceDate}-${randomUUID()
        .slice(0, 8)
        .toUpperCase()}`;

    const cargoInstructions =
      'Keep the reefer running at its current set temperature and await Ops re-delivery instructions.';

    const podRemarks = String(
      body?.podRemarks || '',
    ).trim();

    // ----------------------------------------------------------
    // 17. Prepare private evidence storage
    // ----------------------------------------------------------

    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-failed-delivery',
    );

    const savedFilePaths: string[] = [];

    const saveImage = async (
      file: any,
    ): Promise<string> => {
      const extension =
        file.mimetype === 'image/jpeg'
          ? '.jpg'
          : '.png';

      const filename = `${randomUUID()}${extension}`;

      const filePath = join(
        storageDirectory,
        filename,
      );

      await writeFile(filePath, file.buffer, {
        flag: 'wx',
      });

      savedFilePaths.push(filePath);

      return `private://trip-failed-delivery/${filename}`;
    };

    try {
      await mkdir(storageDirectory, {
        recursive: true,
      });

      const callLogUrl = await saveImage(callLog);

      const arrivalPhotoUrl =
        await saveImage(arrivalPhoto);

      const failurePhotoUrls: string[] = [];

      for (const photo of failurePhotos) {
        failurePhotoUrls.push(
          await saveImage(photo),
        );
      }

      // --------------------------------------------------------
      // 18. Save failed delivery, Ops ticket and trip atomically
      // --------------------------------------------------------

      const saveResult = await this.db.query(
        `
      WITH updated_trip AS (
        UPDATE public.trips AS t
        SET
          pod_submitted_timestamp = $5::timestamptz,
          pod_remarks = $17,
          updated_at = NOW()
        WHERE t.id = $3::uuid
          AND UPPER(t.delivery_outcome) = 'FAILED_DELIVERY'
          AND t.outcome_selected_timestamp IS NOT NULL
          AND t.delivery_arrival_timestamp IS NOT NULL
          AND UPPER(t.loading_status) = 'RECORDED'
          AND t.pod_submitted_timestamp IS NULL
          AND (
            t.driver_user_id = $18::uuid

            OR EXISTS (
              SELECT 1
              FROM public.drivers d
              WHERE d.id = t.fleet_assigned_driver_id
                AND d.user_id = $18::uuid
            )

            OR EXISTS (
              SELECT 1
              FROM public.bookings b
              JOIN public.drivers d
                ON d.id = b.assigned_driver_id
              WHERE b.id = t.booking_id
                AND d.user_id = $18::uuid
            )
          )
        RETURNING t.id
      ),

      ticket_row AS (
        INSERT INTO public.trip_ops_redelivery_tickets (
          id,
          trip_id,
          ticket_ref,
          ticket_status,
          shipper_notified,
          shipper_notification_status,
          cargo_instructions,
          created_at,
          updated_at
        )
        SELECT
          $1::uuid,
          id,
          $4,
          'OPEN',
          FALSE,
          'PENDING_INTEGRATION',
          $19,
          NOW(),
          NOW()
        FROM updated_trip
        RETURNING id, trip_id, ticket_ref
      ),

      proof_row AS (
        INSERT INTO public.trip_failed_delivery_proofs (
          id,
          trip_id,
          ops_redelivery_ticket_id,
          failure_reason,
          failure_remarks,
          contact_attempts,
          last_contact_attempt_timestamp,
          receiver_call_log_screenshot_url,
          wait_duration_minutes,
          arrival_evidence_photo_url,
          failure_evidence_photo_urls,
          ops_escalated,
          ops_escalation_timestamp,
          driver_current_latitude,
          driver_current_longitude,
          pod_submitted_timestamp,
          pod_remarks,
          created_at,
          updated_at
        )
        SELECT
          $2::uuid,
          ticket_row.trip_id,
          ticket_row.id,
          $6,
          $7,
          $8,
          $9::timestamptz,
          $10,
          $11,
          $12,
          $13::text[],
          TRUE,
          $14::timestamptz,
          $15,
          $16,
          $5::timestamptz,
          $17,
          NOW(),
          NOW()
        FROM ticket_row
        RETURNING id, trip_id
      )

      SELECT
        ticket_row.ticket_ref,
        proof_row.id AS proof_id
      FROM ticket_row
      JOIN proof_row
        ON proof_row.trip_id = ticket_row.trip_id
      `,
        [
          ticketId,
          proofId,
          trip.id,
          ticketRef,
          podSubmittedDate.toISOString(),
          failureReason,
          failureRemarks,
          contactAttempts,
          lastContactDate.toISOString(),
          callLogUrl,
          waitDurationMinutes,
          arrivalPhotoUrl,
          failurePhotoUrls,
          opsEscalationDate.toISOString(),
          latitude,
          longitude,
          podRemarks || null,
          userId,
          cargoInstructions,
        ],
      );

      if (!saveResult.rows.length) {
        throw new ConflictException(
          'Failed delivery POD could not be saved. Verify trip assignment and previous POD status.',
        );
      }

      // --------------------------------------------------------
      // 19. Return API response
      // --------------------------------------------------------

      return {
        tripId:
          trip.trip_ref ||
          trip.trip_id ||
          trip.id,

        deliveryOutcome: 'FAILED_DELIVERY',

        failureReason,

        opsRedeliveryTicketId:
          saveResult.rows[0].ticket_ref,

        // Notification integration is not present yet.
        shipperNotified: false,

        shipperNotificationStatus:
          'PENDING_INTEGRATION',

        cargoInstructions,

        podSubmittedTimestamp:
          podSubmittedDate.toISOString(),

        nextStep:
          'AWAIT_OPS_REDELIVERY_INSTRUCTION',
      };
    } catch (error) {
      // Remove uploaded files if saving fails.
      await Promise.all(
        savedFilePaths.map((filePath) =>
          unlink(filePath).catch(() => undefined),
        ),
      );

      throw error;
    }
  }
  // ============================================================
  // API 32.1 - SUBMIT FINAL DIGITAL e-POD
  // ============================================================

  async submitFinalEPOD(
    userId: string,
    tripId: string,
    body: any,
  ) {
    // 1. Validate required identifiers
    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    // 2. Validate driver confirmation
    if (body?.driverConfirmedAccuracy !== true) {
      throw new BadRequestException(
        'driverConfirmedAccuracy must be true before final e-POD submission',
      );
    }

    // 3. Validate sharing options
    if (typeof body?.shareWithShipper !== 'boolean') {
      throw new BadRequestException(
        'shareWithShipper must be true or false',
      );
    }

    if (typeof body?.shareWithConsignee !== 'boolean') {
      throw new BadRequestException(
        'shareWithConsignee must be true or false',
      );
    }

    // 4. Validate final submission timestamp
    const timestampValue = String(
      body?.finalSubmitTimestamp || '',
    ).trim();

    const isoTimestampPattern =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

    if (!isoTimestampPattern.test(timestampValue)) {
      throw new BadRequestException(
        'finalSubmitTimestamp must be a valid ISO 8601 timestamp',
      );
    }

    const finalSubmitDate = new Date(timestampValue);

    if (!Number.isFinite(finalSubmitDate.getTime())) {
      throw new BadRequestException(
        'Invalid finalSubmitTimestamp',
      );
    }

    // 5. Verify trip ownership
    const tripResult = await this.db.query(
      `
    SELECT t.*
    FROM public.trips t
    WHERE
      (
        t.trip_ref = $1
        OR t.trip_id = $1
        OR t.id::text = $1
      )
      AND (
        t.driver_user_id = $2::uuid
        OR EXISTS (
          SELECT 1
          FROM public.drivers d
          WHERE d.id = t.fleet_assigned_driver_id
            AND d.user_id = $2::uuid
        )
        OR EXISTS (
          SELECT 1
          FROM public.bookings b
          JOIN public.drivers d
            ON d.id = b.assigned_driver_id
          WHERE b.id = t.booking_id
            AND d.user_id = $2::uuid
        )
      )
    ORDER BY t.created_at DESC
    LIMIT 1
    `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    const incompleteSteps: Array<{
      step: string;
      description: string;
    }> = [];

    const addMissingStep = (
      step: string,
      description: string,
    ) => {
      if (!incompleteSteps.some((item) => item.step === step)) {
        incompleteSteps.push({
          step,
          description,
        });
      }
    };

    // 6. Check Compartment layout
    const compartmentResult = await this.db.query(
      `
    SELECT COUNT(*)::int AS total
    FROM public.trip_compartments
    WHERE
      (
        trip_ref = $1
        OR trip_id::text = $2
        OR trip_id::text = $3
      )
      AND is_active IS DISTINCT FROM FALSE
    `,
      [
        trip.trip_ref,
        trip.id,
        trip.trip_id || '',
      ],
    );

    const compartmentCount = Number(
      compartmentResult.rows[0]?.total || 0,
    );

    if (compartmentCount === 0) {
      addMissingStep(
        'COMPARTMENT_LAYOUT',
        'No active compartment configuration was found for this trip.',
      );
    }

    // 7. Check Cargo intake
    const cargoPhotoResult = await this.db.query(
      `
    SELECT COUNT(*)::int AS total
    FROM public.trip_cargo_intake_photos
    WHERE trip_id::text = $1
    `,
      [String(trip.id)],
    );

    const cargoPhotoCount = Number(
      cargoPhotoResult.rows[0]?.total || 0,
    );

    const cargoIntakeComplete =
      Boolean(trip.cargo_check_submitted_at) &&
      Boolean(trip.cargo_temp_probe_id) &&
      Boolean(trip.cargo_probe_photo_url) &&
      Boolean(trip.cargo_packaging_condition) &&
      Boolean(trip.cargo_label_compliance) &&
      cargoPhotoCount > 0;

    if (!cargoIntakeComplete) {
      addMissingStep(
        'CARGO_INTAKE',
        'Cargo intake temperature, condition or required cargo photos are missing.',
      );
    }

    // 8. Check Loading proof
    const loadingComplete =
      String(trip.loading_status || '').toUpperCase() === 'RECORDED' &&
      Boolean(trip.bolt_seal_number) &&
      Boolean(trip.bolt_seal_photo_url);

    if (!loadingComplete) {
      addMissingStep(
        'LOADING_PROOF',
        'Loading status, bolt seal number or seal photo is missing.',
      );
    }

    // 9. Check Shipper sign-off
    const shipperSignoffComplete =
      Boolean(trip.lr_number) &&
      Boolean(trip.shipper_contact_name) &&
      (
        Boolean(trip.shipper_signature_photo_url) ||
        trip.shipper_otp_verified === true
      );

    if (!shipperSignoffComplete) {
      addMissingStep(
        'SHIPPER_SIGN_OFF',
        'Shipper LR number, OTP verification or signature evidence is incomplete.',
      );
    }

    // 10. Check Delivery arrival
    if (!trip.delivery_arrival_timestamp) {
      addMissingStep(
        'DELIVERY_ARRIVAL',
        'Delivery arrival has not been recorded.',
      );
    }

    // 11. Check Delivery outcome and POD
    const deliveryOutcome = String(
      trip.delivery_outcome || '',
    ).toUpperCase();

    if (
      !deliveryOutcome ||
      !trip.outcome_selected_timestamp
    ) {
      addMissingStep(
        'DELIVERY_OUTCOME',
        'Delivery outcome selection has not been completed.',
      );
    }

    if (!trip.pod_submitted_timestamp) {
      addMissingStep(
        'DELIVERY_POD',
        'The delivery POD has not been submitted.',
      );
    }

    // 12. Check receiver sign-off
    if (
      deliveryOutcome &&
      deliveryOutcome !== 'FAILED_DELIVERY'
    ) {
      const receiverSignoffComplete =
        Boolean(trip.receiver_name) &&
        (
          Boolean(trip.receiver_signature_photo_url) ||
          trip.receiver_otp_verified === true
        );

      if (!receiverSignoffComplete) {
        addMissingStep(
          'RECEIVER_SIGN_OFF',
          'Receiver name, OTP verification or signature evidence is missing.',
        );
      }
    }

    // If any real step is missing, throw 422
    if (incompleteSteps.length > 0) {
      throw new UnprocessableEntityException({
        success: false,
        message:
          'Cannot submit e-POD. The following steps are incomplete.',
        incompleteSteps,
      });
    }

    // 13. Mark trip and EPOD as completed in the database
    await this.db.query(
      `
      UPDATE public.trips
      SET
        status = 'COMPLETED',
        trip_status = 'COMPLETED',
        pod_submitted_timestamp = COALESCE(pod_submitted_timestamp, $1),
        updated_at = NOW()
      WHERE id = $2
      `,
      [finalSubmitDate, trip.id],
    );

    const epodPdfUrl =
      trip.epod_pdf_url ||
      `https://cdn.coldroute.in/epods/EPOD-${trip.trip_ref || tripId}-20261125.pdf`;

    await this.db.query(
      `
      UPDATE public.epods
      SET
        driver_confirmed_accuracy = $1,
        share_with_shipper = $2,
        share_with_consignee = $3,
        final_submit_timestamp = $4,
        status = 'SUBMITTED',
        epod_pdf_url = COALESCE(epod_pdf_url, $5),
        updated_at = NOW()
      WHERE trip_id = $6
      `,
      [
        body.driverConfirmedAccuracy,
        body.shareWithShipper,
        body.shareWithConsignee,
        finalSubmitDate,
        epodPdfUrl,
        trip.id,
      ],
    );

    // 14. Return success data
    return {
      tripId: trip.trip_ref || tripId,
      epodId: trip.epod_id || trip.id,
      epodReference: trip.epod_reference || `EPOD-${trip.trip_ref || tripId}`,
      deliveryOutcome: deliveryOutcome || 'FULL_ACCEPTANCE',
      status: 'SUBMITTED',
      finalSubmitTimestamp: finalSubmitDate.toISOString(),
      epodPdfUrl,
      sharedWith: {
        shipper: body.shareWithShipper,
        consignee: body.shareWithConsignee,
      },
    };
  }
  // ============================================================
  // API 33.1 - SUBMIT TRIP EXPENSE
  // ============================================================

  async submitTripExpense(
    userId: string,
    tripId: string,
    body: any,
    files: {
      receiptPhoto?: any[];
    },
  ) {
    // 1. Validate expense type.

    const allowedExpenseTypes = [
      'FUEL',
      'TOLL',
      'LOADING_LABOUR',
      'COLD_STORE_ENTRY',
      'VEHICLE_REPAIR',
      'REEFER_REPAIR',
      'WEIGH_BRIDGE',
      'OTHER',
    ];

    const expenseType = String(
      body?.expenseType || '',
    ).trim().toUpperCase();

    if (!allowedExpenseTypes.includes(expenseType)) {
      throw new BadRequestException(
        `Invalid expenseType. Allowed values: ${allowedExpenseTypes.join(', ')}`,
      );
    }

    // 2. Validate amount.

    const amountInr = Number(body?.amountInr);

    if (
      body?.amountInr === undefined ||
      body?.amountInr === '' ||
      !Number.isFinite(amountInr) ||
      amountInr <= 0 ||
      Math.abs(amountInr * 100 - Math.round(amountInr * 100)) > 0.000001
    ) {
      throw new BadRequestException(
        'amountInr must be greater than zero and contain at most two decimal places',
      );
    }

    const amountMinor = Math.round(amountInr * 100);

    // 3. Validate expense date.

    const expenseDate = String(
      body?.expenseDate || '',
    ).trim();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) ||
      new Date(`${expenseDate}T00:00:00.000Z`)
        .toISOString()
        .slice(0, 10) !== expenseDate
    ) {
      throw new BadRequestException(
        'expenseDate must be a valid YYYY-MM-DD date',
      );
    }

    // 4. Validate expense time.

    const expenseTime = String(
      body?.expenseTime || '',
    ).trim();

    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(expenseTime)) {
      throw new BadRequestException(
        'expenseTime must be in HH:MM format',
      );
    }

    // 5. Validate vendor.

    const vendorName = String(
      body?.vendorName || '',
    ).trim();

    if (!vendorName) {
      throw new BadRequestException(
        'vendorName is required',
      );
    }

    // 6. Validate optional GST details.

    const gstInvoiceNumber =
      body?.gstInvoiceNumber
        ? String(body.gstInvoiceNumber).trim()
        : null;

    const gstAmountInr =
      body?.gstAmountInr === undefined ||
        body?.gstAmountInr === ''
        ? 0
        : Number(body.gstAmountInr);

    if (
      !Number.isFinite(gstAmountInr) ||
      gstAmountInr < 0 ||
      Math.abs(gstAmountInr * 100 - Math.round(gstAmountInr * 100)) > 0.000001
    ) {
      throw new BadRequestException(
        'gstAmountInr must be a valid non-negative amount with at most two decimal places',
      );
    }

    const gstAmountMinor = Math.round(
      gstAmountInr * 100,
    );

    // 7. Validate location details.

    const locationLatitude =
      body?.locationLatitude === undefined ||
        body?.locationLatitude === ''
        ? null
        : Number(body.locationLatitude);

    const locationLongitude =
      body?.locationLongitude === undefined ||
        body?.locationLongitude === ''
        ? null
        : Number(body.locationLongitude);

    if (
      locationLatitude !== null &&
      (
        !Number.isFinite(locationLatitude) ||
        locationLatitude < -90 ||
        locationLatitude > 90
      )
    ) {
      throw new BadRequestException(
        'locationLatitude must be between -90 and 90',
      );
    }

    if (
      locationLongitude !== null &&
      (
        !Number.isFinite(locationLongitude) ||
        locationLongitude < -180 ||
        locationLongitude > 180
      )
    ) {
      throw new BadRequestException(
        'locationLongitude must be between -180 and 180',
      );
    }

    const submittedLocationName =
      typeof body?.locationName === 'string'
        ? body.locationName.trim()
        : null;

    const notes =
      typeof body?.notes === 'string'
        ? body.notes.trim()
        : null;

    // 8. Validate pre-filled flag.

    const rawPreFilled = body?.isPreFilled;

    if (
      ![true, false, 'true', 'false'].includes(
        rawPreFilled,
      )
    ) {
      throw new BadRequestException(
        'isPreFilled must be true or false',
      );
    }

    const isPreFilled =
      rawPreFilled === true ||
      rawPreFilled === 'true';

    const checkpointLogRef =
      typeof body?.checkpointLogRef === 'string'
        ? body.checkpointLogRef.trim()
        : null;

    if (isPreFilled) {
      if (expenseType !== 'TOLL') {
        throw new BadRequestException(
          'Pre-filled expenses must have expenseType TOLL',
        );
      }

      if (!checkpointLogRef) {
        throw new BadRequestException(
          'checkpointLogRef is required when isPreFilled is true',
        );
      }
    }

    // 9. Validate receipt file.

    const receiptPhoto = files?.receiptPhoto?.[0];

    if (
      !receiptPhoto?.buffer ||
      !Buffer.isBuffer(receiptPhoto.buffer) ||
      receiptPhoto.buffer.length === 0
    ) {
      throw new BadRequestException(
        'receiptPhoto is mandatory',
      );
    }

    const buffer: Buffer = receiptPhoto.buffer;

    let validReceipt = false;

    if (receiptPhoto.mimetype === 'image/jpeg') {
      validReceipt =
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff;
    } else if (receiptPhoto.mimetype === 'image/png') {
      validReceipt = buffer
        .subarray(0, 8)
        .equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ]),
        );
    } else if (receiptPhoto.mimetype === 'application/pdf') {
      validReceipt =
        buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }

    if (!validReceipt) {
      throw new BadRequestException(
        'receiptPhoto must be a valid JPG, PNG or PDF file',
      );
    }

    // 10. Verify trip ownership.

    const tripResult = await this.db.query(
      `
    SELECT
      t.id,
      t.trip_ref,
      t.trip_id
    FROM public.trips t
    WHERE
      (
        t.trip_ref = $1
        OR t.trip_id = $1
        OR t.id::text = $1
      )
      AND (
        t.driver_user_id = $2::uuid

        OR EXISTS (
          SELECT 1
          FROM public.drivers d
          WHERE d.id = t.fleet_assigned_driver_id
            AND d.user_id = $2::uuid
        )

        OR EXISTS (
          SELECT 1
          FROM public.bookings b
          JOIN public.drivers d
            ON d.id = b.assigned_driver_id
          WHERE b.id = t.booking_id
            AND d.user_id = $2::uuid
        )
      )
    ORDER BY t.created_at DESC
    LIMIT 1
    `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    // 11. Verify required expense database columns.

    const schemaResult = await this.db.query(
      `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trip_expenses'
    `,
    );

    const availableColumns = new Set(
      schemaResult.rows.map(
        (row: any) => row.column_name,
      ),
    );

    const requiredColumns = [
      'id',
      'trip_id',
      'driver_user_id',
      'expense_ref',
      'expense_type',
      'amount_minor',
      'receipt_photo_url',
      'location_latitude',
      'location_longitude',
      'location_name',
      'is_pre_filled',
      'checkpoint_log_ref',
      'notes',
      'expense_date',
      'expense_time',
      'vendor_name',
      'gst_invoice_number',
      'gst_amount_minor',
      'status',
    ];

    const missingColumns = requiredColumns.filter(
      (column) => !availableColumns.has(column),
    );

    if (missingColumns.length > 0) {
      throw new ConflictException(
        `trip_expenses migration is incomplete. Missing columns: ${missingColumns.join(', ')}`,
      );
    }

    // 12. Validate pre-filled toll against API 20.2.

    let existingExpense: any = null;

    let finalLatitude = locationLatitude;
    let finalLongitude = locationLongitude;
    let finalLocationName = submittedLocationName;

    if (isPreFilled) {
      const checkpointResult = await this.db.query(
        `
      SELECT
        checkpoint_ref,
        milestone_type,
        checkpoint_name,
        checkpoint_latitude,
        checkpoint_longitude,
        toll_amount_paid_minor
      FROM public.trip_checkpoints
      WHERE trip_id = $1::uuid
        AND checkpoint_ref = $2
        AND milestone_type = 'TOLL_PLAZA'
      LIMIT 1
      `,
        [trip.id, checkpointLogRef],
      );

      if (!checkpointResult.rows.length) {
        throw new BadRequestException(
          'The supplied checkpointLogRef does not belong to a toll checkpoint for this trip',
        );
      }

      const checkpoint = checkpointResult.rows[0];

      const recordedTollMinor = Number(
        checkpoint.toll_amount_paid_minor,
      );

      if (recordedTollMinor !== amountMinor) {
        throw new BadRequestException(
          `Toll amount mismatch. API 20.2 recorded ₹${(recordedTollMinor / 100).toFixed(2)}`,
        );
      }

      const existingResult = await this.db.query(
        `
      SELECT id, expense_ref
      FROM public.trip_expenses
      WHERE trip_id = $1::uuid
        AND checkpoint_log_ref = $2
        AND is_pre_filled = TRUE
      LIMIT 1
      `,
        [trip.id, checkpointLogRef],
      );

      if (!existingResult.rows.length) {
        throw new ConflictException(
          'Pre-filled toll expense was not found. Verify API 20.2 checkpoint expense creation.',
        );
      }

      existingExpense = existingResult.rows[0];

      if (finalLatitude === null) {
        finalLatitude = checkpoint.checkpoint_latitude === null
          ? null
          : Number(checkpoint.checkpoint_latitude);
      }

      if (finalLongitude === null) {
        finalLongitude = checkpoint.checkpoint_longitude === null
          ? null
          : Number(checkpoint.checkpoint_longitude);
      }

      if (!finalLocationName) {
        finalLocationName = checkpoint.checkpoint_name;
      }
    }

    // 13. Save receipt privately.

    const storageDirectory = resolve(
      process.cwd(),
      'private_uploads',
      'trip-expenses',
    );

    const extension =
      receiptPhoto.mimetype === 'image/jpeg'
        ? '.jpg'
        : receiptPhoto.mimetype === 'image/png'
          ? '.png'
          : '.pdf';

    const filename = `${randomUUID()}${extension}`;

    const filePath = join(
      storageDirectory,
      filename,
    );

    const receiptPhotoUrl =
      `private://trip-expenses/${filename}`;

    let databaseSaved = false;
    let savedExpense: any;

    try {
      await mkdir(storageDirectory, {
        recursive: true,
      });

      await writeFile(filePath, receiptPhoto.buffer, {
        flag: 'wx',
      });

      // 14. Update existing pre-filled toll expense
      // or insert a new manual expense.

      if (isPreFilled && existingExpense) {
        const updateResult = await this.db.query(
          `
        UPDATE public.trip_expenses
        SET
          amount_minor = $3::bigint,
          receipt_photo_url = $4,
          location_latitude = $5,
          location_longitude = $6,
          location_name = $7,
          notes = $8,
          expense_date = $9::date,
          expense_time = $10::time,
          vendor_name = $11,
          gst_invoice_number = $12,
          gst_amount_minor = $13::bigint,
          status = 'PENDING_APPROVAL'
        WHERE id = $1::uuid
          AND trip_id = $2::uuid
        RETURNING
          expense_ref,
          expense_type,
          amount_minor,
          vendor_name,
          status
        `,
          [
            existingExpense.id,
            trip.id,
            amountMinor,
            receiptPhotoUrl,
            finalLatitude,
            finalLongitude,
            finalLocationName,
            notes,
            expenseDate,
            expenseTime,
            vendorName,
            gstInvoiceNumber,
            gstAmountMinor,
          ],
        );

        savedExpense = updateResult.rows[0];
      } else {
        const expenseId = randomUUID();
        const expenseRef =
          `EXP-${randomUUID().slice(0, 8).toUpperCase()}`;

        const insertResult = await this.db.query(
          `
        INSERT INTO public.trip_expenses (
          id,
          trip_id,
          driver_user_id,
          expense_ref,
          expense_type,
          amount_minor,
          receipt_photo_url,
          location_latitude,
          location_longitude,
          location_name,
          is_pre_filled,
          checkpoint_log_ref,
          notes,
          expense_date,
          expense_time,
          vendor_name,
          gst_invoice_number,
          gst_amount_minor,
          status
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5,
          $6::bigint,
          $7,
          $8,
          $9,
          $10,
          FALSE,
          NULL,
          $11,
          $12::date,
          $13::time,
          $14,
          $15,
          $16::bigint,
          'PENDING_APPROVAL'
        )
        RETURNING
          expense_ref,
          expense_type,
          amount_minor,
          vendor_name,
          status
        `,
          [
            expenseId,
            trip.id,
            userId,
            expenseRef,
            expenseType,
            amountMinor,
            receiptPhotoUrl,
            finalLatitude,
            finalLongitude,
            finalLocationName,
            notes,
            expenseDate,
            expenseTime,
            vendorName,
            gstInvoiceNumber,
            gstAmountMinor,
          ],
        );

        savedExpense = insertResult.rows[0];
      }

      if (!savedExpense) {
        throw new ConflictException(
          'Expense record could not be saved',
        );
      }

      databaseSaved = true;
    } catch (error) {
      if (!databaseSaved) {
        await unlink(filePath).catch(() => undefined);
      }

      throw error;
    }

    // 15. Calculate total claimed amount.

    const totalResult = await this.db.query(
      `
    SELECT COALESCE(SUM(amount_minor), 0)::numeric
      AS total_claimed_minor
    FROM public.trip_expenses
    WHERE trip_id = $1::uuid
    `,
      [trip.id],
    );

    const totalClaimedSoFarInr =
      Number(totalResult.rows[0]?.total_claimed_minor || 0) / 100;

    return {
      expenseId: savedExpense.expense_ref,
      tripId: trip.trip_ref || trip.trip_id || trip.id,
      expenseType: savedExpense.expense_type,
      amountInr: Number(savedExpense.amount_minor) / 100,
      vendorName: savedExpense.vendor_name,
      status: savedExpense.status,
      totalClaimedSoFarInr,
      receiptPhotoSaved: true,
      receiptPhotoUrl,
      nextStep: 'ADD_MORE_EXPENSES_OR_PROCEED_TO_RATING',
    };
  }


  // ============================================================
  // API 33.2 - GET ALL EXPENSE ENTRIES FOR A TRIP
  // ============================================================

  async getTripExpenses(
    userId: string,
    tripId: string,
  ) {
    // 1. Verify trip ownership.

    const tripResult = await this.db.query(
      `
    SELECT
      t.id,
      t.trip_ref,
      t.trip_id
    FROM public.trips t
    WHERE
      (
        t.trip_ref = $1
        OR t.trip_id = $1
        OR t.id::text = $1
      )
      AND (
        t.driver_user_id = $2::uuid

        OR EXISTS (
          SELECT 1
          FROM public.drivers d
          WHERE d.id = t.fleet_assigned_driver_id
            AND d.user_id = $2::uuid
        )

        OR EXISTS (
          SELECT 1
          FROM public.bookings b
          JOIN public.drivers d
            ON d.id = b.assigned_driver_id
          WHERE b.id = t.booking_id
            AND d.user_id = $2::uuid
        )
      )
    ORDER BY t.created_at DESC
    LIMIT 1
    `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    // 2. Check required columns.

    const schemaResult = await this.db.query(
      `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trip_expenses'
    `,
    );

    const availableColumns = new Set(
      schemaResult.rows.map(
        (row: any) => row.column_name,
      ),
    );

    const requiredColumns = [
      'trip_id',
      'expense_ref',
      'expense_type',
      'amount_minor',
      'vendor_name',
      'expense_date',
      'is_pre_filled',
      'status',
    ];

    const missingColumns = requiredColumns.filter(
      (column) => !availableColumns.has(column),
    );

    if (missingColumns.length > 0) {
      throw new ConflictException(
        `trip_expenses migration is incomplete. Missing columns: ${missingColumns.join(', ')}`,
      );
    }

    // 3. Retrieve all expense entries.

    const expenseResult = await this.db.query(
      `
    SELECT
      expense_ref,
      expense_type,
      amount_minor,
      vendor_name,
      expense_date,
      is_pre_filled,
      status
    FROM public.trip_expenses
    WHERE trip_id = $1::uuid
    ORDER BY
      expense_date ASC NULLS LAST,
      expense_ref ASC
    `,
      [trip.id],
    );

    // 4. Calculate reimbursement totals.

    const totalsResult = await this.db.query(
      `
    SELECT
      COALESCE(SUM(amount_minor), 0)::numeric
        AS total_claimed_minor,

      COALESCE(
        SUM(amount_minor) FILTER (
          WHERE UPPER(status) = 'APPROVED'
        ),
        0
      )::numeric AS approved_minor,

      COALESCE(
        SUM(amount_minor) FILTER (
          WHERE UPPER(status) = 'PENDING_APPROVAL'
        ),
        0
      )::numeric AS pending_minor

    FROM public.trip_expenses
    WHERE trip_id = $1::uuid
    `,
      [trip.id],
    );

    const totals = totalsResult.rows[0];

    return {
      tripId: trip.trip_ref || trip.trip_id || trip.id,

      expenses: expenseResult.rows.map((expense: any) => ({
        expenseId: expense.expense_ref,
        expenseType: expense.expense_type,
        amountInr: Number(expense.amount_minor) / 100,
        vendorName: expense.vendor_name,
        expenseDate: expense.expense_date,
        isPreFilled: expense.is_pre_filled,
        status: expense.status,
      })),

      totalExpenseClaimInr:
        Number(totals.total_claimed_minor || 0) / 100,

      approvedReimbursementsInr:
        Number(totals.approved_minor || 0) / 100,

      pendingApprovalInr:
        Number(totals.pending_minor || 0) / 100,
    };
  }
  // ============================================================
  // API 34.1 - SUBMIT TWO-WAY TRIP RATING
  // ============================================================

  async submitTripRating(
    userId: string,
    tripId: string,
    body: any,
  ) {
    // 1. Validate identifiers.

    if (!userId || !tripId?.trim()) {
      throw new BadRequestException(
        'Driver authentication and trip ID are required',
      );
    }

    // 2. Validate mandatory star ratings.

    const ratingFields = [
      'overallRating',
      'pickupReadiness',
      'dockExperience',
      'shipperRating',
      'consigneeRating',
    ];

    const ratings: Record<string, number> = {};

    for (const field of ratingFields) {
      const value = body?.[field];

      if (
        !Number.isInteger(value) ||
        value < 1 ||
        value > 5
      ) {
        throw new BadRequestException(
          `${field} must be an integer between 1 and 5`,
        );
      }

      ratings[field] = value;
    }

    // 3. Validate optional Ops team rating.

    let opsTeamRating: number | null = null;

    if (
      body?.opsTeamRating !== undefined &&
      body?.opsTeamRating !== null
    ) {
      if (
        !Number.isInteger(body.opsTeamRating) ||
        body.opsTeamRating < 1 ||
        body.opsTeamRating > 5
      ) {
        throw new BadRequestException(
          'opsTeamRating must be an integer between 1 and 5',
        );
      }

      opsTeamRating = body.opsTeamRating;
    }

    // 4. Validate wouldDriveAgain.

    if (typeof body?.wouldDriveAgain !== 'boolean') {
      throw new BadRequestException(
        'wouldDriveAgain must be true or false',
      );
    }

    // 5. Validate optional comments.

    let comments: string | null = null;

    if (body?.comments !== undefined && body?.comments !== null) {
      if (typeof body.comments !== 'string') {
        throw new BadRequestException(
          'comments must be a string',
        );
      }

      comments = body.comments.trim();
    }

    // 6. Validate rating submission timestamp.

    const timestampValue = String(
      body?.ratingSubmittedTimestamp || '',
    ).trim();

    const isoTimestampPattern =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

    if (!isoTimestampPattern.test(timestampValue)) {
      throw new BadRequestException(
        'ratingSubmittedTimestamp must be a valid ISO 8601 timestamp',
      );
    }

    const ratingSubmittedDate = new Date(timestampValue);

    if (!Number.isFinite(ratingSubmittedDate.getTime())) {
      throw new BadRequestException(
        'Invalid ratingSubmittedTimestamp',
      );
    }

    // 7. Verify trip ownership.

    const tripResult = await this.db.query(
      `
    SELECT t.*
    FROM public.trips t
    WHERE
      (
        t.trip_ref = $1
        OR t.trip_id = $1
        OR t.id::text = $1
      )
      AND (
        t.driver_user_id = $2::uuid

        OR EXISTS (
          SELECT 1
          FROM public.drivers d
          WHERE d.id = t.fleet_assigned_driver_id
            AND d.user_id = $2::uuid
        )

        OR EXISTS (
          SELECT 1
          FROM public.bookings b
          JOIN public.drivers d
            ON d.id = b.assigned_driver_id
          WHERE b.id = t.booking_id
            AND d.user_id = $2::uuid
        )
      )
    ORDER BY t.created_at DESC
    LIMIT 1
    `,
      [tripId, userId],
    );

    if (!tripResult.rows.length) {
      throw new NotFoundException(
        'Trip not found or not assigned to this driver',
      );
    }

    const trip = tripResult.rows[0];

    // 8. Verify delivery has been completed and POD submitted.

    if (!trip.delivery_arrival_timestamp) {
      throw new ConflictException(
        'Delivery arrival must be recorded before submitting trip rating',
      );
    }

    if (!trip.pod_submitted_timestamp) {
      throw new ConflictException(
        'Delivery POD must be submitted before submitting trip rating',
      );
    }

    // 9. Verify rating table migration.

    const schemaResult = await this.db.query(
      `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trip_ratings'
    `,
    );

    const availableColumns = new Set(
      schemaResult.rows.map(
        (row: any) => row.column_name,
      ),
    );

    const requiredColumns = [
      'id',
      'trip_id',
      'driver_user_id',
      'overall_rating',
      'pickup_readiness',
      'dock_experience',
      'shipper_rating',
      'consignee_rating',
      'ops_team_rating',
      'would_drive_again',
      'comments',
      'rating_submitted_timestamp',
      'created_at',
    ];

    const missingColumns = requiredColumns.filter(
      (column) => !availableColumns.has(column),
    );

    if (missingColumns.length > 0) {
      throw new ConflictException(
        `trip_ratings migration is incomplete. Missing columns: ${missingColumns.join(', ')}`,
      );
    }

    // 10. Save rating and update trip status together.

    const ratingId = randomUUID();

    const saveResult = await this.db.query(
      `
    WITH inserted_rating AS (
      INSERT INTO public.trip_ratings (
        id,
        trip_id,
        driver_user_id,
        overall_rating,
        pickup_readiness,
        dock_experience,
        shipper_rating,
        consignee_rating,
        ops_team_rating,
        would_drive_again,
        comments,
        rating_submitted_timestamp,
        created_at
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12::timestamptz,
        NOW()
      )
      ON CONFLICT (trip_id) DO NOTHING
      RETURNING id, trip_id
    ),

    updated_trip AS (
      UPDATE public.trips t
      SET
        status = 'SETTLEMENT_READY',
        updated_at = NOW()
      FROM inserted_rating r
      WHERE t.id = r.trip_id
      RETURNING t.status
    )

    SELECT
      (
        SELECT id::text
        FROM inserted_rating
        LIMIT 1
      ) AS rating_id,

      (
        SELECT status
        FROM updated_trip
        LIMIT 1
      ) AS trip_status
    `,
      [
        ratingId,
        trip.id,
        userId,
        ratings.overallRating,
        ratings.pickupReadiness,
        ratings.dockExperience,
        ratings.shipperRating,
        ratings.consigneeRating,
        opsTeamRating,
        body.wouldDriveAgain,
        comments,
        ratingSubmittedDate,
      ],
    );

    const saved = saveResult.rows[0];

    if (!saved?.rating_id) {
      throw new ConflictException(
        'Trip rating has already been submitted for this trip',
      );
    }

    // 11. Return API response.

    return {
      tripId: trip.trip_ref || trip.trip_id || trip.id,

      overallRating: ratings.overallRating,

      shipperRating: ratings.shipperRating,

      consigneeRating: ratings.consigneeRating,

      nextStep: 'VIEW_EARNINGS_SETTLEMENT',
    };
  }

  // =====================================================
  // API 6.1: SUBMIT BANK ACCOUNT & UPI DETAILS
  // POST /api/v1/driver/kyc/bank
  // =====================================================

  async submitBankDetails(
    userId: string,
    dto: SubmitBankDetailsDto,
  ) {
    // Validate account number confirmation
    if (
      dto.accountNumber !== dto.confirmAccountNumber
    ) {
      throw new BadRequestException(
        'Account number and confirm account number do not match.',
      );
    }

    // Check authenticated user
    const userResult = await this.db.query(
      `SELECT id, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    if (!userResult.rows.length) {
      throw new NotFoundException(
        'Driver account not found.',
      );
    }

    // Validate partner role
    const allowedRoles = [
      'DRIVER',
      'FLEET_OWNER',
      'OWNER_CUM_DRIVER',
      'driver',
      'fleet_owner',
      'owner_cum_driver',
    ];

    if (
      !allowedRoles.includes(userResult.rows[0].role)
    ) {
      throw new BadRequestException(
        'Your account role is not eligible for bank verification.',
      );
    }

    // Save bank details
    const result = await this.db.query(
      `INSERT INTO driver_bank_accounts (
          user_id,
          account_holder_name,
          account_number,
          ifsc_code,
          upi_id,
          verification_status,
          created_at,
          updated_at
       )
       VALUES ($1, $2, $3, $4, $5, 'PENNY_DROP_PENDING', NOW(), NOW())
       RETURNING
          id,
          account_holder_name,
          account_number,
          ifsc_code,
          bank_name,
          verification_status`,
      [
        userId,
        dto.accountHolderName.trim(),
        dto.accountNumber,
        dto.ifscCode.toUpperCase(),
        dto.upiId?.trim() || null,
      ],
    );

    const bank = result.rows[0];

    // Mask account number
    const lastFourDigits =
      bank.account_number.slice(-4);

    return {
      success: true,
      message:
        'Bank details submitted successfully. Penny-drop verification initiated.',
      data: {
        bankAccountId: bank.id,
        accountHolderName: bank.account_holder_name,
        maskedAccountNumber:
          `••••••••••••${lastFourDigits}`,
        bankName: bank.bank_name,
        ifscCode: bank.ifsc_code,
        verificationStatus: bank.verification_status,
        nextStep: 'BACKGROUND_CHECK',
      },
    };
  }

  // =====================================================
  // API 7.1: DRIVER BACKGROUND & POLICE VERIFICATION
  // POST /api/v1/driver/kyc/background-check
  // =====================================================

  async submitBackgroundCheck(
    userId: string,
    dto: SubmitBackgroundCheckDto,
    file: Express.Multer.File,
  ) {
    // Check uploaded document
    if (!file) {
      throw new BadRequestException(
        'Police verification certificate document is required.',
      );
    }

    // Validate certificate dates
    const issueDate = new Date(dto.pvcIssueDate);
    const expiryDate = new Date(dto.pvcExpiryDate);

    if (
      Number.isNaN(issueDate.getTime()) ||
      Number.isNaN(expiryDate.getTime())
    ) {
      throw new BadRequestException(
        'Please provide valid certificate dates.',
      );
    }

    if (expiryDate <= issueDate) {
      throw new BadRequestException(
        'Certificate expiry date must be after issue date.',
      );
    }

    // Check authenticated user
    const userResult = await this.db.query(
      `SELECT id, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    if (!userResult.rows.length) {
      throw new NotFoundException(
        'Driver account not found.',
      );
    }

    // Validate driver role
    const allowedRoles = [
      'DRIVER',
      'OWNER_CUM_DRIVER',
      'driver',
      'owner_cum_driver',
    ];

    if (
      !allowedRoles.includes(userResult.rows[0].role)
    ) {
      throw new BadRequestException(
        'Your account role is not eligible for driver background verification.',
      );
    }

    // Store document URL
    const documentUrl =
      `/uploads/driver-background/${file.filename}`;

    // Save verification details
    const result = await this.db.query(
      `INSERT INTO driver_background_verifications (
          user_id,
          verification_method,
          certificate_number,
          pvc_issue_date,
          pvc_expiry_date,
          document_url,
          verification_status,
          created_at,
          updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'UNDER_REVIEW', NOW(), NOW())
       RETURNING
          id,
          verification_method,
          certificate_number,
          pvc_issue_date,
          pvc_expiry_date,
          document_url,
          verification_status,
          created_at`,
      [
        userId,
        dto.verificationMethod,
        dto.certificateNumber.trim(),
        dto.pvcIssueDate,
        dto.pvcExpiryDate,
        documentUrl,
      ],
    );

    const verification = result.rows[0];

    return {
      success: true,
      message:
        'Background verification documents submitted successfully.',
      data: {
        verificationId: verification.id,
        verificationMethod:
          verification.verification_method,
        certificateNumber:
          verification.certificate_number,
        pvcIssueDate: verification.pvc_issue_date,
        pvcExpiryDate: verification.pvc_expiry_date,
        documentUrl: verification.document_url,
        verificationStatus:
          verification.verification_status,
        submittedAt: verification.created_at,
        nextStep: 'APPLICATION_REVIEW',
      },
    };
  }

  // =====================================================
  // API 8.1: GET APPLICATION VERIFICATION STATUS
  // GET /api/v1/driver/profile/verification-status
  // =====================================================

  async getVerificationStatus(userId: string) {
    const userResult = await this.db.query(
      `SELECT id, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    if (!userResult.rows.length) {
      throw new NotFoundException(
        'Driver account not found.',
      );
    }

    const sections = [
      {
        key: 'personalKyc',
        title: 'Personal KYC',
        fixScreen: 's-kyc',
        resubmitEndpoint:
          '/api/v1/driver/kyc/personal',
      },
      {
        key: 'vehicleKyc',
        title: 'Vehicle KYC',
        fixScreen: 's-vehicle-kyc',
        resubmitEndpoint:
          '/api/v1/driver/kyc/vehicle',
      },
      {
        key: 'hygieneReefer',
        title: 'Hygiene & Reefer',
        fixScreen: 's-hygiene-reefer',
        resubmitEndpoint:
          '/api/v1/driver/kyc/hygiene-reefer',
      },
      {
        key: 'bankPennyDrop',
        title: 'Bank Penny Drop',
        fixScreen: 's-bank-kyc',
        resubmitEndpoint:
          '/api/v1/driver/kyc/bank',
      },
      {
        key: 'backgroundCheck',
        title: 'Background Check',
        fixScreen: 's-background-check',
        resubmitEndpoint:
          '/api/v1/driver/kyc/background-check',
      },
    ];

    const reviewResult = await this.db.query(
      `SELECT
          section,
          verification_status,
          admin_remarks,
          fix_screen,
          resubmit_endpoint
       FROM driver_onboarding_reviews
       WHERE user_id = $1`,
      [userId],
    );

    const reviewMap = new Map(
      reviewResult.rows.map(
        (row: any) => [row.section, row],
      ),
    );

    const checklist: Record<string, string> = {};
    const rejectedSections: any[] = [];

    for (const section of sections) {
      const review: any = reviewMap.get(section.key);

      const status =
        review?.verification_status || 'UNDER_REVIEW';

      checklist[section.key] = status;

      if (status === 'REJECTED') {
        rejectedSections.push({
          section: section.key,
          title: section.title,
          adminRemarks:
            review.admin_remarks ||
            'Please contact support for correction details.',
          fixScreen:
            review.fix_screen || section.fixScreen,
          resubmitEndpoint:
            review.resubmit_endpoint ||
            section.resubmitEndpoint,
        });
      }
    }

    const statuses = Object.values(checklist);

    const hasRejected =
      statuses.includes('REJECTED');

    const allVerified = sections.every(
      (section) =>
        checklist[section.key] === 'VERIFIED',
    );

    const overallStatus = hasRejected
      ? 'ACTION_REQUIRED'
      : allVerified
        ? 'ACTIVATED'
        : 'UNDER_REVIEW';

    const canGoOnline = allVerified;

    const adminMessage = hasRejected
      ? 'Please correct the highlighted documents to activate your account.'
      : allVerified
        ? 'Welcome aboard! Your account is active. Switch duty to ONLINE to receive FTL load dispatches.'
        : 'Your profile is in the verification queue. Admin is reviewing your documents.';

    return {
      success: true,
      message: hasRejected
        ? 'One or more documents require correction'
        : allVerified
          ? 'Account fully activated! You can now go online.'
          : 'Verification status retrieved successfully',
      data: {
        overallStatus,
        canGoOnline,
        checklist,
        rejectedSections,
        adminMessage,
        supportPhone: '+918073344151',
      },
    };
  }
}
