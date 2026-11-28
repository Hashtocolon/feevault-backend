const db = require('../config/db');

// Get authenticated user ID
const getUserId = (req) => {
  return req.user?.userId || req.user?.id;
};

// Supported languages
const LANGUAGES = ['en', 'kn', 'hi', 'ta', 'te', 'mr', 'gu'];

// GSTIN validation
const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// PAN validation
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


// --------------------------------------------------
// 1. GET CURRENT CUSTOMER PROFILE
// GET /api/v1/me
// --------------------------------------------------

exports.getMyProfile = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User authentication required.'
      });
    }

    const result = await db.query(
      `
      SELECT
        u.id,
        u.mobile_number,
        u.email,
        u.full_name,
        u.preferred_language,
        u.is_active,

        cp.id AS profile_id,
        cp.account_type,
        cp.company_name,
        cp.gstin,
        cp.pan,
        cp.fssai_number,
        cp.gstin_status,
        cp.fssai_status,
        cp.address_line1,
        cp.address_line2,
        cp.city,
        cp.state,
        cp.pincode,
        cp.billing_phone

      FROM users u

      LEFT JOIN customer_profiles cp
        ON cp.user_id = u.id

      WHERE u.id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Customer profile not found.'
      });
    }

    const user = result.rows[0];

    const accountType = user.account_type || null;

    const basicDetailsComplete = Boolean(
      user.profile_id &&
      user.full_name &&
      user.email &&
      user.preferred_language
    );

    let isProfileComplete = false;

    if (accountType === 'individual') {
      isProfileComplete = basicDetailsComplete;
    } else if (accountType === 'business') {
      isProfileComplete = Boolean(
        basicDetailsComplete &&
        user.gstin &&
        user.gstin_status === 'verified'
      );
    }

    return res.status(200).json({
      id: String(user.id),
      mobileNumber: user.mobile_number,
      email: user.email,
      displayName: user.full_name,
      preferredLanguage: user.preferred_language || 'en',
      accountType: accountType,
      isProfileComplete: isProfileComplete,
      status: user.is_active ? 'active' : 'inactive'
    });

  } catch (err) {
    next(err);
  }
};


// --------------------------------------------------
// 2. VERIFY GSTIN
// POST /api/v1/compliance/gstin/verify
// --------------------------------------------------

exports.verifyGstin = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User authentication required.'
      });
    }

    const gstin = req.body?.gstin;

    if (!gstin || typeof gstin !== 'string') {
      return res.status(400).json({
        code: 'INVALID_GSTIN',
        message: 'GSTIN is required.'
      });
    }

    const normalizedGstin = gstin.trim().toUpperCase();

    if (!GSTIN_REGEX.test(normalizedGstin)) {
      return res.status(400).json({
        code: 'INVALID_GSTIN',
        message: 'Enter a valid 15-character GSTIN.'
      });
    }

    // Check GST provider configuration
    // if (
    //   !process.env.GSTIN_VERIFY_URL ||
    //   !process.env.GSTIN_API_KEY
    // ) {
    //   return res.status(503).json({
    //     code: 'GST_PROVIDER_NOT_CONFIGURED',
    //     message: 'GST verification provider is not configured.'
    //   });
    // }
    // TESTING ONLY: Mock GST verification
if (!process.env.GST_API_KEY) {
  const pan = normalizedGstin.substring(2, 12);

  return res.status(200).json({
    isValid: true,
    legalName: "Acme Cold Foods Private Limited",
    tradeName: "Acme Cold Foods",
    pan: pan,
    status: "Active",
    registeredAddress: {
      line1: "Plot 42, Bhiwandi Logistics Corridor",
      city: "Thane",
      state: "Maharashtra",
      pincode: "421302"
    }
  });
}

    // Call configured GST verification provider
    const response = await fetch(process.env.GSTIN_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GSTIN_API_KEY}`
      },
      body: JSON.stringify({
        gstin: normalizedGstin
      })
    });

    if (!response.ok) {
      return res.status(502).json({
        code: 'GST_PROVIDER_ERROR',
        message: 'Unable to verify GSTIN right now.'
      });
    }

    const data = await response.json();

    if (data.isValid !== true) {
      return res.status(400).json({
        code: 'INVALID_GSTIN',
        message: 'GSTIN is invalid or not found on the GST portal.'
      });
    }

    // If this GSTIN is already saved for this user,
    // update its verification status.
    await db.query(
      `
      UPDATE customer_profiles
      SET gstin_status = 'verified',
          updated_at = NOW()
      WHERE user_id = $1
        AND gstin = $2
      `,
      [userId, normalizedGstin]
    );

    return res.status(200).json({
      isValid: true,
      legalName: data.legalName || null,
      tradeName: data.tradeName || null,
      pan: data.pan || null,
      status: data.status || null,
      registeredAddress: {
        line1: data.registeredAddress?.line1 || '',
        city: data.registeredAddress?.city || '',
        state: data.registeredAddress?.state || '',
        pincode: data.registeredAddress?.pincode || ''
      }
    });

  } catch (err) {
    next(err);
  }
};


// --------------------------------------------------
// 3. SAVE / UPDATE CUSTOMER PROFILE
// POST /api/v1/customer/profile
// --------------------------------------------------

exports.saveCustomerProfile = async (req, res, next) => {
  let client;

  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User authentication required.'
      });
    }

    const {
      accountType,
      displayName,
      email,
      preferredLanguage = 'en',
      companyName,
      gstin,
      pan,
      fssaiNumber,
      registeredAddress = {},
      billingPhone
    } = req.body || {};

    // Account type validation
    if (!['business', 'individual'].includes(accountType)) {
      return res.status(400).json({
        code: 'INVALID_ACCOUNT_TYPE',
        message: 'Account type must be business or individual.'
      });
    }

    // Display name validation
    if (
      typeof displayName !== 'string' ||
      displayName.trim().length < 2 ||
      displayName.trim().length > 100
    ) {
      return res.status(400).json({
        code: 'INVALID_NAME',
        message: 'Name must contain 2 to 100 characters.'
      });
    }

    // Email validation
    if (
      typeof email !== 'string' ||
      !EMAIL_REGEX.test(email.trim())
    ) {
      return res.status(400).json({
        code: 'INVALID_EMAIL',
        message: 'Enter a valid email address.'
      });
    }

    // Language validation
    if (!LANGUAGES.includes(preferredLanguage)) {
      return res.status(400).json({
        code: 'INVALID_LANGUAGE',
        message: 'Unsupported preferred language.'
      });
    }

    // Normalize values
    const cleanGstin =
      typeof gstin === 'string'
        ? gstin.trim().toUpperCase() || null
        : null;

    const cleanPan =
      typeof pan === 'string'
        ? pan.trim().toUpperCase() || null
        : null;

    const cleanFssai =
      typeof fssaiNumber === 'string'
        ? fssaiNumber.trim() || null
        : null;

    // Business GSTIN validation
    if (accountType === 'business' && !cleanGstin) {
      return res.status(400).json({
        code: 'GSTIN_REQUIRED',
        message: 'GSTIN is required for business accounts.'
      });
    }

    if (cleanGstin && !GSTIN_REGEX.test(cleanGstin)) {
      return res.status(400).json({
        code: 'INVALID_GSTIN',
        message: 'GSTIN format is invalid.'
      });
    }

    // PAN validation
    if (cleanPan && !PAN_REGEX.test(cleanPan)) {
      return res.status(400).json({
        code: 'INVALID_PAN',
        message: 'PAN must be 10 valid characters.'
      });
    }

    // FSSAI validation
    if (cleanFssai && !/^\d{14}$/.test(cleanFssai)) {
      return res.status(400).json({
        code: 'INVALID_FSSAI',
        message: 'FSSAI number must contain 14 digits.'
      });
    }

    // Address validation
    const address =
      registeredAddress &&
      typeof registeredAddress === 'object' &&
      !Array.isArray(registeredAddress)
        ? registeredAddress
        : {};

    const line1 = address.line1?.trim() || null;
    const line2 = address.line2?.trim() || null;
    const city = address.city?.trim() || null;
    const state = address.state?.trim() || null;
    const pincode = address.pincode?.trim() || null;

    if (pincode && !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        code: 'INVALID_PINCODE',
        message: 'Enter a valid 6-digit Indian pincode.'
      });
    }

    // Billing phone validation, if provided
    const cleanBillingPhone =
      typeof billingPhone === 'string'
        ? billingPhone.trim() || null
        : null;

    if (
      cleanBillingPhone &&
      !/^\+?[1-9]\d{9,14}$/.test(cleanBillingPhone)
    ) {
      return res.status(400).json({
        code: 'INVALID_BILLING_PHONE',
        message: 'Enter a valid billing phone number.'
      });
    }

    // Start database transaction
   client = await db.pool.connect();

    await client.query('BEGIN');

    // Check user
    const userCheck = await client.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found.'
      });
    }

    // Check whether the same GSTIN was already verified
    const existingProfile = await client.query(
      `
      SELECT gstin, gstin_status
      FROM customer_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    const previousProfile = existingProfile.rows[0];

    let gstinStatus = 'not_provided';

    if (cleanGstin) {
      gstinStatus =
        previousProfile &&
        previousProfile.gstin === cleanGstin &&
        previousProfile.gstin_status === 'verified'
          ? 'verified'
          : 'pending';
    }

    const fssaiStatus = cleanFssai
      ? 'recorded'
      : 'not_provided';

    // Update user details
    await client.query(
      `
      UPDATE users
      SET
        full_name = $1,
        email = $2,
        preferred_language = $3
      WHERE id = $4
      `,
      [
        displayName.trim(),
        email.trim().toLowerCase(),
        preferredLanguage,
        userId
      ]
    );

    // Insert or update customer profile
    await client.query(
      `
      INSERT INTO customer_profiles (
        user_id,
        account_type,
        company_name,
        gstin,
        pan,
        fssai_number,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        billing_phone,
        gstin_status,
        fssai_status,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, NOW()
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        account_type = EXCLUDED.account_type,
        company_name = EXCLUDED.company_name,
        gstin = EXCLUDED.gstin,
        pan = EXCLUDED.pan,
        fssai_number = EXCLUDED.fssai_number,
        address_line1 = EXCLUDED.address_line1,
        address_line2 = EXCLUDED.address_line2,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        pincode = EXCLUDED.pincode,
        billing_phone = EXCLUDED.billing_phone,
        gstin_status = EXCLUDED.gstin_status,
        fssai_status = EXCLUDED.fssai_status,
        updated_at = NOW()
      `,
      [
        userId,
        accountType,
        companyName?.trim() || null,
        cleanGstin,
        cleanPan,
        cleanFssai,
        line1,
        line2,
        city,
        state,
        pincode,
        cleanBillingPhone,
        gstinStatus,
        fssaiStatus
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      customerId: String(userId),
      accountType: accountType,
      isProfileComplete: accountType === 'individual'
        ? true
        : gstinStatus === 'verified',
      gstinStatus: gstinStatus,
      fssaiStatus: fssaiStatus,
      nextScreen: 'consentSetup'
    });

  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    next(err);

  } finally {
    if (client) {
      client.release();
    }
  }
};