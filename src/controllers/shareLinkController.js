const db = require('../config/db');
const crypto = require('crypto');

const generateShareToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const generateShortCode = () => {
  return crypto.randomBytes(6).toString('base64url');
};

exports.generateConsigneeShareLink = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const {
      consigneeMobile,
      notifyViaSms = false,
      notifyViaWhatsapp = false
    } = req.body || {};

    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      });
    }

    if (!bookingId) {
      return res.status(400).json({
        code: 'BOOKING_ID_REQUIRED',
        message: 'Booking ID is required.'
      });
    }

    if (
      !consigneeMobile ||
      !/^\+?[1-9]\d{9,14}$/.test(consigneeMobile)
    ) {
      return res.status(400).json({
        code: 'INVALID_CONSIGNEE_MOBILE',
        message: 'Provide a valid consignee mobile number.'
      });
    }

    if (
      typeof notifyViaSms !== 'boolean' ||
      typeof notifyViaWhatsapp !== 'boolean'
    ) {
      return res.status(400).json({
        code: 'INVALID_NOTIFICATION_OPTIONS',
        message: 'Notification options must be true or false.'
      });
    }

    // Get the logged-in customer's profile
    const profileResult = await db.query(
      `SELECT id
       FROM customer_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (!profileResult.rows.length) {
      return res.status(404).json({
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Customer profile not found.'
      });
    }

    const customerId = profileResult.rows[0].id;

    // Check that this booking belongs to the logged-in customer
    const bookingResult = await db.query(
      `SELECT id, booking_ref, status
       FROM bookings
       WHERE id = $1
         AND customer_id = $2
       LIMIT 1`,
      [bookingId, customerId]
    );

    if (!bookingResult.rows.length) {
      return res.status(404).json({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found for this customer.'
      });
    }

    const booking = bookingResult.rows[0];

    if (['delivered', 'cancelled'].includes(booking.status)) {
      return res.status(409).json({
        code: 'SHARE_LINK_NOT_AVAILABLE',
        message: 'A share link cannot be generated for this booking status.'
      });
    }

    // Generate a new secure token and short code
    const shareToken = generateShareToken();
    const shortCode = generateShortCode();

    // Link expiry: 24 hours by default.
    const expiryHours = Math.max(
      1,
      Math.min(
        Number(process.env.CONSIGNEE_LINK_TTL_HOURS) || 24,
        168
      )
    );

    const expiresAt = new Date(
      Date.now() + expiryHours * 60 * 60 * 1000
    );

    // Save token and consignee mobile against this booking
    await db.query(
      `UPDATE bookings
       SET share_token = $1,
           share_token_expires_at = $2,
           destination_contact_phone = $3,
           updated_at = NOW()
       WHERE id = $4
         AND customer_id = $5`,
      [
        shareToken,
        expiresAt,
        consigneeMobile,
        bookingId,
        customerId
      ]
    );

    const publicBaseUrl = (
      process.env.CONSIGNEE_PUBLIC_URL ||
      'http://localhost:5000'
    ).replace(/\/+$/, '');

    const shortBaseUrl = (
      process.env.CONSIGNEE_SHORT_URL ||
      publicBaseUrl
    ).replace(/\/+$/, '');

    const shareUrl =
      `${publicBaseUrl}/api/v1/consignee/portal?token=${shareToken}`;

    // Short code is generated for the short-link URL.
    // A short-code lookup route/table is needed to resolve it.
    const shortUrl =
      `${shortBaseUrl}/t/${shortCode}`;

    // SMS and WhatsApp provider integration is not configured yet.
    // Do not report successful delivery until a provider confirms it.
    const smsSent = false;
    const whatsappSent = false;

    return res.status(201).json({
      shareUrl,
      shortUrl,
      expiresAt: expiresAt.toISOString(),
      smsSent,
      whatsappSent
    });

  } catch (error) {
    next(error);
  }
};