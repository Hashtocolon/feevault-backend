
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class DriverProfileService {
  constructor(private readonly db: DatabaseService) {}

  private getUserId(user: any): string {
    const id = user?.id || user?.userId || user?.sub;

    if (!id) {
      throw new UnauthorizedException('User ID not found in token');
    }

    return String(id);
  }

  private getRole(user: any): string {
    return String(
      user?.role || user?.userRole || user?.accountType || '',
    ).toUpperCase();
  }

  private checkAllowedRole(user: any): string {
    const role = this.getRole(user);

    if (!['DRIVER', 'FLEET_OWNER', 'OWNER_CUM_DRIVER'].includes(role)) {
      throw new ForbiddenException(
        'Only drivers and fleet owners can access this API',
      );
    }

    return role;
  }

  private async ensureSettings(userId: string) {
    await this.db.query(
      `INSERT INTO driver_account_settings (driver_user_id)
       VALUES ($1)
       ON CONFLICT (driver_user_id) DO NOTHING`,
      [userId],
    );
  }

  private getLanguageLabel(language: string): string {
    const labels: Record<string, string> = {
      en: 'English',
      hi: 'Hindi',
      kn: 'Kannada',
      ta: 'Tamil',
      te: 'Telugu',
      mr: 'Marathi',
    };

    return labels[language] || 'English';
  }

  // --------------------------------------------------
  // API 40.1
  // GET /api/v1/driver/profile
  // --------------------------------------------------

  async getProfile(user: any) {
    const userId = this.getUserId(user);
    const role = this.checkAllowedRole(user);

    await this.ensureSettings(userId);

    const profileResult = await this.db.query(
      `SELECT *
       FROM driver_profiles
       WHERE user_id::text = $1
       LIMIT 1`,
      [userId],
    );

    const settingsResult = await this.db.query(
      `SELECT *
       FROM driver_account_settings
       WHERE driver_user_id = $1
       LIMIT 1`,
      [userId],
    );

    const settings = settingsResult.rows[0];

    if (!settings) {
      throw new NotFoundException('Account settings not found');
    }

    const driver = profileResult.rows[0] || null;

    let fleet: any = null;

    if (driver?.fleet_owner_user_id) {
      const fleetResult = await this.db.query(
        `SELECT
            fp.fleet_name,
            fp.fleet_code,
            fp.owner_user_id,
            u.full_name AS fleet_owner_name,
            u.phone AS fleet_owner_phone
         FROM fleet_profiles fp
         LEFT JOIN users u
           ON u.id::text = fp.owner_user_id::text
         WHERE fp.owner_user_id::text = $1
         LIMIT 1`,
        [String(driver.fleet_owner_user_id)],
      );

      if (fleetResult.rows.length) {
        const fleetRow = fleetResult.rows[0];

        fleet = {
          fleetId: String(fleetRow.owner_user_id),
          fleetName: fleetRow.fleet_name,
          fleetCode: fleetRow.fleet_code,
          fleetOwnerName: fleetRow.fleet_owner_name,
          fleetOwnerPhone: fleetRow.fleet_owner_phone,
        };
      }
    }

    // Read compliance documents where available.
    const complianceResult = await this.db.query(
      `SELECT document_code, certificate_number,
              expiry_date, verification_status
       FROM driver_compliance_documents
       WHERE driver_user_id = $1
       ORDER BY updated_at DESC`,
      [userId],
    );

    const compliance: Record<string, any> = {};

    for (const doc of complianceResult.rows) {
      if (!compliance[doc.document_code]) {
        compliance[doc.document_code] = doc;
      }
    }

    const isVerified = (code: string) =>
      compliance[code]?.verification_status === 'VERIFIED';

    const maskValue = (value: string | null, visible = 4) => {
      if (!value) return null;
      const clean = String(value);
      return '•'.repeat(Math.max(0, clean.length - visible)) +
        clean.slice(-visible);
    };

    const language = settings.preferred_language || 'en';

    return {
      success: true,
      data: {
        profile: {
          driverId: driver?.id ? String(driver.id) : userId,
          fullName: driver?.full_name || user?.fullName || null,
          mobileNumber: driver?.mobile_number || user?.phone || null,
          avatarUrl: driver?.avatar_url || null,
          partnerRole: role,
          partnerRoleLabel:
            role === 'FLEET_OWNER'
              ? 'Fleet Owner'
              : role === 'OWNER_CUM_DRIVER'
                ? 'Owner Cum Driver'
                : 'Employed Fleet Driver',
          preferredLanguage: language,
          preferredLanguageLabel: this.getLanguageLabel(language),
          memberSince: driver?.created_at
            ? new Date(driver.created_at).toISOString().slice(0, 10)
            : null,
        },

        emergencyContact: {
          contactName: settings.emergency_contact_name,
          relationship: settings.emergency_contact_relationship,
          contactPhone: settings.emergency_contact_phone,
        },

        linkedFleet: fleet,

        kycVerificationBadges: {
          panVerified: isVerified('PAN'),
          panMasked: null,
          aadhaarVerified: isVerified('AADHAAR'),
          aadhaarMasked: null,
          dlVerified: isVerified('DRIVING_LICENSE'),
          dlExpiryDate:
            compliance['DRIVING_LICENSE']?.expiry_date || null,
          bankAccountVerified: false,
          bankName: null,
          overallStatus: driver?.kyc_status || 'PENDING',
        },

        drivingStatistics: {
          totalTripsCompleted: 0,
          totalDistanceDrivenKm: 0,
          overallRating:
            driver?.rating == null ? null : Number(driver.rating),
          tempCompliancePercent: null,
          badge: null,
        },

        dpdpConsents: {
          locationWhileOnline: settings.location_while_online,
          backgroundLocationDuringTrip:
            settings.background_location_during_trip,
          pushNotifications: settings.push_notifications,
          whatsappUpdates: settings.whatsapp_updates,
          lastUpdatedTimestamp: settings.last_updated_at,
        },

        support: {
          opsDeskPhone: process.env.ZOOP_OPS_DESK_PHONE || null,
          emergencyHighwaySosPhone:
            process.env.ZOOP_HIGHWAY_SOS_PHONE || null,
          supportEmail:
            process.env.ZOOP_SUPPORT_EMAIL || null,
        },
      },
    };
  }

  // --------------------------------------------------
  // API 40.2
  // PATCH /api/v1/driver/profile/consent
  // --------------------------------------------------

  async updateConsent(user: any, dto: UpdateConsentDto) {
    const userId = this.getUserId(user);
    this.checkAllowedRole(user);

    if (
      dto.locationWhileOnline !== true ||
      dto.backgroundLocationDuringTrip !== true ||
      dto.pushNotifications !== true
    ) {
      throw new BadRequestException(
        'Location tracking and push notifications are mandatory and cannot be disabled',
      );
    }

    await this.ensureSettings(userId);

    const client = await this.db.getPool().connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE driver_account_settings
         SET
           location_while_online = $1,
           background_location_during_trip = $2,
           push_notifications = $3,
           whatsapp_updates = $4,
           last_updated_at = NOW()
         WHERE driver_user_id = $5
         RETURNING
           location_while_online,
           background_location_during_trip,
           push_notifications,
           whatsapp_updates,
           last_updated_at`,
        [
          dto.locationWhileOnline,
          dto.backgroundLocationDuringTrip,
          dto.pushNotifications,
          dto.whatsappUpdates,
          userId,
        ],
      );

      // If mandatory consent is missing, switch duty offline.
      // This branch is defensive; the validation above rejects false.
      if (
        !dto.locationWhileOnline ||
        !dto.backgroundLocationDuringTrip
      ) {
        await client.query(
          `UPDATE driver_profiles
           SET is_online = FALSE
           WHERE user_id::text = $1`,
          [userId],
        );
      }

      await client.query('COMMIT');

      const consent = result.rows[0];

      return {
        success: true,
        message: 'DPDP privacy consents updated successfully.',
        data: {
          dpdpConsents: {
            locationWhileOnline: consent.location_while_online,
            backgroundLocationDuringTrip:
              consent.background_location_during_trip,
            pushNotifications: consent.push_notifications,
            whatsappUpdates: consent.whatsapp_updates,
            lastUpdatedTimestamp: consent.last_updated_at,
          },
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------
  // API 40.3
  // PATCH /api/v1/driver/profile/preferences
  // --------------------------------------------------

  async updatePreferences(
    user: any,
    dto: UpdatePreferencesDto,
  ) {
    const userId = this.getUserId(user);
    this.checkAllowedRole(user);

    if (
      dto.preferredLanguage === undefined &&
      dto.emergencyContactName === undefined &&
      dto.emergencyContactRelationship === undefined &&
      dto.emergencyContactPhone === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one preference or emergency contact field',
      );
    }

    if (
      dto.emergencyContactPhone !== undefined &&
      !/^\+91[6-9]\d{9}$/.test(dto.emergencyContactPhone)
    ) {
      throw new BadRequestException(
        'Enter a valid Indian phone number with +91',
      );
    }

    await this.ensureSettings(userId);

    const result = await this.db.query(
      `UPDATE driver_account_settings
       SET
         preferred_language = COALESCE($1, preferred_language),
         emergency_contact_name =
           COALESCE($2, emergency_contact_name),
         emergency_contact_relationship =
           COALESCE($3, emergency_contact_relationship),
         emergency_contact_phone =
           COALESCE($4, emergency_contact_phone),
         last_updated_at = NOW()
       WHERE driver_user_id = $5
       RETURNING
         preferred_language,
         emergency_contact_name,
         emergency_contact_relationship,
         emergency_contact_phone`,
      [
        dto.preferredLanguage ?? null,
        dto.emergencyContactName ?? null,
        dto.emergencyContactRelationship ?? null,
        dto.emergencyContactPhone ?? null,
        userId,
      ],
    );

    const settings = result.rows[0];

    return {
      success: true,
      message:
        'Driver preferences and emergency contact updated successfully.',
      data: {
        preferredLanguage: settings.preferred_language,
        emergencyContact: {
          contactName: settings.emergency_contact_name,
          relationship: settings.emergency_contact_relationship,
          contactPhone: settings.emergency_contact_phone,
        },
      },
    };
  }
}
