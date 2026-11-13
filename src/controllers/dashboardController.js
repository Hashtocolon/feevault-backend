const db = require('../config/db');

const getUserId = (req) => {
  return req.user?.userId || req.user?.id;
};

const ACTIVE_STATUSES = [
  'searching',
  'assigned',
  'pre_cooling',
  'at_pickup',
  'loading',
  'in_transit',
  'at_checkpoint',
  'at_delivery'
];

const formatINR = (minor) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(minor || 0) / 100);
};

const formatCompactINR = (minor) => {
  const amount = Number(minor || 0) / 100;

  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2).replace(/\.?0+$/, '')}L`;
  }

  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1).replace(/\.?0+$/, '')}K`;
  }

  return formatINR(minor);
};

const percentageChange = (current, previous) => {
  if (!Number(previous)) {
    return Number(current) > 0 ? 100 : 0;
  }

  return Number(
    (((Number(current) - Number(previous)) / Number(previous)) * 100).toFixed(1)
  );
};

const direction = (value) => {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'same';
};


// =====================================================
// API 1: GET /api/v1/dashboard/summary
// =====================================================

exports.getDashboardSummary = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      });
    }

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

    // Active shipment count and weekly comparison
    const shipmentStatsResult = await db.query(
      `SELECT
        COUNT(*) FILTER (
          WHERE status IN (
            'searching', 'assigned', 'pre_cooling',
            'at_pickup', 'loading', 'in_transit',
            'at_checkpoint', 'at_delivery'
          )
        )::INT AS active_count,

        COUNT(*) FILTER (
          WHERE status IN (
            'searching', 'assigned', 'pre_cooling',
            'at_pickup', 'loading', 'in_transit',
            'at_checkpoint', 'at_delivery'
          )
          AND created_at >= NOW() - INTERVAL '7 days'
        )::INT AS active_this_week,

        COUNT(*) FILTER (
          WHERE status IN (
            'searching', 'assigned', 'pre_cooling',
            'at_pickup', 'loading', 'in_transit',
            'at_checkpoint', 'at_delivery'
          )
          AND created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days'
        )::INT AS active_last_week,

        COUNT(*) FILTER (
          WHERE status = 'searching'
        )::INT AS searching_count,

        COUNT(*) FILTER (
          WHERE status = 'pre_cooling'
        )::INT AS precooling_count,

        COUNT(*) FILTER (
          WHERE status = 'at_delivery'
        )::INT AS pending_pod_count

       FROM bookings
       WHERE customer_id = $1`,
      [customerId]
    );

    const shipmentStats = shipmentStatsResult.rows[0];

    // Monthly spend: count only completed payment statuses
    const spendResult = await db.query(
      `SELECT
        COALESCE(SUM(fare_total_minor) FILTER (
          WHERE created_at >= date_trunc('month', CURRENT_DATE)
            AND payment_status IN ('paid', 'captured', 'settled')
        ), 0)::BIGINT AS spend_this_month,

        COALESCE(SUM(fare_total_minor) FILTER (
          WHERE created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            AND created_at < date_trunc('month', CURRENT_DATE)
            AND payment_status IN ('paid', 'captured', 'settled')
        ), 0)::BIGINT AS spend_last_month

       FROM bookings
       WHERE customer_id = $1`,
      [customerId]
    );

    const spend = spendResult.rows[0];
    const spendThisMonth = Number(spend.spend_this_month || 0);
    const spendLastMonth = Number(spend.spend_last_month || 0);
    const spendChange = percentageChange(spendThisMonth, spendLastMonth);

    // Credit account summary
    const creditResult = await db.query(
      `SELECT
        COALESCE(SUM(credit_limit_minor), 0)::BIGINT AS credit_limit,
        COALESCE(SUM(utilised_credit_minor), 0)::BIGINT AS utilised_credit,
        BOOL_OR(status = 'approved') AS has_credit_line
       FROM credit_accounts
       WHERE customer_id = $1`,
      [customerId]
    );

    const credit = creditResult.rows[0];
    const hasCreditLine = credit.has_credit_line === true;
    const creditLimit = hasCreditLine ? Number(credit.credit_limit || 0) : 0;
    const utilisedCredit = hasCreditLine
      ? Number(credit.utilised_credit || 0)
      : 0;

    const availableCredit = Math.max(creditLimit - utilisedCredit, 0);

    const utilisedPercentage = creditLimit > 0
      ? Number(((utilisedCredit / creditLimit) * 100).toFixed(1))
      : 0;

    // On-time delivery: compare e-POD creation time with scheduled ETA
    const onTimeResult = await db.query(
      `SELECT
        COUNT(*) FILTER (
          WHERE b.created_at >= date_trunc('month', CURRENT_DATE)
        )::INT AS delivered_this_month,

        COUNT(*) FILTER (
          WHERE b.created_at >= date_trunc('month', CURRENT_DATE)
            AND e.created_at <= b.scheduled_delivery_eta
        )::INT AS on_time_this_month,

        COUNT(*) FILTER (
          WHERE b.created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            AND b.created_at < date_trunc('month', CURRENT_DATE)
        )::INT AS delivered_last_month,

        COUNT(*) FILTER (
          WHERE b.created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            AND b.created_at < date_trunc('month', CURRENT_DATE)
            AND e.created_at <= b.scheduled_delivery_eta
        )::INT AS on_time_last_month

       FROM bookings b
       INNER JOIN epods e ON e.booking_id = b.id
       WHERE b.customer_id = $1
         AND b.status = 'delivered'`,
      [customerId]
    );

    const onTime = onTimeResult.rows[0];

    const deliveredThisMonth = Number(onTime.delivered_this_month || 0);
    const onTimeThisMonth = Number(onTime.on_time_this_month || 0);
    const deliveredLastMonth = Number(onTime.delivered_last_month || 0);
    const onTimeLastMonth = Number(onTime.on_time_last_month || 0);

    const onTimePercentage = deliveredThisMonth > 0
      ? Number(((onTimeThisMonth / deliveredThisMonth) * 100).toFixed(1))
      : 0;

    const lastMonthOnTimePercentage = deliveredLastMonth > 0
      ? (onTimeLastMonth / deliveredLastMonth) * 100
      : 0;

    const onTimeChange = Number(
      (onTimePercentage - lastMonthOnTimePercentage).toFixed(1)
    );

    // Count temperature alerts using the latest snapshot per booking
    const temperatureResult = await db.query(
      `SELECT COUNT(*)::INT AS temperature_alerts
       FROM bookings b
       JOIN LATERAL (
         SELECT chamber_temp_c
         FROM telematics_snapshots ts
         WHERE ts.booking_id = b.id
         ORDER BY ts.recorded_at DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE b.customer_id = $1
         AND b.status IN (
           'assigned', 'pre_cooling', 'at_pickup',
           'loading', 'in_transit', 'at_checkpoint', 'at_delivery'
         )
         AND (
           latest.chamber_temp_c < b.sla_min_temp_c
           OR latest.chamber_temp_c > b.sla_max_temp_c
         )`,
      [customerId]
    );

    const temperatureAlerts = Number(
      temperatureResult.rows[0].temperature_alerts || 0
    );

    const activeThisWeek = Number(shipmentStats.active_this_week || 0);
    const activeLastWeek = Number(shipmentStats.active_last_week || 0);
    const activeChange = activeThisWeek - activeLastWeek;

    return res.status(200).json({
      activeShipmentsCount: Number(shipmentStats.active_count || 0),

      activeShipmentsTrend: {
        changeCount: activeChange,
        direction: direction(activeChange),
        comparedTo: 'last_week'
      },

      spendThisMonthMinor: spendThisMonth,
      spendThisMonthFormatted: formatCompactINR(spendThisMonth),

      spendChangeTrend: {
        changePercentage: Math.abs(spendChange),
        direction: direction(spendChange),
        comparedTo: 'last_month'
      },

      onTimeCompliancePercentage: onTimePercentage,

      onTimeTrend: {
        changePercentage: Math.abs(onTimeChange),
        direction: direction(onTimeChange),
        comparedTo: 'last_month'
      },

      creditSummary: {
        hasCreditLine,
        creditLimitMinor: creditLimit,
        utilisedCreditMinor: utilisedCredit,
        availableCreditMinor: availableCredit,
        utilisedPercentage,
        utilisedFormatted: formatCompactINR(utilisedCredit),
        limitFormatted: formatCompactINR(creditLimit),
        availableFormatted: formatCompactINR(availableCredit)
      },

      alerts: {
        searchingVehiclesCount: Number(shipmentStats.searching_count || 0),
        preCoolingInProgressCount: Number(shipmentStats.precooling_count || 0),
        temperatureAlertsCount: temperatureAlerts,
        pendingPodOtpCount: Number(shipmentStats.pending_pod_count || 0)
      }
    });

  } catch (error) {
    next(error);
  }
};


// =====================================================
// API 2: GET /api/v1/shipments/active
// =====================================================

exports.getActiveShipments = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      });
    }

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 5, 1),
      20
    );

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

    const result = await db.query(
      `SELECT
        b.id,
        b.booking_ref,
        b.origin_city,
        b.destination_city,
        b.temp_band,
        b.sla_min_temp_c,
        b.sla_max_temp_c,
        b.target_setpoint_c,
        b.status,
        b.sub_status_label,
        b.scheduled_delivery_eta,
        b.digital_seal_number,
        b.is_seal_locked,
        b.share_token,

        latest.chamber_temp_c,
        latest.recorded_at,
        latest.iot_source,

        d.full_name AS driver_name,
        d.mobile_number AS driver_mobile,
        d.hygiene_grade,

        v.registration_number,
        v.vehicle_class

       FROM bookings b

       LEFT JOIN drivers d
         ON d.id = b.assigned_driver_id

       LEFT JOIN vehicles v
         ON v.id = b.assigned_vehicle_id

       LEFT JOIN LATERAL (
         SELECT
           ts.chamber_temp_c,
           ts.recorded_at,
           ts.iot_source
         FROM telematics_snapshots ts
         WHERE ts.booking_id = b.id
         ORDER BY ts.recorded_at DESC
         LIMIT 1
       ) latest ON TRUE

       WHERE b.customer_id = $1
         AND b.status IN (
           'in_transit',
           'at_checkpoint',
           'at_delivery'
         )

       ORDER BY
         latest.recorded_at DESC NULLS LAST,
         b.scheduled_delivery_eta ASC NULLS LAST

       LIMIT $2`,
      [customerId, limit]
    );

    const shipments = result.rows.map((row) => {
      const currentTemp = row.chamber_temp_c === null
        ? null
        : Number(row.chamber_temp_c);

      let tempStatus = 'unknown';

      if (currentTemp !== null) {
        tempStatus =
          currentTemp < Number(row.sla_min_temp_c) ||
          currentTemp > Number(row.sla_max_temp_c)
            ? 'alert'
            : 'safe';
      }

      const tempLabels = {
        deep_frozen: 'FROZEN',
        chilled: 'CHILLED',
        controlled_ambient: 'CONTROLLED AMBIENT',
        ultra_low: 'ULTRA LOW'
      };

      const bandLabel = tempLabels[row.temp_band] || row.temp_band;

      const minTemp = Number(row.sla_min_temp_c);
      const maxTemp = Number(row.sla_max_temp_c);

      let tempBandBadge;

      if (row.temp_band === 'deep_frozen') {
        tempBandBadge = `${bandLabel} ${maxTemp}°C`;
      } else if (row.temp_band === 'chilled') {
        tempBandBadge = `${bandLabel} ${minTemp}°C TO ${maxTemp}°C`;
      } else {
        tempBandBadge = `${bandLabel} ${minTemp}°C TO ${maxTemp}°C`;
      }

      let etaFormatted = null;

      if (row.scheduled_delivery_eta) {
        etaFormatted = new Date(row.scheduled_delivery_eta)
          .toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
      }

      const dataFreshnessSeconds = row.recorded_at
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(row.recorded_at).getTime()) / 1000
            )
          )
        : null;

      const hygieneGrade = row.hygiene_grade
        ? row.hygiene_grade.replace('grade_', '').toUpperCase()
        : null;

      const maskedPhone = row.driver_mobile
        ? row.driver_mobile.replace(
            /^(\+?\d{2}\s?)?(\d{2})\d+(\d{3})$/,
            (_, prefix = '', first, last) => `${prefix}${first}XXX XX${last}`
          )
        : null;

      return {
        id: row.id,
        shipmentNumber: row.booking_ref,
        origin: row.origin_city,
        destination: row.destination_city,
        tempBandBadge,
        currentTempC: currentTemp,
        tempStatus,
        status: row.status,
        statusLabel: row.sub_status_label || row.status.replace(/_/g, ' ').toUpperCase(),

        eta: row.scheduled_delivery_eta,
        etaFormatted,

        telematics: {
          dataFreshnessSeconds,
          isDualSyncActive: row.iot_source === 'dual',
          digitalSealNumber: row.digital_seal_number,
          isSealLocked: row.is_seal_locked
        },

        driver: row.driver_name
          ? {
              name: row.driver_name,
              vehicleNumber: row.registration_number,
              vehicleClass: row.vehicle_class,
              phoneMasked: maskedPhone,
              hygieneGrade
            }
          : null,

        consigneeShareUrl: row.share_token
          ? `${process.env.CONSIGNEE_BASE_URL || 'https://crte.in/t'}/${row.share_token}`
          : null,

        actions: ['live_tracking', 'consignee_link']
      };
    });

    // Count all active shipments, not only the limited cards
    const countResult = await db.query(
      `SELECT COUNT(*)::INT AS total
       FROM bookings
       WHERE customer_id = $1
         AND status IN (
           'in_transit',
           'at_checkpoint',
           'at_delivery'
         )`,
      [customerId]
    );

    return res.status(200).json({
      totalActiveCount: Number(countResult.rows[0].total || 0),
      shipments
    });

  } catch (error) {
    next(error);
  }
};