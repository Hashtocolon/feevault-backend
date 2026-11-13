const db = require('../config/db');
const crypto = require('crypto');

const OUTCOMES = [
  'full_acceptance',
  'partial_acceptance',
  'excursion_claim',
  'full_rejection'
];

const hashOtp = (otp) =>
  crypto.createHash('sha256').update(String(otp)).digest('hex');

const safeCompare = (a, b) => {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));

  return first.length === second.length &&
    crypto.timingSafeEqual(first, second);
};

const getBookingByToken = async (token) => {
  if (!token || typeof token !== 'string') return null;

  const result = await db.query(
    `SELECT
       b.*,
       d.full_name AS driver_name
     FROM bookings b
     LEFT JOIN drivers d ON d.id = b.assigned_driver_id
     WHERE b.share_token = $1
       AND b.share_token_expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  return result.rows[0] || null;
};


// =====================================================
// API 1: GET /api/v1/consignee/portal?token=...
// Load consignee portal
// =====================================================

exports.getConsigneePortal = async (req, res, next) => {
  try {
    const token = req.query.token;

    if (!token) {
      return res.status(400).json({
        code: 'SHARE_TOKEN_REQUIRED',
        message: 'Share token is required.'
      });
    }

    const booking = await getBookingByToken(token);

    if (!booking) {
      return res.status(404).json({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'This consignee link is invalid or has expired.'
      });
    }

    if (booking.status === 'delivered') {
      return res.status(410).json({
        code: 'DELIVERY_ALREADY_COMPLETED',
        message: 'Delivery has already been completed.'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(410).json({
        code: 'BOOKING_CANCELLED',
        message: 'This booking has been cancelled.'
      });
    }

    const tempResult = await db.query(
      `SELECT probe_temp_c, chamber_temp_c, recorded_at
       FROM telematics_snapshots
       WHERE booking_id = $1
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [booking.id]
    );

    const latestTemp = tempResult.rows[0] || null;

    let tempStatus = 'unavailable';

    if (latestTemp) {
      const probe = Number(latestTemp.probe_temp_c);
      const chamber = Number(latestTemp.chamber_temp_c);
      const min = Number(booking.sla_min_temp_c);
      const max = Number(booking.sla_max_temp_c);

      tempStatus =
        probe < min || probe > max ||
        chamber < min || chamber > max
          ? 'out_of_spec'
          : 'in_spec';
    }

    return res.status(200).json({
      portalStatus: 'active',
      bookingRef: booking.booking_ref,
      destinationLabel:
        booking.destination_gate_dock ||
        booking.destination_address,
      driverName: booking.driver_name || null,

      // The specification asks the portal to display this OTP.
      // Do not expose the stored hash.
      deliveryOtp: null,
      otpValidityNote:
        `Delivery OTP must be provided to the driver for ${booking.booking_ref}`,

      handoverTempAudit: {
        status: tempStatus,
        handoverProbeReadingC: latestTemp?.probe_temp_c === null ||
          latestTemp?.probe_temp_c === undefined
            ? null : Number(latestTemp.probe_temp_c),
        chamberSensorReadingC: latestTemp
          ? Number(latestTemp.chamber_temp_c)
          : null,
        slaMinC: Number(booking.sla_min_temp_c),
        slaMaxC: Number(booking.sla_max_temp_c),
        lastUpdatedAt: latestTemp?.recorded_at || null
      },

      outcomeOptions: [
        {
          code: 'full_acceptance',
          label: 'Full Acceptance',
          description: '100% cartons received in spec with OTP',
          iconType: 'check_green',
          proofRequired: ['otp', 'photo']
        },
        {
          code: 'partial_acceptance',
          label: 'Partial Acceptance',
          description: 'Accept good units, reject damaged or warm cartons',
          iconType: 'warning_yellow',
          proofRequired: ['otp', 'photo', 'damaged_unit_count']
        },
        {
          code: 'excursion_claim',
          label: 'Excursion Claim',
          description: 'Log probe deviation and claim',
          iconType: 'alert_red',
          proofRequired: ['otp', 'photo', 'probe_reading']
        },
        {
          code: 'full_rejection',
          label: 'Full Rejection',
          description: 'Refusal of cargo and operations escalation',
          iconType: 'cross_red',
          proofRequired: ['otp', 'photo', 'rejection_reason']
        }
      ],

      tokenExpiresAt: booking.share_token_expires_at
    });

  } catch (error) {
    next(error);
  }
};


// =====================================================
// API 2: POST /api/v1/consignee/portal/verify-otp
// Verify delivery OTP
// =====================================================

exports.verifyDeliveryOtp = async (req, res, next) => {
  let client;

  try {
    const token = req.query.token;
    const { otp } = req.body || {};

    if (!token) {
      return res.status(400).json({
        code: 'SHARE_TOKEN_REQUIRED',
        message: 'Share token is required.'
      });
    }

    if (!/^\d{4}$/.test(String(otp || ''))) {
      return res.status(400).json({
        code: 'INVALID_OTP_FORMAT',
        message: 'Enter a valid 4-digit delivery OTP.'
      });
    }

    client = await db.pool.connect();
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT id, delivery_otp_hash, status
       FROM bookings
       WHERE share_token = $1
         AND share_token_expires_at > NOW()
       FOR UPDATE`,
      [token]
    );

    if (!bookingResult.rows.length) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'This consignee link is invalid or has expired.'
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.status === 'delivered') {
      await client.query('ROLLBACK');

      return res.status(410).json({
        code: 'DELIVERY_ALREADY_COMPLETED',
        message: 'Delivery has already been completed.'
      });
    }

    await client.query(
      `INSERT INTO consignee_otp_verifications (booking_id)
       VALUES ($1)
       ON CONFLICT (booking_id) DO NOTHING`,
      [booking.id]
    );

    const verificationResult = await client.query(
      `SELECT attempts_count, verified_at
       FROM consignee_otp_verifications
       WHERE booking_id = $1
       FOR UPDATE`,
      [booking.id]
    );

    const verification = verificationResult.rows[0];

    if (verification.verified_at) {
      await client.query('COMMIT');

      return res.status(200).json({
        verified: true,
        verifiedAt: verification.verified_at,
        message: 'OTP has already been verified. Please choose the Receiver Outcome.'
      });
    }

    if (verification.attempts_count >= 3) {
      await client.query('COMMIT');

      return res.status(429).json({
        code: 'OTP_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect attempts. Contact operations.'
      });
    }

    const submittedHash = hashOtp(otp);
    const isValid = safeCompare(
      submittedHash,
      booking.delivery_otp_hash
    );

    if (!isValid) {
      const updated = await client.query(
        `UPDATE consignee_otp_verifications
         SET attempts_count = attempts_count + 1,
             updated_at = NOW()
         WHERE booking_id = $1
         RETURNING attempts_count`,
        [booking.id]
      );

      const attemptsRemaining = Math.max(
        0,
        3 - Number(updated.rows[0].attempts_count)
      );

      await client.query('COMMIT');

      return res.status(400).json({
        verified: false,
        attemptsRemaining,
        message: 'Incorrect OTP. Please try again.'
      });
    }

    const verifiedResult = await client.query(
      `UPDATE consignee_otp_verifications
       SET verified_at = NOW(),
           updated_at = NOW()
       WHERE booking_id = $1
       RETURNING verified_at`,
      [booking.id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      verified: true,
      verifiedAt: verifiedResult.rows[0].verified_at,
      message: 'OTP verified. Please choose the Receiver Outcome.'
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


// =====================================================
// API 3: POST /api/v1/consignee/portal/outcome
// Submit receiver outcome / e-POD
// =====================================================

exports.submitReceiverOutcome = async (req, res, next) => {
  let client;

  try {
    const token = req.query.token;

    const {
      outcome,
      receiverName,
      receiverDesignation,
      cartonCountReceived,
      cartonCountRejected,
      handoverProductCoreTempC,
      rejectionReason,
      dataLoggerSerialNumber,
      receiverRemarks,
      cargoDispositionInstruction,
      proofPhotos,
      signatureImageUrl
    } = req.body || {};

    if (!token) {
      return res.status(400).json({
        code: 'SHARE_TOKEN_REQUIRED',
        message: 'Share token is required.'
      });
    }

    if (!OUTCOMES.includes(outcome)) {
      return res.status(400).json({
        code: 'INVALID_OUTCOME',
        message: 'Select a valid receiver outcome.'
      });
    }

    if (!receiverName || !receiverName.trim() ||
        !receiverDesignation || !receiverDesignation.trim()) {
      return res.status(400).json({
        code: 'RECEIVER_DETAILS_REQUIRED',
        message: 'Receiver name and designation are required.'
      });
    }

    if (!Array.isArray(proofPhotos) || proofPhotos.length === 0 ||
        !proofPhotos.every(url =>
          typeof url === 'string' &&
          /^https?:\/\//i.test(url)
        )) {
      return res.status(400).json({
        code: 'PROOF_PHOTOS_REQUIRED',
        message: 'Provide at least one valid proof photo URL.'
      });
    }

    if (!signatureImageUrl ||
        !/^https?:\/\//i.test(signatureImageUrl)) {
      return res.status(400).json({
        code: 'SIGNATURE_REQUIRED',
        message: 'A valid signature image URL is required.'
      });
    }

    if (
      outcome === 'full_acceptance' &&
      (
        !Number.isInteger(cartonCountReceived) ||
        cartonCountReceived < 0 ||
        handoverProductCoreTempC === undefined ||
        handoverProductCoreTempC === null ||
        !Number.isFinite(Number(handoverProductCoreTempC))
      )
    ) {
      return res.status(400).json({
        code: 'ACCEPTANCE_DETAILS_REQUIRED',
        message: 'Received carton count and product core temperature are required.'
      });
    }

    if (
      outcome === 'partial_acceptance' &&
      (
        !Number.isInteger(cartonCountReceived) ||
        !Number.isInteger(cartonCountRejected) ||
        cartonCountReceived < 0 ||
        cartonCountRejected < 0 ||
        !rejectionReason ||
        !rejectionReason.trim()
      )
    ) {
      return res.status(400).json({
        code: 'PARTIAL_ACCEPTANCE_DETAILS_REQUIRED',
        message: 'Received cartons, rejected cartons and rejection reason are required.'
      });
    }

    if (
      outcome === 'excursion_claim' &&
      (
        !dataLoggerSerialNumber ||
        !dataLoggerSerialNumber.trim() ||
        !receiverRemarks ||
        !receiverRemarks.trim()
      )
    ) {
      return res.status(400).json({
        code: 'EXCURSION_DETAILS_REQUIRED',
        message: 'Data logger serial number and receiver remarks are required.'
      });
    }

    if (
      outcome === 'full_rejection' &&
      (
        !rejectionReason ||
        !rejectionReason.trim() ||
        !cargoDispositionInstruction ||
        !cargoDispositionInstruction.trim()
      )
    ) {
      return res.status(400).json({
        code: 'REJECTION_DETAILS_REQUIRED',
        message: 'Rejection reason and cargo disposition instruction are required.'
      });
    }

    client = await db.pool.connect();
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT *
       FROM bookings
       WHERE share_token = $1
         AND share_token_expires_at > NOW()
       FOR UPDATE`,
      [token]
    );

    if (!bookingResult.rows.length) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'This consignee link is invalid or has expired.'
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.status === 'delivered') {
      await client.query('ROLLBACK');

      return res.status(409).json({
        code: 'DELIVERY_ALREADY_COMPLETED',
        message: 'An e-POD has already been submitted.'
      });
    }

    const otpResult = await client.query(
      `SELECT verified_at
       FROM consignee_otp_verifications
       WHERE booking_id = $1
       FOR UPDATE`,
      [booking.id]
    );

    if (!otpResult.rows.length || !otpResult.rows[0].verified_at) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        code: 'OTP_NOT_VERIFIED',
        message: 'Verify the delivery OTP before submitting the receiver outcome.'
      });
    }

    const epodResult = await client.query(
      `INSERT INTO epods (
        booking_id,
        outcome,
        receiver_name,
        receiver_designation,
        otp_verified,
        handover_core_temp_c,
        carton_count_received,
        carton_count_rejected,
        rejection_reason,
        data_logger_serial_number,
        receiver_remarks,
        cargo_disposition_instruction,
        signature_image_url,
        submitted_at
      )
      VALUES (
        $1, $2, $3, $4, TRUE, $5, $6, $7,
        $8, $9, $10, $11, $12, NOW()
      )
      RETURNING id, submitted_at`,
      [
        booking.id,
        outcome,
        receiverName.trim(),
        receiverDesignation.trim(),
        handoverProductCoreTempC ?? null,
        cartonCountReceived ?? 0,
        cartonCountRejected ?? 0,
        rejectionReason || null,
        dataLoggerSerialNumber || null,
        receiverRemarks || null,
        cargoDispositionInstruction || null,
        signatureImageUrl
      ]
    );

    const epod = epodResult.rows[0];

    for (const photoUrl of proofPhotos) {
      await client.query(
        `INSERT INTO epod_evidence_photos (epod_id, photo_url)
         VALUES ($1, $2)`,
        [epod.id, photoUrl]
      );
    }

    let tripClosed = true;
    let claimFiled = false;
    let opsAlerted = false;

    if (outcome === 'full_rejection') {
      tripClosed = false;
      opsAlerted = true;

      await client.query(
        `UPDATE bookings
         SET status = 'failed_delivery',
             sub_status_label = 'CARGO REJECTED',
             updated_at = NOW()
         WHERE id = $1`,
        [booking.id]
      );

    } else {
      await client.query(
        `UPDATE bookings
         SET status = 'delivered',
             sub_status_label = 'DELIVERED',
             updated_at = NOW()
         WHERE id = $1`,
        [booking.id]
      );

      if (outcome === 'partial_acceptance') {
        opsAlerted = true;
      }

      if (outcome === 'excursion_claim') {
        claimFiled = true;
        opsAlerted = true;

        const claimCode =
          `CLM-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

        await client.query(
          `INSERT INTO claims (
            claim_code,
            booking_id,
            customer_id,
            claim_category,
            claim_value_minor,
            evidence_type,
            issue_description,
            incident_datetime,
            status,
            is_within_24hr_window
          )
          VALUES (
            $1, $2, $3, 'temperature_excursion',
            0, 'photos_and_probe', $4, NOW(),
            'under_review', TRUE
          )`,
          [
            claimCode,
            booking.id,
            booking.customer_id,
            receiverRemarks.trim()
          ]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      epodId: epod.id,
      bookingRef: booking.booking_ref,
      outcome,
      status: 'recorded',
      epodPdfUrl: null,
      tripClosed,
      claimFiled,
      opsAlerted,
      message:
        outcome === 'full_acceptance'
          ? 'Delivery confirmed. e-POD has been recorded.'
          : outcome === 'partial_acceptance'
            ? 'Partial delivery recorded. Operations team must review the shortage.'
            : outcome === 'excursion_claim'
              ? 'Temperature excursion recorded. A claim has been created for review.'
              : 'Cargo rejection recorded. Operations team must handle the failed delivery.'
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