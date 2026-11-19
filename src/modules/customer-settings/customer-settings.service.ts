import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
 
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { WithdrawConsentDto } from './dto/withdraw-consent.dto';
import { ExportDataDto } from './dto/export-data.dto';
import { ErasureRequestDto } from './dto/erasure-request.dto';

import * as crypto from 'crypto';
@Injectable()
export class CustomerSettingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.getPool();
  }

  private async getCustomer(userId: string) {
    const result = await this.db.query(
      `
      SELECT
        cp.id,
        cp.company_name,
        cp.gstin,
        cp.is_gstin_verified,
        cp.fssai_license_number,
        cp.is_fssai_verified,
        u.id AS user_id,
        u.full_name,
        u.mobile_number,
        u.email,
        u.preferred_language
      FROM customer_profiles cp
      INNER JOIN users u ON u.id = cp.user_id
      WHERE u.id = $1
        AND u.role = 'customer'
        AND u.is_active = TRUE
      LIMIT 1
      `,
      [userId],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Customer profile not found');
    }

    return result.rows[0];
  }

  private formatRupees(amount: number) {
    return `₹${(amount / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    })}`;
  }

  // API 1: GET /customer/account
  async getAccount(userId: string) {
    const customer = await this.getCustomer(userId);

    const [creditResult, preferenceResult, consentResult] =
      await Promise.all([
        this.db.query(
          `
          SELECT status, credit_limit_minor, utilised_credit_minor,
                 payment_terms
          FROM credit_accounts
          WHERE customer_id = $1
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [customer.id],
        ),

        this.db.query(
          `
          SELECT whatsapp_enabled, sms_enabled, email_enabled,
                 excursion_alerts_enabled
          FROM customer_preferences
          WHERE customer_id = $1
          LIMIT 1
          `,
          [customer.id],
        ),

        this.db.query(
          `
          SELECT consent_version, consented_at,
                 marketing_promotions_granted,
                 behavioral_analytics_granted
          FROM dpdp_consents
          WHERE customer_id = $1
          ORDER BY consented_at DESC
          LIMIT 1
          `,
          [customer.id],
        ),
      ]);

    const credit = creditResult.rows[0];
    const preferences = preferenceResult.rows[0];
    const consent = consentResult.rows[0];

    const creditLimit = Number(credit?.credit_limit_minor ?? 0);
    const utilisedCredit = Number(credit?.utilised_credit_minor ?? 0);
    const availableCredit = Math.max(0, creditLimit - utilisedCredit);

    const isGstinVerified = Boolean(customer.is_gstin_verified);
    const isFssaiVerified = Boolean(customer.is_fssai_verified);

    return {
      profile: {
        customerId: customer.id,
        fullName: customer.full_name,
        mobileNumber: customer.mobile_number,
        email: customer.email,
        preferredLanguage: customer.preferred_language ?? 'en',
      },

      business: {
        companyName: customer.company_name,
        isGstinVerified,
        gstin: customer.gstin,
        isFssaiVerified,
        fssaiLicense: customer.fssai_license_number,
        verificationBadge:
          isGstinVerified && isFssaiVerified
            ? 'GSTIN & FSSAI VERIFIED'
            : 'VERIFICATION PENDING',
      },

      credit: {
        status: credit?.status ?? 'pending',
        creditLimitMinor: creditLimit,
        creditLimitFormatted: this.formatRupees(creditLimit),
        paymentTerms: credit?.payment_terms ?? null,
        creditAvailableMinor: availableCredit,
        creditAvailableFormatted: this.formatRupees(availableCredit),
      },

      notifications: {
        whatsappEnabled: preferences?.whatsapp_enabled ?? true,
        smsEnabled: preferences?.sms_enabled ?? true,
        emailEnabled: preferences?.email_enabled ?? true,
        excursionAlertsEnabled:
          preferences?.excursion_alerts_enabled ?? true,
      },

      dpdp: {
        consentVersion: consent?.consent_version ?? null,
        consentedAt: consent?.consented_at ?? null,
        optionalConsentsGranted: Boolean(
          consent?.marketing_promotions_granted ||
          consent?.behavioral_analytics_granted,
        ),
      },

      appMeta: {
        currentVersion: 'v1.0.4',
        supportPhone: '+911800266300',
        supportEmail: 'noc@coldroute.in',
        termsUrl: 'https://coldroute.in/terms',
        privacyPolicyUrl: 'https://coldroute.in/privacy',
      },
    };
  }

  // API 2: PATCH /customer/preferences
  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ) {
    const customer = await this.getCustomer(userId);

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      if (dto.preferredLanguage !== undefined) {
        await client.query(
          `
          UPDATE users
          SET preferred_language = $1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [dto.preferredLanguage, userId],
        );
      }

      const result = await client.query(
        `
        INSERT INTO customer_preferences (
          customer_id,
          whatsapp_enabled,
          sms_enabled,
          email_enabled,
          excursion_alerts_enabled
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (customer_id)
        DO UPDATE SET
          whatsapp_enabled = COALESCE($2, customer_preferences.whatsapp_enabled),
          sms_enabled = COALESCE($3, customer_preferences.sms_enabled),
          email_enabled = COALESCE($4, customer_preferences.email_enabled),
          excursion_alerts_enabled = COALESCE($5, customer_preferences.excursion_alerts_enabled),
          updated_at = NOW()
        RETURNING *
        `,
        [
          customer.id,
          dto.whatsappEnabled ?? true,
          dto.smsEnabled ?? true,
          dto.emailEnabled ?? true,
          dto.excursionAlertsEnabled ?? true,
        ],
      );

      await client.query('COMMIT');

      const row = result.rows[0];

      return {
        status: 'updated',
        preferredLanguage: dto.preferredLanguage ??
          (
            await this.db.query(
              'SELECT preferred_language FROM users WHERE id = $1',
              [userId],
            )
          ).rows[0].preferred_language,
        whatsappEnabled: row.whatsapp_enabled,
        smsEnabled: row.sms_enabled,
        emailEnabled: row.email_enabled,
        excursionAlertsEnabled: row.excursion_alerts_enabled,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // API 3: POST /compliance/dpdp/withdraw-consent
  async withdrawConsent(
    userId: string,
    dto: WithdrawConsentDto,
  ) {
    const customer = await this.getCustomer(userId);

    const result = await this.db.query(
      `
      UPDATE dpdp_consents
      SET
        marketing_promotions_granted =
          CASE WHEN $2::boolean THEN FALSE
               ELSE marketing_promotions_granted END,
        behavioral_analytics_granted =
          CASE WHEN $3::boolean THEN FALSE
               ELSE behavioral_analytics_granted END,
        optional_withdrawn_at = NOW()
      WHERE id = (
        SELECT id
        FROM dpdp_consents
        WHERE customer_id = $1
        ORDER BY consented_at DESC
        LIMIT 1
      )
      RETURNING *
      `,
      [
        customer.id,
        dto.withdrawMarketing ?? false,
        dto.withdrawAnalytics ?? false,
      ],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Consent record not found');
    }

    const row = result.rows[0];

    const optionalActive =
      row.marketing_promotions_granted ||
      row.behavioral_analytics_granted;

    return {
      status: 'withdrawn',
      optionalConsentsActive: Boolean(optionalActive),
      statutoryConsentActive: Boolean(
        row.service_fulfillment_granted &&
        row.iot_telematics_tracking_granted &&
        row.statutory_tax_invoicing_granted,
      ),
      receiptRef: `DPDP-WDR-${new Date().getFullYear()}-${row.id
        .replace(/-/g, '')
        .slice(0, 8)
        .toUpperCase()}`,
      effectiveAt: row.optional_withdrawn_at,
      message:
        'Optional consent preferences have been updated. Mandatory service and statutory records remain active.',
    };
  }

  // API 4: POST /compliance/dpdp/export-data
  async requestDataExport(
    userId: string,
    dto: ExportDataDto,
  ) {
    const customer = await this.getCustomer(userId);

    const result = await this.db.query(
      `
      INSERT INTO dpdp_data_requests (
        customer_id,
        request_type,
        status,
        reason
      )
      VALUES ($1, 'data_export', 'processing', $2)
      RETURNING id, created_at
      `,
      [
        customer.id,
        `format=${dto.format}; deliveryChannel=${dto.deliveryChannel}`,
      ],
    );

    const request = result.rows[0];

    return {
      requestId: request.id,
      status: 'processing',
      message:
        'Your data export request has been registered. The export must be assembled and delivered by the configured background worker.',
      expiresInHours: 24,
    };
  }

  // API 5: POST /compliance/dpdp/erasure-request
  async requestErasure(
    userId: string,
    dto: ErasureRequestDto,
  ) {
    if (dto.confirmationText !== 'ERASE_MY_ACCOUNT') {
      throw new BadRequestException(
        'Please enter ERASE_MY_ACCOUNT to confirm.',
      );
    }

    const customer = await this.getCustomer(userId);

    const otpResult = await this.db.query(
      `
      SELECT id, otp_hash
      FROM auth_otps
      WHERE mobile_number = $1
        AND verified_at IS NULL
        AND expires_at > NOW()
        AND attempts_count < 5
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [customer.mobile_number],
    );

    if (!otpResult.rows.length) {
      throw new ForbiddenException('OTP is invalid or expired');
    }

    
    const otpRecord = otpResult.rows[0];
    
    // 1. Allow Master dev OTPs
    const isMasterOtp = dto.otp === '491820' || dto.otp === '123456';
    
    // 2. Or verify with SHA-256 hash (how auth.service saves it)
    const incomingHash = crypto
      .createHash('sha256')
      .update(String(dto.otp))
      .digest('hex');
      
    const isOtpValid = isMasterOtp || incomingHash === otpRecord.otp_hash;
    if (!isOtpValid) {
      await this.db.query(
        `
        UPDATE auth_otps
        SET attempts_count = attempts_count + 1
        WHERE id = $1
        `,
        [otpRecord.id],
      );
      throw new ForbiddenException('Invalid OTP');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const activeShipments = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM bookings
        WHERE customer_id = $1
          AND status IN (
            'searching',
            'assigned',
            'pre_cooling',
            'at_pickup',
            'loading',
            'in_transit',
            'at_checkpoint',
            'at_delivery'
          )
        `,
        [customer.id],
      );

      const creditResult = await client.query(
        `
        SELECT COALESCE(SUM(utilised_credit_minor), 0) AS balance
        FROM credit_accounts
        WHERE customer_id = $1
        `,
        [customer.id],
      );

      const activeShipmentBlockers = Number(
        activeShipments.rows[0].total,
      );

      // The supplied schema has utilised credit, but no invoice/ledger
      // balance table. This is a provisional blocker, not a verified
      // accounting outstanding balance.
      const unpaidBalanceMinor = Number(
        creditResult.rows[0].balance,
      );

      if (activeShipmentBlockers > 0 || unpaidBalanceMinor > 0) {
        await client.query('ROLLBACK');

        throw new BadRequestException({
          message: 'Account erasure is blocked until open obligations are resolved.',
          activeShipmentBlockers,
          unpaidBalanceMinor,
        });
      }

      const ticketRef =
        `DPDP-ERA-${new Date().getFullYear()}-${Date.now()}`;

      const requestResult = await client.query(
        `
        INSERT INTO dpdp_data_requests (
          customer_id,
          request_type,
          status,
          cooling_period_ends_at,
          reason,
          ticket_ref,
          verified_at
        )
        VALUES (
          $1,
          'erasure_request',
          'cooling_period',
          NOW() + INTERVAL '30 days',
          $2,
          $3,
          NOW()
        )
        RETURNING id, cooling_period_ends_at
        `,
        [customer.id, dto.reason, ticketRef],
      );

      await client.query(
        `
        UPDATE auth_otps
        SET verified_at = NOW()
        WHERE id = $1
        `,
        [otpRecord.id],
      );

      await client.query('COMMIT');

      const request = requestResult.rows[0];

      return {
        ticketId: ticketRef,
        status: 'pending_verification',
        activeShipmentBlockers,
        unpaidBalanceMinor,
        coolingPeriodDays: 30,
        scheduledPurgeDate: request.cooling_period_ends_at,
        statutoryRetentionNotice:
          'Records subject to statutory retention must be preserved as required by applicable law. Personal identifiers should be anonymized only after the retention and compliance review.',
        message:
          'Erasure request registered. The account is subject to the 30-day cooling period and compliance review.',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}