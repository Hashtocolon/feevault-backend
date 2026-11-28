const db = require('../config/db');
const crypto = require('crypto');

const hashValue = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

const generateCode = (prefix) =>
  `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const generateOtp = () =>
  String(crypto.randomInt(1000, 10000));

const generateShareToken = () =>
  crypto.randomBytes(32).toString('hex');

const TEMP_BANDS = {
  deep_frozen: {
    min: -25,
    max: -18,
    target: -18
  },
  chilled: {
    min: 2,
    max: 8,
    target: 4
  },
  controlled_ambient: {
    min: 15,
    max: 25,
    target: 20
  },
  ultra_low: {
    min: -75,
    max: -65,
    target: -70
  }
};

const VEHICLE_CLASSES = [
  'tata_407_14ft',
  'eicher_20ft',
  'bharatbenz_24ft',
  'multi_axle_32ft'
];

const HIRING_MODELS = [
  'on_call',
  'dedicated_monthly',
  'annual_contract'
];

const DIETARY_FLAGS = [
  'vegetarian',
  'non_vegetarian',
  'jain',
  'halal'
];

const parsePickupWindow = (pickupDate, timeWindow) => {
  if (!pickupDate || !timeWindow) {
    throw new Error('Pickup date and time window are required.');
  }

  // Expected: "12:00 PM – 03:00 PM"
  const parts = timeWindow.split(/\s*[–-]\s*/);

  if (parts.length !== 2) {
    throw new Error('Invalid pickup time window.');
  }

  const convertToIso = (time) => {
    const match = time.trim().match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
    );

    if (!match) {
      throw new Error('Use a time format such as 12:00 PM – 03:00 PM.');
    }

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3].toUpperCase();

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      throw new Error('Invalid pickup time.');
    }

    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    return `${pickupDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`;
  };

  const start = new Date(convertToIso(parts[0]));
  const end = new Date(convertToIso(parts[1]));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid pickup date or time.');
  }

  if (end <= start) {
    throw new Error('Pickup window end must be after start.');
  }

  if (start < new Date()) {
    throw new Error('Pickup date and time must be in the future.');
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
};

const getCityFromAddress = (address) => {
  const parts = String(address || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);

  return parts.length ? parts[parts.length - 1] : '';
};


// =====================================================
// POST /api/v1/bookings/create
// Screen 10 - API 2
// =====================================================

exports.createBooking = async (req, res, next) => {
  let client;

  try {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      });
    }

    const {
      quoteId,
      quoteToken,
      hiringModel = 'on_call',
      pickup,
      drop,
      intermediateStops = [],
      tempBandId,
      cargoLines,
      statutory,
      payment,
      termsAccepted
    } = req.body || {};

    // Basic request validation
    if (!quoteId || !quoteToken) {
      return res.status(400).json({
        code: 'QUOTE_REQUIRED',
        message: 'quoteId and quoteToken are required.'
      });
    }

    if (!HIRING_MODELS.includes(hiringModel)) {
      return res.status(400).json({
        code: 'INVALID_HIRING_MODEL',
        message: 'Invalid hiring model.'
      });
    }

    if (!pickup || !drop) {
      return res.status(400).json({
        code: 'PICKUP_AND_DROP_REQUIRED',
        message: 'Pickup and drop details are required.'
      });
    }

    if (!TEMP_BANDS[tempBandId]) {
      return res.status(400).json({
        code: 'INVALID_TEMP_BAND',
        message: 'Invalid temperature band.'
      });
    }

    if (!Array.isArray(cargoLines) || cargoLines.length === 0) {
      return res.status(400).json({
        code: 'CARGO_LINES_REQUIRED',
        message: 'At least one cargo line is required.'
      });
    }

    if (!Array.isArray(intermediateStops) || intermediateStops.length > 5) {
      return res.status(400).json({
        code: 'INVALID_INTERMEDIATE_STOPS',
        message: 'A maximum of 5 intermediate stops is allowed.'
      });
    }

    if (!statutory || !statutory.invoiceNumber ||
        !statutory.invoiceDate ||
        !Number.isSafeInteger(statutory.invoiceValueMinor) ||
        statutory.invoiceValueMinor <= 0) {
      return res.status(400).json({
        code: 'INVALID_STATUTORY_DETAILS',
        message: 'Valid invoice number, date and value are required.'
      });
    }

    if (!payment || !payment.terms) {
      return res.status(400).json({
        code: 'PAYMENT_TERMS_REQUIRED',
        message: 'Payment terms are required.'
      });
    }

    if (termsAccepted !== true) {
      return res.status(400).json({
        code: 'TERMS_NOT_ACCEPTED',
        message: 'You must accept the booking terms.'
      });
    }

    const requiredPickupFields = [
      'address',
      'pincode',
      'contactPerson',
      'contactPhone',
      'pickupDate',
      'timeWindow'
    ];

    for (const field of requiredPickupFields) {
      if (!pickup[field]) {
        return res.status(400).json({
          code: 'PICKUP_FIELD_REQUIRED',
          field,
          message: `Pickup ${field} is required.`
        });
      }
    }

    const requiredDropFields = [
      'address',
      'pincode',
      'consigneeName',
      'consigneePhone'
    ];

    for (const field of requiredDropFields) {
      if (!drop[field]) {
        return res.status(400).json({
          code: 'DROP_FIELD_REQUIRED',
          field,
          message: `Drop ${field} is required.`
        });
      }
    }

    if (!/^\d{6}$/.test(pickup.pincode) ||
        !/^\d{6}$/.test(drop.pincode)) {
      return res.status(400).json({
        code: 'INVALID_PINCODE',
        message: 'Pickup and drop pincodes must be 6 digits.'
      });
    }

    const phoneRegex = /^\+?[1-9]\d{9,14}$/;

    if (!phoneRegex.test(pickup.contactPhone) ||
        !phoneRegex.test(drop.consigneePhone)) {
      return res.status(400).json({
        code: 'INVALID_CONTACT_NUMBER',
        message: 'Enter valid pickup and consignee phone numbers.'
      });
    }

    if (statutory.ewayBillOption &&
        !['existing', 'generate_via_app', 'not_required'].includes(
          statutory.ewayBillOption
        )) {
      return res.status(400).json({
        code: 'INVALID_EWAY_BILL_OPTION',
        message: 'Invalid e-way bill option.'
      });
    }

    for (let i = 0; i < cargoLines.length; i++) {
      const cargo = cargoLines[i];

      if (
        !cargo.category ||
        !cargo.description ||
        !cargo.packagingType ||
        !Number.isInteger(cargo.quantityCartons) ||
        cargo.quantityCartons <= 0 ||
        !Number.isFinite(Number(cargo.weightKg)) ||
        Number(cargo.weightKg) <= 0 ||
        !Number.isSafeInteger(cargo.declaredValueMinor) ||
        cargo.declaredValueMinor < 0 ||
        !DIETARY_FLAGS.includes(cargo.dietaryFlag)
      ) {
        return res.status(400).json({
          code: 'INVALID_CARGO_LINE',
          lineNumber: i + 1,
          message: 'One or more cargo line details are invalid.'
        });
      }

      if (!Array.isArray(cargo.allergens)) {
        return res.status(400).json({
          code: 'INVALID_ALLERGENS',
          lineNumber: i + 1,
          message: 'allergens must be an array.'
        });
      }
    }

    const pickupWindow = parsePickupWindow(
      pickup.pickupDate,
      pickup.timeWindow
    );

    const temp = TEMP_BANDS[tempBandId];

    client = await db.pool.connect();
    await client.query('BEGIN');

    // Find logged-in customer's profile
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

    // Validate quote ownership, token and expiry
    const quoteResult = await client.query(
      `SELECT *
       FROM booking_quotes
       WHERE quote_ref = $1
         AND customer_id = $2
         AND quote_token_hash = $3
         AND expires_at > NOW()
         AND used_at IS NULL
       FOR UPDATE`,
      [quoteId, customerId, hashValue(quoteToken)]
    );

    if (!quoteResult.rows.length) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        code: 'INVALID_OR_EXPIRED_QUOTE',
        message: 'Quote is invalid, expired, already used, or does not belong to this customer. Generate a new quote.'
      });
    }

    const quote = quoteResult.rows[0];

    if (quote.temp_band !== tempBandId) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        code: 'QUOTE_TEMP_BAND_MISMATCH',
        message: 'Temperature band does not match the selected quote.'
      });
    }

    // Annual contract must be active and belong to this customer
    let contractId = null;

    if (hiringModel === 'annual_contract') {
      const contractResult = await client.query(
        `SELECT id
         FROM master_contracts
         WHERE customer_id = $1
           AND status = 'active'
           AND start_date <= CURRENT_DATE
           AND end_date >= CURRENT_DATE
           AND remaining_volume_trips > 0
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [customerId]
      );

      if (!contractResult.rows.length) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          code: 'ACTIVE_CONTRACT_REQUIRED',
          message: 'No active annual contract with remaining trips was found.'
        });
      }

      contractId = contractResult.rows[0].id;
    }

    // Business credit check when requested
    if (payment.terms === 'business_credit') {
      const creditResult = await client.query(
        `SELECT credit_limit_minor, utilised_credit_minor
         FROM credit_accounts
         WHERE customer_id = $1
           AND status = 'approved'
         ORDER BY approved_at DESC NULLS LAST
         LIMIT 1
         FOR UPDATE`,
        [customerId]
      );

      if (!creditResult.rows.length) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          code: 'CREDIT_NOT_APPROVED',
          message: 'This customer does not have an approved business credit account.'
        });
      }

      const credit = creditResult.rows[0];
      const available =
        Number(credit.credit_limit_minor) -
        Number(credit.utilised_credit_minor);

      if (available < Number(quote.fare_total_minor)) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          code: 'INSUFFICIENT_CREDIT',
          message: 'Available credit is not enough for this booking.'
        });
      }
    }

    const bookingRef = generateCode('CR');
    const lrNumber = generateCode('LR');
    const deliveryOtp = generateOtp();
    const shareToken = generateShareToken();

    const cityOrigin = pickup.city || getCityFromAddress(pickup.address);
    const cityDestination = drop.city || getCityFromAddress(drop.address);

    if (!cityOrigin || !cityDestination) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        code: 'CITY_REQUIRED',
        message: 'Include the city in pickup and drop address, or provide pickup.city and drop.city.'
      });
    }

    const ewayBillNumber =
      statutory.ewayBillOption === 'existing'
        ? statutory.ewayBillNumber || null
        : null;

    if (
      statutory.ewayBillOption === 'existing' &&
      !ewayBillNumber
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        code: 'EWAY_BILL_NUMBER_REQUIRED',
        message: 'Provide ewayBillNumber when using an existing e-way bill.'
      });
    }

    const paymentMethod = payment.terms;

    const bookingResult = await client.query(
      `INSERT INTO bookings (
        booking_ref,
        customer_id,
        hiring_model,
        contract_id,
        vehicle_class,
        temp_band,
        sla_min_temp_c,
        sla_max_temp_c,
        target_setpoint_c,

        origin_city,
        origin_address,
        origin_pincode,
        origin_contact_name,
        origin_contact_phone,
        origin_access_instructions,
        pickup_window_start,
        pickup_window_end,

        destination_city,
        destination_address,
        destination_pincode,
        destination_contact_name,
        destination_contact_phone,
        consignee_gstin,

        status,
        sub_status_label,
        lr_number,
        eway_bill_number,

        delivery_otp_hash,
        share_token,
        share_token_expires_at,

        total_distance_km,

        fare_base_minor,
        fare_reefer_surcharge_minor,
        fare_multistop_minor,
        fare_tolls_minor,
        fare_gst_minor,
        fare_total_minor,

        payment_method,
        payment_status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23,
        'searching', 'SEARCHING REEFER', $24, $25,
        $26, $27, $28, $29,
        $30, $31, $32, $33, $34, $35, $36, $37
      )
      RETURNING id, booking_ref, lr_number, status`,
      [
        bookingRef,
        customerId,
        hiringModel,
        contractId,
        quote.vehicle_class,
        tempBandId,
        quote.sla_min_temp_c,
        quote.sla_max_temp_c,
        quote.target_setpoint_c,

        cityOrigin,
        pickup.address,
        pickup.pincode,
        pickup.contactPerson,
        pickup.contactPhone,
        pickup.accessInstructions || null,
        pickupWindow.start,
        pickupWindow.end,

        cityDestination,
        drop.address,
        drop.pincode,
        drop.consigneeName,
        drop.consigneePhone,
        drop.consigneeGstin || null,

        lrNumber,
        ewayBillNumber,

        hashValue(deliveryOtp),
        shareToken,
        new Date(Date.now() + 24 * 60 * 60 * 1000),

        quote.total_distance_km,

        quote.fare_base_minor,
        quote.fare_reefer_surcharge_minor,
        quote.fare_multistop_minor,
        quote.fare_tolls_minor,
        quote.fare_gst_minor,
        quote.fare_total_minor,

        paymentMethod,
        payment.terms === 'business_credit' ? 'authorized' : 'pending'
      ]
    );

    const booking = bookingResult.rows[0];

    // Insert cargo lines
    for (const cargo of cargoLines) {
      await client.query(
        `INSERT INTO cargo_lines (
          booking_id,
          category,
          description,
          packaging_type,
          quantity_cartons,
          weight_kg,
          declared_value_minor,
          dietary_flag,
          allergens
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          booking.id,
          cargo.category,
          cargo.description,
          cargo.packagingType,
          cargo.quantityCartons,
          cargo.weightKg,
          cargo.declaredValueMinor,
          cargo.dietaryFlag,
          cargo.allergens
        ]
      );
    }

    // Insert optional intermediate stops
    for (let i = 0; i < intermediateStops.length; i++) {
      const stop = intermediateStops[i];

      if (
        !stop.address ||
        !stop.pincode ||
        !stop.contactPerson ||
        !stop.contactPhone
      ) {
        throw new Error(`Intermediate stop ${i + 1} is missing required details.`);
      }

      await client.query(
        `INSERT INTO booking_stops (
          booking_id,
          sequence_no,
          stop_label,
          stop_type,
          address,
          pincode,
          contact_name,
          contact_phone,
          gate_dock_number,
          latitude,
          longitude
        )
        VALUES ($1, $2, $3, 'drop', $4, $5, $6, $7, $8, $9, $10)`,
        [
          booking.id,
          i + 1,
          `S${i + 1}`,
          stop.address,
          stop.pincode,
          stop.contactPerson,
          stop.contactPhone,
          stop.gateDockNumber || null,
          stop.latitude || null,
          stop.longitude || null
        ]
      );
    }

    // Mark quote as used
    await client.query(
      `UPDATE booking_quotes
       SET used_at = NOW()
       WHERE id = $1`,
      [quote.id]
    );

    // Consume one trip from annual contract
    if (contractId) {
      await client.query(
        `UPDATE master_contracts
         SET remaining_volume_trips = remaining_volume_trips - 1
         WHERE id = $1`,
        [contractId]
      );
    }

    await client.query('COMMIT');

    // The OTP must be sent through an SMS provider.
    // Do not return the delivery OTP in the production API response.

    return res.status(201).json({
      bookingId: booking.id,
      bookingNumber: booking.booking_ref,
      lrNumber: booking.lr_number,
      status: 'searching_driver',
      dispatchWave: {
        waveNumber: 1,
        timerSeconds: 90,
        eligibleDriversCount: 0
      },
      nextScreen: 'searching'
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    if (
      error.message &&
      (
        error.message.includes('Pickup') ||
        error.message.includes('pickup') ||
        error.message.includes('Intermediate stop')
      )
    ) {
      return res.status(400).json({
        code: 'INVALID_BOOKING_DETAILS',
        message: error.message
      });
    }

    next(error);

  } finally {
    if (client) client.release();
  }
};