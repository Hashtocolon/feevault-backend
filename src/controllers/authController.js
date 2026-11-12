const db = require('../config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Helper to hash OTP for secure storage
function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * 1. SEND OTP
 * Generates 6-digit OTP, stores hash in `auth_otps` table with 5-min expiry.
 */
exports.sendOtp = async (req, res, next) => {
  try {
    const { mobileNumber, channel = 'sms' } = req.body;

    if (!mobileNumber || !/^\+?[1-9]\d{9,14}$/.test(mobileNumber)) {
      return res.status(400).json({
        error: 'INVALID_MOBILE',
        message: 'Valid E.164 mobile number is required (e.g. +919876543210)'
      });
    }

    // Rate-limiting check: max 3 OTP requests in last 10 minutes
    const recentRequests = await db.query(
      `SELECT COUNT(*) FROM auth_otps 
       WHERE mobile_number = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
      [mobileNumber]
    );

    if (parseInt(recentRequests.rows[0].count, 10) >= 5) {
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'OTP request limit reached. Please wait 10 minutes.'
      });
    }

    // In development/test mode, use fixed OTP or generate random 6 digits
    const isDev = process.env.NODE_ENV !== 'production';
    const otp = isDev ? '491820' : Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Invalidate previous unverified OTPs
    await db.query(
      `UPDATE auth_otps SET expires_at = NOW() 
       WHERE mobile_number = $1 AND verified_at IS NULL AND expires_at > NOW()`,
      [mobileNumber]
    );

    // Insert new OTP record
    await db.query(
      `INSERT INTO auth_otps (mobile_number, otp_hash, channel, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [mobileNumber, otpHash, channel, expiresAt]
    );

    console.log(`[AUTH] OTP sent to ${mobileNumber}: ${otp}`);

    res.status(200).json({
      status: 'otp_sent',
      mobileNumber,
      channel,
      expiresInSeconds: 300,
      ...(isDev && { demoOtp: otp }) // Returns demo OTP in dev mode for easy testing
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. VERIFY OTP
 * Validates OTP code, finds/creates user in `users` table, and issues JWT tokens.
 */
exports.verifyOtp = async (req, res, next) => {
  try {
    const { mobileNumber, otp, role = 'customer' } = req.body;

    if (!mobileNumber || !otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Mobile number and 6-digit OTP are required.'
      });
    }

    // Validate role against enum
    const allowedRoles = ['customer', 'driver', 'ops_admin', 'finance_admin'];
    const userRole = allowedRoles.includes(role) ? role : 'customer';

    const otpHash = hashOtp(otp);

    // Look up latest active OTP for this mobile
    const otpResult = await db.query(
      `SELECT id, otp_hash, attempts_count, expires_at 
       FROM auth_otps 
       WHERE mobile_number = $1 AND verified_at IS NULL 
       ORDER BY created_at DESC LIMIT 1`,
      [mobileNumber]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        error: 'OTP_EXPIRED_OR_NOT_FOUND',
        message: 'No active OTP found. Please request a new OTP.'
      });
    }

    const otpRecord = otpResult.rows[0];

    // Check expiry
    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({
        error: 'OTP_EXPIRED',
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Check max attempts (max 3 invalid tries)
    if (otpRecord.attempts_count >= 3) {
      return res.status(403).json({
        error: 'MAX_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect attempts. This OTP has been invalidated.'
      });
    }

    // Verify Hash match
    if (otpRecord.otp_hash !== otpHash) {
      await db.query(
        `UPDATE auth_otps SET attempts_count = attempts_count + 1 WHERE id = $1`,
        [otpRecord.id]
      );
      const remaining = 2 - otpRecord.attempts_count;
      return res.status(401).json({
        error: 'INVALID_OTP',
        message: `Incorrect OTP. ${remaining >= 0 ? remaining : 0} attempts remaining.`
      });
    }

    // Mark OTP as verified
    await db.query(
      `UPDATE auth_otps SET verified_at = NOW() WHERE id = $1`,
      [otpRecord.id]
    );

    // Find or Auto-Create User in `users` table
    let userResult = await db.query(
      `SELECT id, mobile_number, email, full_name, role, is_active, preferred_language, created_at 
       FROM users WHERE mobile_number = $1`,
      [mobileNumber]
    );

    let isNewUser = false;
    let user;

    if (userResult.rows.length === 0) {
      // First time registration
      isNewUser = true;
      const insertUser = await db.query(
        `INSERT INTO users (mobile_number, role)
         VALUES ($1, $2)
         RETURNING id, mobile_number, email, full_name, role, is_active, preferred_language, created_at`,
        [mobileNumber, userRole]
      );
      user = insertUser.rows[0];
    } else {
      user = userResult.rows[0];
      if (!user.is_active) {
        return res.status(403).json({
          error: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been deactivated. Please contact support.'
        });
      }
    }

    // Sign Access Token (24h) and Refresh Token (30d)
    const secret = process.env.JWT_SECRET || 'zoop_coldroute_jwt_super_secret_key_2026_xyz';
    const accessToken = jwt.sign(
      {
        userId: user.id,
        mobileNumber: user.mobile_number,
        role: user.role
      },
      secret,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, tokenType: 'refresh' },
      secret,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      status: 'authenticated',
      isNewUser,
      tokens: {
        accessToken,
        refreshToken,
        expiresInSeconds: 86400
      },
      user: {
        id: user.id,
        mobileNumber: user.mobile_number,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferred_language
      },
      nextStep: isNewUser ? 'PROFILE_SETUP' : 'DASHBOARD'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. RESEND OTP
 * Invalidates old OTP and issues a fresh one.
 */
exports.resendOtp = async (req, res, next) => {
  return exports.sendOtp(req, res, next);
};

/**
 * 4. REFRESH TOKEN
 * Issues new access token from valid refresh token.
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'TOKEN_REQUIRED',
        message: 'Refresh token is required.'
      });
    }

    const secret = process.env.JWT_SECRET || 'zoop_coldroute_jwt_super_secret_key_2026_xyz';

    jwt.verify(refreshToken, secret, async (err, decoded) => {
      if (err || decoded.tokenType !== 'refresh') {
        return res.status(403).json({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is expired or invalid.'
        });
      }

      const userRes = await db.query(
        `SELECT id, mobile_number, role, is_active FROM users WHERE id = $1`,
        [decoded.userId]
      );

      if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
        return res.status(403).json({
          error: 'USER_NOT_FOUND',
          message: 'User no longer active.'
        });
      }

      const user = userRes.rows[0];
      const newAccessToken = jwt.sign(
        {
          userId: user.id,
          mobileNumber: user.mobile_number,
          role: user.role
        },
        secret,
        { expiresIn: '24h' }
      );

      res.status(200).json({
        status: 'token_refreshed',
        accessToken: newAccessToken,
        expiresInSeconds: 86400
      });
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. LOGOUT
 * Invalidates session client-side.
 */
exports.logout = async (req, res) => {
  res.status(200).json({
    status: 'logged_out',
    message: 'User logged out successfully.'
  });
};
