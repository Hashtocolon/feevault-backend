
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import { SubmitBankDetailsDto } from './dto/submit-bank-details.dto';
import { SubmitBackgroundCheckDto } from './dto/submit-background-check.dto';

@Injectable()
export class DriverService {
  constructor(
    private readonly db: DatabaseService,
  ) {}

  // =====================================================
  // API 9.1: DRIVER DASHBOARD
  // GET /api/v1/driver/dashboard
  // =====================================================

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
      [userId],
    );

    return {
      isDispatchLocked: false,
      documentsCount: docs.rows.length,
      documents: docs.rows,
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
