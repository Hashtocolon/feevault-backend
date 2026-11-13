import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ProfileService {
  constructor(private readonly db: DatabaseService) {}

  async getMyProfile(userId: string) {
    const result = await this.db.query(
      `SELECT u.id, u.mobile_number, u.role, u.is_active,
              cp.company_name, cp.contact_person, cp.email, cp.gstin,
              cp.billing_address, cp.is_verified, cp.created_at
       FROM users u
       LEFT JOIN customer_profiles cp ON cp.customer_id = u.id
       WHERE u.id = $1`,
      [userId],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Profile not found');
    }

    return { profile: result.rows[0] };
  }

  async verifyGstin(gstin: string, userId: string) {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const isValid = gstinRegex.test(gstin?.toUpperCase());

    if (isValid) {
      await this.db.query(
        `UPDATE customer_profiles
         SET gstin = $1, is_verified = true, updated_at = NOW()
         WHERE customer_id = $2`,
        [gstin.toUpperCase(), userId],
      );
    }

    return {
      gstin: gstin ? gstin.toUpperCase() : null,
      isValid,
      message: isValid ? 'GSTIN verified successfully' : 'Invalid GSTIN format',
    };
  }

  async saveCustomerProfile(body: any, userId: string) {
    const { fullName, email, gstin, companyName, address } = body;

    const result = await this.db.query(
      `INSERT INTO customer_profiles (customer_id, contact_person, email, gstin, company_name, billing_address, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (customer_id) DO UPDATE
       SET contact_person = COALESCE(EXCLUDED.contact_person, customer_profiles.contact_person),
           email = COALESCE(EXCLUDED.email, customer_profiles.email),
           gstin = COALESCE(EXCLUDED.gstin, customer_profiles.gstin),
           company_name = COALESCE(EXCLUDED.company_name, customer_profiles.company_name),
           billing_address = COALESCE(EXCLUDED.billing_address, customer_profiles.billing_address),
           updated_at = NOW()
       RETURNING *`,
      [userId, fullName || null, email || null, gstin || null, companyName || null, address || null],
    );

    return {
      success: true,
      profile: result.rows[0],
      message: 'Profile updated successfully',
    };
  }
}

