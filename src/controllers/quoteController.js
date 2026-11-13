const db = require('../config/db');
const crypto = require('crypto');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

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

// Temporary testing prices in paise.
// Replace these with your actual pricing engine.
const TEST_RATES = {
  base: 2850000,
  reefer: 480000,
  precooling: 120000,
  tolls: 245000,
  gstPercent: 18
};

exports.generateQuote = async (req, res, next) => {
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
      originPincode,
      destinationPincode,
      vehicleClassId,
      tempBandId,
      totalWeightKg,
      intermediateStopsCount = 0
    } = req.body;

    if (
      !/^\d{6}$/.test(originPincode || '') ||
      !/^\d{6}$/.test(destinationPincode || '')
    ) {
      return res.status(400).json({
        code: 'INVALID_PINCODE',
        message: 'Enter valid 6-digit pickup and destination pincodes.'
      });
    }

    if (!VEHICLE_CLASSES.includes(vehicleClassId)) {
      return res.status(400).json({
        code: 'INVALID_VEHICLE_CLASS',
        message: 'Invalid vehicle class.'
      });
    }

    const temp = TEMP_BANDS[tempBandId];

    if (!temp) {
      return res.status(400).json({
        code: 'INVALID_TEMP_BAND',
        message: 'Invalid temperature band.'
      });
    }

    if (!Number.isFinite(Number(totalWeightKg)) || Number(totalWeightKg) <= 0) {
      return res.status(400).json({
        code: 'INVALID_WEIGHT',
        message: 'Total weight must be greater than zero.'
      });
    }

    if (
      !Number.isInteger(intermediateStopsCount) ||
      intermediateStopsCount < 0 ||
      intermediateStopsCount > 5
    ) {
      return res.status(400).json({
        code: 'INVALID_STOPS_COUNT',
        message: 'Intermediate stops must be between 0 and 5.'
      });
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
        message: 'Complete your customer profile first.'
      });
    }

    const customerId = profileResult.rows[0].id;

    // Temporary testing calculation.
    const base = TEST_RATES.base;
    const reefer = TEST_RATES.reefer;
    const precooling = TEST_RATES.precooling;
    const tolls = TEST_RATES.tolls;

    const subtotal = base + reefer + precooling + tolls;
    const gst = Math.round(subtotal * TEST_RATES.gstPercent / 100);
    const total = subtotal + gst;

    const lineItems = [
      {
        label: 'Base FTL Freight',
        amountMinor: base
      },
      {
        label: 'Reefer Cooling Fuel Surcharge',
        amountMinor: reefer
      },
      {
        label: 'Pre-Cooling & Dual IoT Hardware Fee',
        amountMinor: precooling
      },
      {
        label: 'FASTag National Tolls',
        amountMinor: tolls
      },
      {
        label: 'GST @ 18%',
        amountMinor: gst
      }
    ];

    const quoteId =
      'qte_' + crypto.randomBytes(8).toString('hex');

    const quoteToken =
      'tok_lock_' + crypto.randomBytes(24).toString('hex');

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await client.query(
      `INSERT INTO booking_quotes (
        quote_ref,
        customer_id,
        quote_token_hash,
        vehicle_class,
        temp_band,
        sla_min_temp_c,
        sla_max_temp_c,
        target_setpoint_c,
        total_weight_kg,
        fare_base_minor,
        fare_reefer_surcharge_minor,
        fare_multistop_minor,
        fare_tolls_minor,
        fare_gst_minor,
        fare_total_minor,
        expires_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16
      )`,
      [
        quoteId,
        customerId,
        hashToken(quoteToken),
        vehicleClassId,
        tempBandId,
        temp.min,
        temp.max,
        temp.target,
        totalWeightKg,
        base,
        reefer,
        intermediateStopsCount * 0,
        tolls,
        gst,
        total,
        expiresAt
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      quoteId,
      quoteToken,
      expiresInSeconds: 900,
      currency: 'INR',
      lineItems: lineItems.map(item => ({
        ...item,
        formatted: `₹${(item.amountMinor / 100).toLocaleString('en-IN')}`
      })),
      totalAmountMinor: total,
      totalAmountFormatted:
        `₹${(total / 100).toLocaleString('en-IN')}`
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