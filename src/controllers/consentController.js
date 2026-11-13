const db = require('../config/db');
const crypto = require('crypto');

const DOCUMENT_VERSION = 'v1.2';

const getUserId = (req) => {
  return req.user?.userId || req.user?.id;
};

// GET /api/v1/consents
exports.getConsents = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User authentication required.'
      });
    }

    // Find the customer's profile
    const profileResult = await db.query(
      `SELECT id FROM customer_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Customer profile not found.'
      });
    }

    const customerId = profileResult.rows[0].id;

    // Get latest consent record
    const result = await db.query(
      `SELECT *
       FROM dpdp_consents
       WHERE customer_id = $1
       ORDER BY consented_at DESC
       LIMIT 1`,
      [customerId]
    );

    const consent = result.rows[0];

    return res.status(200).json({
      documentVersion: consent?.consent_version || DOCUMENT_VERSION,

      consents: [
        {
          purpose: 'terms',
          granted: consent?.terms_accepted || false,
          mandatory: true
        },
        {
          purpose: 'privacy',
          granted: consent?.privacy_notice_accepted || false,
          mandatory: true
        },
        {
          purpose: 'telemetry',
          granted: consent?.iot_telematics_tracking_granted || false,
          mandatory: true
        },
        {
          purpose: 'whatsapp',
          granted: consent?.whatsapp_updates_granted || false,
          mandatory: false
        },
        {
          purpose: 'marketing',
          granted: consent?.marketing_promotions_granted || false,
          mandatory: false
        }
      ]
    });

  } catch (err) {
    next(err);
  }
};


// POST /api/v1/consents
exports.saveConsents = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User authentication required.'
      });
    }

    const {
      documentVersion = DOCUMENT_VERSION,
      termsAccepted,
      privacyNoticeAccepted,
      telemetryConsent,
      whatsappUpdates = false,
      marketingConsent = false,
      deviceId
    } = req.body || {};

    // Mandatory consent validation
    if (
      termsAccepted !== true ||
      privacyNoticeAccepted !== true ||
      telemetryConsent !== true
    ) {
      return res.status(400).json({
        code: 'MANDATORY_CONSENT_REQUIRED',
        message:
          'Terms, Privacy Policy, and Telemetry tracking must be accepted to proceed.'
      });
    }

    // Device ID validation
    if (
      typeof deviceId !== 'string' ||
      !deviceId.trim() ||
      deviceId.trim().length > 150
    ) {
      return res.status(400).json({
        code: 'INVALID_DEVICE_ID',
        message: 'A valid device ID is required.'
      });
    }

    // Validate optional consent values
    if (
      typeof whatsappUpdates !== 'boolean' ||
      typeof marketingConsent !== 'boolean'
    ) {
      return res.status(400).json({
        code: 'INVALID_CONSENT_VALUE',
        message: 'Optional consent values must be true or false.'
      });
    }

    if (
      typeof documentVersion !== 'string' ||
      !documentVersion.trim() ||
      documentVersion.length > 10
    ) {
      return res.status(400).json({
        code: 'INVALID_DOCUMENT_VERSION',
        message: 'A valid document version is required.'
      });
    }

    // Find customer profile
    const profileResult = await db.query(
      `SELECT id
       FROM customer_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Complete your customer profile before submitting consent.'
      });
    }

    const customerId = profileResult.rows[0].id;

    // Hash IP address instead of storing raw IP
    const ipAddress = req.ip || '';
    const ipHash = crypto
      .createHash('sha256')
      .update(
        `${ipAddress}:${process.env.IP_HASH_SECRET || process.env.JWT_SECRET || 'development-only'}`
      )
      .digest('hex');

    // Save consent record
    const result = await db.query(
      `INSERT INTO dpdp_consents (
        customer_id,
        consent_version,
        terms_accepted,
        privacy_notice_accepted,
        iot_telematics_tracking_granted,
        whatsapp_updates_granted,
        marketing_promotions_granted,
        device_id,
        ip_hash,
        user_agent,
        consented_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id, consented_at`,
      [
        customerId,
        documentVersion.trim(),
        termsAccepted,
        privacyNoticeAccepted,
        telemetryConsent,
        whatsappUpdates,
        marketingConsent,
        deviceId.trim(),
        ipHash,
        req.get('user-agent') || null
      ]
    );

    const savedConsent = result.rows[0];

    return res.status(201).json({
      consentRecordId: String(savedConsent.id),
      capturedAt: savedConsent.consented_at,
      allMandatoryAccepted: true,
      nextScreen: 'home'
    });

  } catch (err) {
    next(err);
  }
};