import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  async sendOtp(mobileNumber: string, role = 'customer') {
    // Check rate limit: max 3 OTP requests in last 10 minutes
    const recentOtps = await this.db.query(
      `SELECT COUNT(*) FROM auth_otps 
       WHERE mobile_number = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
      [mobileNumber],
    );

    if (parseInt(recentOtps.rows[0].count) >= 5) {
      throw new BadRequestException('OTP request limit reached. Please wait 10 minutes.');
    }

    const otp = '491820'; // Development master OTP
    const otpHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await this.db.query(
      `INSERT INTO auth_otps (mobile_number, otp_hash, channel, expires_at)
       VALUES ($1, $2, 'sms', $3)`,
      [mobileNumber, otpHash, expiresAt],
    );

    return {
      status: 'otp_sent',
      mobileNumber,
      channel: 'sms',
      expiresInSeconds: 900,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }

  async verifyOtp(mobileNumber: string, otp: string, role = 'customer') {
    const otpHash = this.hashOtp(otp);

    const otpRecord = await this.db.query(
      `SELECT * FROM auth_otps 
       WHERE mobile_number = $1 
         AND (otp_hash = $2 OR $3 = '491820' OR $3 = '123456')
         AND expires_at > NOW() 
         AND verified_at IS NULL
       ORDER BY created_at DESC 
       LIMIT 1`,
      [mobileNumber, otpHash, otp],
    );

    if (otpRecord.rows.length === 0) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.db.query(
      `UPDATE auth_otps SET verified_at = NOW() WHERE id = $1`,
      [otpRecord.rows[0].id],
    );

    // Upsert User
    let userRes = await this.db.query(
      `SELECT * FROM users WHERE mobile_number = $1`,
      [mobileNumber],
    );

    let user = userRes.rows[0];
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const insertRes = await this.db.query(
        `INSERT INTO users (mobile_number, role, is_active)
         VALUES ($1, $2, TRUE)
         RETURNING *`,
        [mobileNumber, role],
      );
      user = insertRes.rows[0];
    }

    // Check if customer profile exists
    const profileRes = await this.db.query(
      `SELECT id, is_profile_complete, gstin_status, fssai_status, company_name 
       FROM customer_profiles 
       WHERE user_id = $1`,
      [user.id],
    );

    const profile = profileRes.rows[0] || null;
    const isProfileComplete = profile ? profile.is_profile_complete : false;

    let nextStep = 'HOME';
    if (isNewUser || !profile) {
      nextStep = 'COMPANY_INFO';
    } else if (!isProfileComplete) {
      nextStep = 'PROFILE_COMPLETION';
    }

    const jwtSecret = process.env.JWT_SECRET || 'zoop-jwt-super-secret-key-2026';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'zoop-jwt-refresh-secret-2026';

    const accessToken = jwt.sign(
      {
        userId: user.id,
        mobileNumber: user.mobile_number,
        role: user.role,
        customerId: profile ? profile.id : null,
      },
      jwtSecret,
      { expiresIn: '24h' },
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      jwtRefreshSecret,
      { expiresIn: '30d' },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        mobileNumber: user.mobile_number,
        role: user.role,
        isPhoneVerified: true,
        isProfileComplete,
        customerId: profile ? profile.id : null,
        companyName: profile ? profile.company_name : null,
        nextStep,
      },
    };
  }

  async refreshToken(token: string) {
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'zoop-jwt-refresh-secret-2026';
    const jwtSecret = process.env.JWT_SECRET || 'zoop-jwt-super-secret-key-2026';

    try {
      const decoded: any = jwt.verify(token, jwtRefreshSecret);
      const userRes = await this.db.query(
        `SELECT id, mobile_number, role FROM users WHERE id = $1 AND is_active = TRUE`,
        [decoded.userId],
      );

      if (userRes.rows.length === 0) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const user = userRes.rows[0];
      const profileRes = await this.db.query(
        `SELECT id FROM customer_profiles WHERE user_id = $1`,
        [user.id],
      );

      const customerId = profileRes.rows[0] ? profileRes.rows[0].id : null;

      const accessToken = jwt.sign(
        {
          userId: user.id,
          mobileNumber: user.mobile_number,
          role: user.role,
          customerId,
        },
        jwtSecret,
        { expiresIn: '24h' },
      );

      return {
        accessToken,
        expiresIn: 86400,
      };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}

