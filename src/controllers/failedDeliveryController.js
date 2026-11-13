const db = require('../config/db');

const VALID_DECISIONS = [
  'alternate_contact',
  'retry_later',
  'return_to_origin'
];

exports.submitFailedDeliveryDecision = async (req, res, next) => {
  let client;

  try {
    const userId = req.user?.userId || req.user?.id;
    const { bookingId } = req.params;

    const {
      decision,
      alternateContact,
      retryScheduledTime,
      customerNotes
    } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      });
    }

    if (!VALID_DECISIONS.includes(decision)) {
      return res.status(400).json({
        code: 'INVALID_DECISION',
        message: 'Decision must be alternate_contact, retry_later or return_to_origin.'
      });
    }

    if (decision === 'alternate_contact') {
      if (
        !alternateContact?.name ||
        !alternateContact?.phone ||
        !/^\+?[1-9]\d{9,14}$/.test(alternateContact.phone)
      ) {
        return res.status(400).json({
          code: 'ALTERNATE_CONTACT_REQUIRED',
          message: 'Provide a valid alternate contact name and phone number.'
        });
      }
    }

    if (decision === 'retry_later') {
      if (!retryScheduledTime || Number.isNaN(Date.parse(retryScheduledTime))) {
        return res.status(400).json({
          code: 'RETRY_TIME_REQUIRED',
          message: 'Provide a valid retryScheduledTime.'
        });
      }

      if (new Date(retryScheduledTime) <= new Date()) {
        return res.status(400).json({
          code: 'INVALID_RETRY_TIME',
          message: 'Retry time must be in the future.'
        });
      }
    }

    client = await db.pool.connect();
    await client.query('BEGIN');

    const profileResult = await client.query(
      `SELECT id
       FROM customer_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (!profileResult.rows.length) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Customer profile not found.'
      });
    }

    const customerId = profileResult.rows[0].id;

    const bookingResult = await client.query(
      `SELECT id, booking_ref, status
       FROM bookings
       WHERE id = $1
         AND customer_id = $2
       FOR UPDATE`,
      [bookingId, customerId]
    );

    if (!bookingResult.rows.length) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found.'
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== 'failed_delivery') {
      await client.query('ROLLBACK');

      return res.status(409).json({
        code: 'DELIVERY_NOT_FAILED',
        message: 'This booking is not currently marked as failed delivery.'
      });
    }

    // Find the latest unresolved failed-delivery event.
    const eventResult = await client.query(
      `SELECT id
       FROM failed_delivery_events
       WHERE booking_id = $1
         AND resolved_at IS NULL
       ORDER BY reported_at DESC
       LIMIT 1
       FOR UPDATE`,
      [bookingId]
    );

    if (!eventResult.rows.length) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        code: 'FAILED_DELIVERY_EVENT_NOT_FOUND',
        message: 'No unresolved failed-delivery event was found for this booking.'
      });
    }

    const eventId = eventResult.rows[0].id;

    const alternateName =
      decision === 'alternate_contact'
        ? alternateContact.name
        : null;

    const alternatePhone =
      decision === 'alternate_contact'
        ? alternateContact.phone
        : null;

    const alternateGateDock =
      decision === 'alternate_contact'
        ? alternateContact.gateDockNumber || null
        : null;

    const retryTime =
      decision === 'retry_later'
        ? new Date(retryScheduledTime)
        : null;

    await client.query(
      `UPDATE failed_delivery_events
       SET customer_decision = $1,
           alternate_contact_name = $2,
           alternate_contact_phone = $3,
           alternate_gate_dock = $4,
           retry_scheduled_time = $5,
           waiting_charges_approved = $6,
           resolved_at = NOW()
       WHERE id = $7`,
      [
        decision,
        alternateName,
        alternatePhone,
        alternateGateDock,
        retryTime,
        decision === 'retry_later',
        eventId
      ]
    );

    // Keep booking in failed_delivery until the driver/operations
    // system confirms that the new instructions have been carried out.
    await client.query(
      `UPDATE bookings
       SET updated_at = NOW()
       WHERE id = $1`,
      [bookingId]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      bookingRef: booking.booking_ref,
      decision,
      status: 'instructions_dispatched',
      driverNotified: false,
      opsTicketRef: null,
      message:
        'Customer decision saved. Driver and operations notification integration is not configured yet.'
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    next(error);

  } finally {
    if (client) client.release();
  }
};