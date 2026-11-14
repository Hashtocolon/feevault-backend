import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ProfileService {
  constructor(private readonly db: DatabaseService) {}

  async getMyProfile(userId: string) {
    if (!userId) {
      throw new NotFoundException('Invalid user token or user id missing');
    }

    const result = await this.db.query(
      `SELECT u.id, u.mobile_number, u.role, u.is_active,
              cp.company_name, cp.trade_name, cp.display_name,
              cp.billing_email AS email,
              cp.billing_phone AS phone,
              cp.gstin, cp.pan,
              cp.address_line1, cp.address_line2, cp.city, cp.state, cp.pincode,
              cp.is_profile_complete, cp.created_at
       FROM users u
       LEFT JOIN customer_profiles cp ON cp.user_id = u.id
       WHERE u.id::text = $1`,
      [userId],
    );

    if (!result.rows.length) {
      throw new NotFoundException(`User profile with ID ${userId} not found`);
    }

    return { profile: result.rows[0] };
  }

  async verifyGstin(gstin: string, userId: string) {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const isValid = gstinRegex.test(gstin?.toUpperCase());

    if (isValid && userId) {
      await this.db.query(
        `UPDATE customer_profiles
         SET gstin = $1, updated_at = NOW()
         WHERE user_id::text = $2`,
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
      `INSERT INTO customer_profiles (user_id, display_name, billing_email, gstin, company_name, address_line1, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET display_name = COALESCE(EXCLUDED.display_name, customer_profiles.display_name),
           billing_email = COALESCE(EXCLUDED.billing_email, customer_profiles.billing_email),
           gstin = COALESCE(EXCLUDED.gstin, customer_profiles.gstin),
           company_name = COALESCE(EXCLUDED.company_name, customer_profiles.company_name),
           address_line1 = COALESCE(EXCLUDED.address_line1, customer_profiles.address_line1),
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
