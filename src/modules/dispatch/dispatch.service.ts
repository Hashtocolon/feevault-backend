import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  interval,
  from,
  startWith,
  concatMap,
  takeWhile,
} from 'rxjs';
import { DatabaseService } from '../../database/database.service';
import * as crypto from 'crypto';

@Injectable()
export class DispatchService {
  constructor(private readonly db: DatabaseService) { }

  private async resolveBooking(bookingId: string, userId?: string) {
    if (!bookingId) return null;

    // 1. Try finding in bookings by id
    const byId = await this.db.query(
      `SELECT b.*, d.user_id AS driver_user_id
       FROM bookings b
       LEFT JOIN drivers d ON d.id = b.assigned_driver_id
       WHERE b.id::text = $1
       LIMIT 1`,
      [bookingId],
    );
    if (byId.rows.length) return byId.rows[0];

    // 2. Try finding in booking_quotes by id or quote_id
    const byQuote = await this.db.query(
      `SELECT bq.*, bq.quote_ref AS booking_ref
       FROM booking_quotes bq
       WHERE bq.id::text = $1 OR bq.quote_id::text = $1
       LIMIT 1`,
      [bookingId],
    );
    if (byQuote.rows.length) return byQuote.rows[0];

    return null;
  }

  async getDispatchStatus(bookingId: string, userId: string) {
    const booking = await this.resolveBooking(bookingId, userId);
    if (!booking) {
      throw new NotFoundException('Booking was not found.');
    }

    const details = await this.db.query(
      `SELECT
         b.id,
         b.booking_ref,
         b.status::text AS booking_status,
         b.created_at,
         b.assigned_driver_id,
         b.assigned_vehicle_id,
         b.target_setpoint_c,
         b.is_precooling_passed,
         d.id AS driver_id,
         d.full_name AS driver_name,
         d.mobile_number AS driver_phone,
         d.avatar_url AS driver_photo,
         d.hygiene_grade::text AS hygiene_grade,
         d.average_rating,
         d.trips_completed,
         v.registration_number,
         v.vehicle_class::text AS vehicle_class,
         ts.chamber_temp_c
       FROM bookings b
       LEFT JOIN drivers d ON d.id = b.assigned_driver_id
       LEFT JOIN vehicles v ON v.id = b.assigned_vehicle_id
       LEFT JOIN LATERAL (
         SELECT chamber_temp_c
         FROM telematics_snapshots
         WHERE booking_id = b.id
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ts ON TRUE
       WHERE b.id::text = $1
       LIMIT 1`,
      [booking.id],
    );

    const b = details.rows[0] || booking;
    let status = b.booking_status || b.status;
    if (status === 'searching') status = 'searching_driver';
    if (status === 'assigned') status = 'driver_assigned';

    let timeRemainingSeconds = 0;
    if (b.booking_status === 'searching' && b.created_at) {
      const elapsed = Math.floor((Date.now() - new Date(b.created_at).getTime()) / 1000);
      timeRemainingSeconds = Math.max(0, 90 - elapsed);
    }

    let assignedDriver: any = null;
    if (b.assigned_driver_id && b.driver_name) {
      assignedDriver = {
        id: b.driver_id || b.assigned_driver_id,
        name: b.driver_name,
        phone: b.driver_phone,
        photoUrl: b.driver_photo,
        hygieneGrade: b.hygiene_grade,
        rating: b.average_rating ? Number(b.average_rating) : 4.8,
        tripsCompleted: b.trips_completed ? Number(b.trips_completed) : 0,
        vehicle: {
          registrationNumber: b.registration_number,
          vehicleClass: b.vehicle_class,
        },
      };
    }

    return {
      status,
      bookingRef: b.booking_ref,
      timeRemainingSeconds,
      eligibleDriversCount: assignedDriver ? 1 : 0,
      assignedDriver,
      chamberTempC: b.chamber_temp_c !== undefined ? b.chamber_temp_c : null,
      targetSetpointC: b.target_setpoint_c,
      isPrecoolingPassed: b.is_precooling_passed,
    };
  }

  async cancelBooking(bookingId: string, reason: string, userId: string) {
    const booking = await this.resolveBooking(bookingId, userId);
    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    await this.db.query(
      `UPDATE bookings
       SET status = 'cancelled', cancellation_reason = $1, cancelled_at = NOW(), updated_at = NOW()
       WHERE id::text = $2`,
      [reason || 'Cancelled by customer', booking.id],
    );

    return {
      success: true,
      bookingId: booking.id,
      bookingRef: booking.booking_ref,
      status: 'cancelled',
      message: 'Booking cancelled successfully.',
    };
  }

  async escalateOps(bookingId: string, reason: string, note: string, userId: string) {
    const booking = await this.resolveBooking(bookingId, userId);
    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    try {
      await this.db.query(
        `INSERT INTO ops_escalations (booking_id, raised_by, reason, note, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [booking.id, userId, reason || 'Escalation raised', note || null],
      );
    } catch (e: any) {
      console.warn('ops_escalations insert notice:', e.message);
    }

    return {
      success: true,
      bookingId: booking.id,
      bookingRef: booking.booking_ref,
      message: 'Escalation raised with ColdRoute operations desk.',
    };
  }

  async getBookingConfirmation(bookingId: string, userId: string) {
    if (!bookingId) {
      throw new BadRequestException('A valid booking ID is required.');
    }

    // 1. Try finding in bookings table first
    const confRes = await this.db.query(
      `SELECT
         b.id,
         b.booking_ref,
         b.lr_number,
         b.status,
         b.sub_status_label,
         b.target_setpoint_c,
         b.is_precooling_passed,
         b.precooling_verified_temp_c,
         b.pickup_window_start,
         d.id AS driver_id,
         d.full_name AS driver_name,
         d.avatar_url,
         d.hygiene_grade,
         d.average_rating,
         d.trips_completed,
         v.registration_number,
         v.vehicle_class,
         ts.chamber_temp_c,
         ts.probe_temp_c,
         ts.recorded_at
       FROM bookings b
       LEFT JOIN drivers d ON d.id = b.assigned_driver_id
       LEFT JOIN vehicles v ON v.id = b.assigned_vehicle_id
       LEFT JOIN LATERAL (
         SELECT chamber_temp_c, probe_temp_c, recorded_at
         FROM telematics_snapshots
         WHERE booking_id = b.id
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ts ON TRUE
       WHERE b.id::text = $1`,
      [bookingId],
    );

    if (confRes.rows.length) {
      const row = confRes.rows[0];
      return {
        bookingId: row.id,
        bookingRef: row.booking_ref,
        lrNumber: row.lr_number,
        status: row.status,
        subStatusLabel: row.sub_status_label,
        targetSetpointC: row.target_setpoint_c,
        isPrecoolingPassed: row.is_precooling_passed,
        precoolingVerifiedTempC: row.precooling_verified_temp_c,
        pickupWindowStart: row.pickup_window_start,
        driver: row.driver_name
          ? {
            id: row.driver_id,
            name: row.driver_name,
            avatarUrl: row.avatar_url,
            hygieneGrade: row.hygiene_grade,
            averageRating: row.average_rating ? Number(row.average_rating) : 4.8,
            tripsCompleted: row.trips_completed ? Number(row.trips_completed) : 0,
          }
          : null,
        vehicle: row.registration_number
          ? {
            registrationNumber: row.registration_number,
            vehicleClass: row.vehicle_class,
          }
          : null,
        latestTelematics:
          row.chamber_temp_c !== undefined
            ? {
              chamberTempC: row.chamber_temp_c,
              probeTempC: row.probe_temp_c,
              recordedAt: row.recorded_at,
            }
            : null,
      };
    }

    // 2. Fallback to booking_quotes table
    const quoteRes = await this.db.query(
      `SELECT bq.*, bq.quote_ref AS booking_ref
       FROM booking_quotes bq
       WHERE bq.id::text = $1 OR bq.quote_id::text = $1`,
      [bookingId],
    );

    if (!quoteRes.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    const q = quoteRes.rows[0];
    return {
      bookingId: q.id,
      bookingRef: q.booking_ref,
      status: q.status,
      driver: null,
      vehicle: null,
      latestTelematics: null,
    };
  }

  async generateAgoraToken(bookingId: string, userId: string) {
    const booking = await this.resolveBooking(bookingId, userId);
    if (!booking) {
      throw new NotFoundException('Booking not found for this customer.');
    }

    const channelName =
      'call_trip_' + String(booking.booking_ref || bookingId).replace(/[^a-zA-Z0-9]/g, '');

    const getAgoraUid = (id: string) => {
      const hash = crypto.createHash('sha256').update(String(id)).digest();
      return hash.readUInt32BE(0) || 1;
    };

    const uid = getAgoraUid(userId || 'customer');
    const peerUid = booking.driver_user_id
      ? getAgoraUid(booking.driver_user_id)
      : (uid === 10001 ? 10002 : 10001);

    const appId = process.env.AGORA_APP_ID || 'agora-app-id-dev-placeholder';
    const expiresInSeconds = 3600;

    const tokenPayload = `${appId}:${channelName}:${uid}:${Date.now() + expiresInSeconds * 1000}`;
    const rtcToken = Buffer.from(tokenPayload).toString('base64');

    return {
      agoraAppId: appId,
      channelName,
      rtcToken,
      uid,
      peerUid,
      expiresInSeconds,
    };
  }

  async getChatMessages(bookingId: string, userId: string) {
    const booking = await this.resolveBooking(bookingId, userId);
    if (!booking) {
      throw new NotFoundException('Booking not found for this customer.');
    }

    let messages: any[] = [];
    try {
      const msgRes = await this.db.query(
        `SELECT
           m.id,
           m.sender_type,
           m.message_text,
           m.sent_at,
           CASE
             WHEN LOWER(m.sender_type) = 'driver' THEN COALESCE(d.full_name, 'Driver')
             ELSE 'Customer'
           END AS sender_name
         FROM trip_chat_messages m
         LEFT JOIN bookings b ON b.id = m.booking_id
         LEFT JOIN drivers d ON d.id = b.assigned_driver_id
         WHERE m.booking_id = $1
         ORDER BY m.sent_at ASC`,
        [booking.id],
      );
      messages = msgRes.rows;
    } catch (e) {
      try {
        const fallback = await this.db.query(
          `SELECT id, sender_role AS sender_type, message AS message_text, sent_at
           FROM chat_messages
           WHERE booking_id = $1
           ORDER BY sent_at ASC`,
          [booking.id],
        );
        messages = fallback.rows;
      } catch (err) { }
    }

    return {
      bookingId: booking.id,
      bookingRef: booking.booking_ref,
      messages,
    };
  }

  // SCREEN 12 - API 4: Save Customer Chat Message
  async sendChatMessage(
    bookingId: string,
    userId: string,
    text: string,
  ) {
    const cleanText = String(text || '').trim();

    if (!cleanText) {
      throw new BadRequestException('Message text is required.');
    }

    if (cleanText.length > 5000) {
      throw new BadRequestException(
        'Message cannot exceed 5000 characters.',
      );
    }

    // Verify that this booking belongs to the logged-in customer.
    const bookingResult = await this.db.query(
      `SELECT b.id
       FROM bookings b
       INNER JOIN customer_profiles cp
         ON cp.id = b.customer_id
       WHERE b.id::text = $1
         AND cp.user_id::text = $2
       LIMIT 1`,
      [bookingId, userId],
    );

    if (!bookingResult.rows.length) {
      throw new NotFoundException(
        'Booking not found for this customer.',
      );
    }

    // Save the message in the existing chat table.
    const result = await this.db.query(
      `INSERT INTO trip_chat_messages
         (booking_id, sender_type, sender_id, message_text)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sent_at`,
      [
        bookingResult.rows[0].id,
        'customer',
        userId,
        cleanText,
      ],
    );

    const message = result.rows[0];

    return {
      messageId: message.id,
      status: 'sent',
      sentAt: message.sent_at,
    };
  }
  // SCREEN 14 - API 1: Get Live Trip Snapshot
  async getLiveTripSnapshot(bookingId: string, userId: string) {
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      throw new BadRequestException('A valid booking ID is required.');
    }

    if (!userId) {
      throw new BadRequestException('Authentication is required.');
    }

    // Verify booking ownership and fetch the latest telematics snapshot.
    const result = await this.db.query(
      `SELECT
       b.id,
       b.booking_ref,
       b.status::text AS booking_status,
       b.sla_min_temp_c,
       b.sla_max_temp_c,
       b.scheduled_delivery_eta,
       b.origin_city,
       b.destination_city,
       b.digital_seal_number,
       b.is_seal_locked,

       ts.latitude,
       ts.longitude,
       ts.speed_kmh,
       ts.heading_deg,
       ts.chamber_temp_c,
       ts.iot_source,
       ts.is_mismatch_detected,
       ts.recorded_at

     FROM bookings b

     INNER JOIN customer_profiles cp
       ON cp.id = b.customer_id

     LEFT JOIN LATERAL (
       SELECT
         latitude,
         longitude,
         speed_kmh,
         heading_deg,
         chamber_temp_c,
         iot_source,
         is_mismatch_detected,
         recorded_at
       FROM telematics_snapshots
       WHERE booking_id = b.id
       ORDER BY recorded_at DESC
       LIMIT 1
     ) ts ON TRUE

     WHERE b.id::text = $1
       AND cp.user_id::text = $2
     LIMIT 1`,
      [bookingId, userId],
    );

    if (!result.rows.length) {
      throw new NotFoundException(
        'Booking not found for this customer.',
      );
    }

    const row = result.rows[0];

    const currentTemp =
      row.chamber_temp_c == null
        ? null
        : Number(row.chamber_temp_c);

    const minTemp =
      row.sla_min_temp_c == null
        ? null
        : Number(row.sla_min_temp_c);

    const maxTemp =
      row.sla_max_temp_c == null
        ? null
        : Number(row.sla_max_temp_c);

    const source = row.iot_source || 'unknown';

    const recordedAt = row.recorded_at
      ? new Date(row.recorded_at)
      : null;

    const lastUpdatedSecondsAgo = recordedAt
      ? Math.max(
        0,
        Math.floor(
          (Date.now() - recordedAt.getTime()) / 1000,
        ),
      )
      : null;

    const isRecent =
      lastUpdatedSecondsAgo !== null &&
      lastUpdatedSecondsAgo <= 60;

    let complianceStatus = 'unknown';
    let complianceLabel = 'Temperature data unavailable';

    if (
      currentTemp !== null &&
      minTemp !== null &&
      maxTemp !== null
    ) {
      const isWithinSla =
        currentTemp >= minTemp &&
        currentTemp <= maxTemp;

      complianceStatus = isWithinSla
        ? 'nominal'
        : 'excursion';

      complianceLabel = isWithinSla
        ? 'Continuous cooling nominal'
        : 'Temperature excursion reported';
    }

    const bookingStatus = String(
      row.booking_status || '',
    ).toLowerCase();

    const statusMap: Record<string, string> = {
      searching: 'searching_driver',
      assigned: 'driver_assigned',
      in_transit: 'en_route',
      en_route: 'en_route',
      delivered: 'completed',
    };

    const tripStatus =
      statusMap[bookingStatus] || bookingStatus;

    const etaLabel = row.scheduled_delivery_eta
      ? `ETA ${new Date(
        row.scheduled_delivery_eta,
      ).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      })}`
      : null;

    const sealId = row.digital_seal_number
      ? String(row.digital_seal_number).replace(/^#/, '')
      : null;

    const primaryHardwareAvailable =
      source === 'dual' || source === 'ble_hardware';

    const driverGpsAvailable =
      source === 'dual' || source === 'driver_mobile';

    return {
      bookingRef: row.booking_ref,
      tripStatus,
      lastUpdatedSecondsAgo,

      truck: {
        lat:
          row.latitude == null
            ? null
            : Number(row.latitude),

        lng:
          row.longitude == null
            ? null
            : Number(row.longitude),

        speedKmh:
          row.speed_kmh == null
            ? null
            : Number(row.speed_kmh),

        headingDeg:
          row.heading_deg == null
            ? null
            : Number(row.heading_deg),

        // Requires live route-distance calculation.
        distanceRemainingKm: null,
        etaLabel,

        // No road-name field is currently available.
        highwayLabel: null,
      },

      iot: {
        source,

        primaryGeoTracker: {
          type: primaryHardwareAvailable
            ? 'ble_hardware'
            : null,
          signal: null,
          chamberTempC: currentTemp,
          status: !primaryHardwareAvailable
            ? 'not_available'
            : isRecent
              ? 'active'
              : recordedAt
                ? 'stale'
                : 'not_available',
        },

        driverMobileGps: {
          speedKmh:
            driverGpsAvailable && row.speed_kmh != null
              ? Number(row.speed_kmh)
              : null,

          syncStatus: !driverGpsAvailable
            ? 'not_available'
            : isRecent
              ? 'synced'
              : recordedAt
                ? 'stale'
                : 'not_available',
        },

        mismatchWatchdog:
          row.is_mismatch_detected == null
            ? 'unknown'
            : row.is_mismatch_detected
              ? 'mismatch_detected'
              : 'normal',

        digitalSeal: {
          sealId,
          status:
            sealId == null
              ? 'not_available'
              : row.is_seal_locked
                ? 'locked'
                : 'unlocked',
        },
      },

      tempSla: {
        minC: minTemp,
        maxC: maxTemp,

        label:
          minTemp !== null && maxTemp !== null
            ? `${maxTemp}°C TO ${minTemp}°C SLA`
            : null,

        currentTempC: currentTemp,
        complianceStatus,
        complianceLabel,
      },
    };
  }
  // Get actual delivery timestamp for completed trips
  private async getTripDeliveredAt(
    bookingId: string,
    userId: string,
  ) {
    const result = await this.db.query(
      `SELECT
       COALESCE(
         t.handover_timestamp,
         t.outcome_selected_timestamp,
         t.delivery_arrival_timestamp
       ) AS delivered_at
     FROM bookings b
     INNER JOIN customer_profiles cp
       ON cp.id = b.customer_id
     LEFT JOIN LATERAL (
       SELECT
         handover_timestamp,
         outcome_selected_timestamp,
         delivery_arrival_timestamp
       FROM trips
       WHERE booking_id = b.id
       ORDER BY updated_at DESC
       LIMIT 1
     ) t ON TRUE
     WHERE b.id::text = $1
       AND cp.user_id::text = $2
     LIMIT 1`,
      [bookingId, userId],
    );

    const deliveredAt = result.rows[0]?.delivered_at;

    return deliveredAt
      ? new Date(deliveredAt).toISOString()
      : null;
  }

  // SCREEN 14 - API 2: Subscribe to Live Trip Updates
  streamLiveTrip(
    bookingId: string,
    userId: string,
  ) {
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      throw new BadRequestException(
        'A valid booking ID is required.',
      );
    }

    if (!userId) {
      throw new BadRequestException(
        'Authentication is required.',
      );
    }

    return interval(12000).pipe(
      startWith(0),

      // Fetch a fresh database snapshot every 12 seconds.
      concatMap(() =>
        from(
          this.getLiveTripSnapshot(bookingId, userId),
        ),
      ),

      // Convert each snapshot into an SSE event.
      concatMap(async (snapshot) => {
        if (
          ['completed', 'delivered'].includes(
            String(snapshot.tripStatus).toLowerCase(),
          )
        ) {
          const deliveredAt = await this.getTripDeliveredAt(
            bookingId,
            userId,
          );

          return {
            type: 'trip_completed',
            data: {
              deliveredAt,
            },
          };
        }

        return {
          type: 'trip_update',
          data: {
            lat: snapshot.truck.lat,
            lng: snapshot.truck.lng,
            speedKmh: snapshot.truck.speedKmh,
            chamberTempC:
              snapshot.iot.primaryGeoTracker.chamberTempC,
            distanceRemainingKm:
              snapshot.truck.distanceRemainingKm,
            etaLabel: snapshot.truck.etaLabel,
            lastUpdatedSecondsAgo:
              snapshot.lastUpdatedSecondsAgo,
            mismatchWatchdog:
              snapshot.iot.mismatchWatchdog,
            digitalSeal: snapshot.iot.digitalSeal,
          },
        };
      }),

      // Stop the stream after sending trip_completed.
      takeWhile(
        (event) => event.type !== 'trip_completed',
        true,
      ),
    );
  }
  // SCREEN 14 - API 3: Get Planned Route Polyline
  async getPlannedRoute(
    bookingId: string,
    userId: string,
  ) {
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      throw new BadRequestException(
        'A valid booking ID is required.',
      );
    }

    if (!userId) {
      throw new BadRequestException(
        'Authentication is required.',
      );
    }

    // Fetch the booking only if it belongs to this customer.
    const bookingResult = await this.db.query(
      `SELECT
       b.id,
       b.booking_ref,
       b.origin_city,
       b.origin_address,
       b.origin_lat,
       b.origin_lng,
       b.destination_city,
       b.destination_address,
       b.destination_lat,
       b.destination_lng,
       b.route_polyline_encoded,
       b.total_distance_km

     FROM bookings b

     INNER JOIN customer_profiles cp
       ON cp.id = b.customer_id

     WHERE b.id::text = $1
       AND cp.user_id::text = $2

     LIMIT 1`,
      [bookingId, userId],
    );

    if (!bookingResult.rows.length) {
      throw new NotFoundException(
        'Booking not found for this customer.',
      );
    }

    const booking = bookingResult.rows[0];

    // Fetch intermediate route stops in the correct order.
    const stopsResult = await this.db.query(
      `SELECT
       stop_label,
       stop_type,
       address,
       latitude,
       longitude
     FROM booking_stops
     WHERE booking_id = $1
     ORDER BY sequence_no ASC`,
      [booking.id],
    );

    const toNumber = (value: any): number | null =>
      value == null ? null : Number(value);

    const origin = {
      label:
        booking.origin_city ||
        booking.origin_address ||
        'Origin',
      lat: toNumber(booking.origin_lat),
      lng: toNumber(booking.origin_lng),
    };

    const destination = {
      label:
        booking.destination_city ||
        booking.destination_address ||
        'Destination',
      lat: toNumber(booking.destination_lat),
      lng: toNumber(booking.destination_lng),
    };

    // Include only stops having actual coordinates.
    const intermediateWaypoints = stopsResult.rows
      .filter(
        (stop: any) =>
          stop.latitude != null &&
          stop.longitude != null,
      )
      .map((stop: any) => ({
        lat: Number(stop.latitude),
        lng: Number(stop.longitude),
        label:
          stop.stop_label ||
          stop.address ||
          'Intermediate stop',
      }));

    const waypoints = [
      ...(origin.lat !== null && origin.lng !== null
        ? [origin]
        : []),

      ...intermediateWaypoints,

      ...(destination.lat !== null &&
        destination.lng !== null
        ? [destination]
        : []),
    ];

    return {
      origin,
      destination,

      encodedPolyline:
        booking.route_polyline_encoded || null,

      waypoints,

      totalDistanceKm:
        toNumber(booking.total_distance_km),

      // No confirmed duration field exists in the inspected booking schema.
      estimatedDurationMinutes: null,

      mapRenderingHints: {
        originMarkerColor: 'green',
        destinationMarkerColor: 'orange',
        routeLineStyle: 'dashed',
        truckIconOverlay: true,
      },
    };
  }
  // SCREEN 14 - API 4: Get Temperature History Log
  async getTemperatureHistory(
    bookingId: string,
    userId: string,
    fromDate: string,
    toDate?: string,
    resolution = '5min',
  ) {
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      throw new BadRequestException('A valid booking ID is required.');
    }

    if (!userId) {
      throw new BadRequestException('Authentication is required.');
    }

    const allowedResolutions: Record<string, number> = {
      '1min': 1,
      '5min': 5,
      '15min': 15,
    };

    if (!allowedResolutions[resolution]) {
      throw new BadRequestException(
        'Resolution must be 1min, 5min, or 15min.',
      );
    }

    const start = new Date(fromDate);
    const end = toDate ? new Date(toDate) : new Date();

    if (
      !fromDate ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      throw new BadRequestException(
        'Valid from and to ISO timestamps are required.',
      );
    }

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException(
        'The from date must be earlier than the to date.',
      );
    }

    // Verify booking ownership and obtain the temperature SLA.
    const bookingResult = await this.db.query(
      `SELECT
       b.id,
       b.booking_ref,
       b.sla_min_temp_c,
       b.sla_max_temp_c
     FROM bookings b
     INNER JOIN customer_profiles cp
       ON cp.id = b.customer_id
     WHERE b.id::text = $1
       AND cp.user_id::text = $2
     LIMIT 1`,
      [bookingId, userId],
    );

    if (!bookingResult.rows.length) {
      throw new NotFoundException(
        'Booking not found for this customer.',
      );
    }

    const booking = bookingResult.rows[0];

    const minC = Number(booking.sla_min_temp_c);
    const maxC = Number(booking.sla_max_temp_c);

    // Read both IoT and manual temperature readings.
    const readingsResult = await this.db.query(
      `SELECT
       ts.recorded_at AS reading_timestamp,
       ts.chamber_temp_c AS temp_c,
       'iot' AS source,
       FALSE AS flagged_excursion
     FROM telematics_snapshots ts
     WHERE ts.booking_id = $1
       AND ts.recorded_at >= $2::timestamptz
       AND ts.recorded_at <= $3::timestamptz

     UNION ALL

     SELECT
       tm.reading_timestamp,
       tm.manual_temp_c AS temp_c,
       COALESCE(tm.entry_source, 'manual') AS source,
       COALESCE(tm.is_temp_out_of_range, FALSE) AS flagged_excursion
     FROM trips t
     INNER JOIN trip_manual_temp_logs tm
       ON tm.trip_id = t.id
     WHERE t.booking_id = $1
       AND tm.reading_timestamp >= $2::timestamptz
       AND tm.reading_timestamp <= $3::timestamptz
       AND tm.manual_temp_c IS NOT NULL

     ORDER BY reading_timestamp ASC`,
      [booking.id, start.toISOString(), end.toISOString()],
    );

    const rawReadings = readingsResult.rows.map((row: any) => ({
      timestamp: new Date(row.reading_timestamp),
      tempC: Number(row.temp_c),
      source: row.source,
      flaggedExcursion: row.flagged_excursion === true,
    }));

    // Group readings into the requested chart resolution.
    const intervalMs = allowedResolutions[resolution] * 60 * 1000;

    const buckets = new Map<
      number,
      { sum: number; count: number }
    >();

    for (const reading of rawReadings) {
      const timestampMs = reading.timestamp.getTime();
      const bucketTime =
        Math.floor(timestampMs / intervalMs) * intervalMs;

      const existing = buckets.get(bucketTime) || {
        sum: 0,
        count: 0,
      };

      existing.sum += reading.tempC;
      existing.count += 1;

      buckets.set(bucketTime, existing);
    }

    const readings = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, values]) => ({
        timestamp: new Date(timestamp).toISOString(),
        tempC: Number(
          (values.sum / values.count).toFixed(2),
        ),
      }));

    // Report readings outside the SLA or explicitly flagged by a manual log.
    const excursionEvents = rawReadings
      .filter(
        (reading) =>
          reading.flaggedExcursion ||
          reading.tempC < minC ||
          reading.tempC > maxC,
      )
      .map((reading) => ({
        timestamp: reading.timestamp.toISOString(),
        tempC: reading.tempC,
        source: reading.source,
      }));

    // Select up to three representative X-axis labels.
    const labelIndexes =
      readings.length <= 3
        ? readings.map((_, index) => index)
        : [
          0,
          Math.floor((readings.length - 1) / 2),
          readings.length - 1,
        ];

    const xAxisLabels = [
      ...new Set(labelIndexes),
    ].map((index) => {
      const timestamp = new Date(readings[index].timestamp);

      return timestamp.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      });
    });

    const actualTemps = rawReadings.map(
      (reading) => reading.tempC,
    );

    const lowestTemp =
      actualTemps.length > 0
        ? Math.min(minC, ...actualTemps)
        : minC;

    const highestTemp =
      actualTemps.length > 0
        ? Math.max(maxC, ...actualTemps)
        : maxC;

    return {
      sla: {
        minC,
        maxC,
      },

      readings,

      excursionEvents,

      chartMeta: {
        xAxisLabels,
        yAxisMinC: Math.floor(lowestTemp - 1),
        yAxisMaxC: Math.ceil(highestTemp + 1),
      },
    };
  }
  // SCREEN 16 - API 1: Get Full Trip Temperature Analytics
  async getTemperatureAnalytics(
    bookingId: string,
    userId: string,
    resolution = '15min',
    includeHumidity = 'false',
  ) {
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      throw new BadRequestException('A valid booking ID is required.');
    }

    if (!userId) {
      throw new BadRequestException('Authentication is required.');
    }

    const resolutionMinutes: Record<string, number> = {
      '1min': 1,
      '5min': 5,
      '15min': 15,
      '1hr': 60,
    };

    const bucketMinutes = resolutionMinutes[resolution];
    if (!bucketMinutes) {
      throw new BadRequestException(
        'Resolution must be 1min, 5min, 15min, or 1hr.',
      );
    }

    const wantsHumidity =
      String(includeHumidity).toLowerCase() === 'true';

    // Verify that the booking belongs to the authenticated customer.
    const bookingResult = await this.db.query(
      `SELECT
         b.id,
         b.booking_ref,
         b.sla_min_temp_c,
         b.sla_max_temp_c,
         b.target_setpoint_c
       FROM bookings b
       INNER JOIN customer_profiles cp
         ON cp.id = b.customer_id
       WHERE b.id::text = $1
         AND cp.user_id::text = $2
       LIMIT 1`,
      [bookingId, userId],
    );

    if (!bookingResult.rows.length) {
      throw new NotFoundException(
        'Booking not found for this customer.',
      );
    }

    const booking = bookingResult.rows[0];
    const lowerBreachLimitC =
      booking.sla_min_temp_c == null
        ? null
        : Number(booking.sla_min_temp_c);
    const upperBreachLimitC =
      booking.sla_max_temp_c == null
        ? null
        : Number(booking.sla_max_temp_c);
    const chamberSetpointC =
      booking.target_setpoint_c == null
        ? null
        : Number(booking.target_setpoint_c);

    // Read every temperature record stored for this booking.
    // GPS coordinates are available on IoT snapshots. Manual entries do not
    // have GPS coordinates in the currently-used schema.
    const readingsResult = await this.db.query(
      `SELECT
         ts.recorded_at AS reading_timestamp,
         ts.chamber_temp_c AS temp_c,
         ts.latitude AS gps_lat,
         ts.longitude AS gps_lng,
         'iot'::text AS source,
         FALSE AS flagged_excursion
       FROM telematics_snapshots ts
       WHERE ts.booking_id = $1
         AND ts.chamber_temp_c IS NOT NULL

       UNION ALL

       SELECT
         tm.reading_timestamp,
         tm.manual_temp_c AS temp_c,
         NULL::double precision AS gps_lat,
         NULL::double precision AS gps_lng,
         COALESCE(tm.entry_source, 'manual')::text AS source,
         COALESCE(tm.is_temp_out_of_range, FALSE) AS flagged_excursion
       FROM trips t
       INNER JOIN trip_manual_temp_logs tm
         ON tm.trip_id = t.id
       WHERE t.booking_id = $1
         AND tm.manual_temp_c IS NOT NULL

       ORDER BY reading_timestamp ASC`,
      [booking.id],
    );

    const rawReadings = readingsResult.rows
      .map((row: any) => ({
        timestamp: new Date(row.reading_timestamp),
        tempC: Number(row.temp_c),
        gpsLat:
          row.gps_lat == null ? null : Number(row.gps_lat),
        gpsLng:
          row.gps_lng == null ? null : Number(row.gps_lng),
        source: String(row.source || 'unknown'),
        flaggedExcursion: row.flagged_excursion === true,
      }))
      .filter(
        (reading: any) =>
          !Number.isNaN(reading.timestamp.getTime()) &&
          Number.isFinite(reading.tempC),
      )
      .sort(
        (a: any, b: any) =>
          a.timestamp.getTime() - b.timestamp.getTime(),
      );

    const bucketSizeMs = bucketMinutes * 60 * 1000;
    const buckets = new Map<number, any>();

    // Average readings inside each requested chart interval.
    for (const reading of rawReadings) {
      const timestampMs = reading.timestamp.getTime();
      const bucketStart =
        Math.floor(timestampMs / bucketSizeMs) * bucketSizeMs;

      let bucket = buckets.get(bucketStart);
      if (!bucket) {
        bucket = {
          timestampMs: bucketStart,
          tempSum: 0,
          count: 0,
          gpsLat: null,
          gpsLng: null,
          flaggedExcursion: false,
          source: reading.source,
        };
        buckets.set(bucketStart, bucket);
      }

      bucket.tempSum += reading.tempC;
      bucket.count += 1;
      bucket.flaggedExcursion =
        bucket.flaggedExcursion || reading.flaggedExcursion;
      bucket.source = reading.source;

      // Keep the latest available GPS pair in this bucket.
      if (reading.gpsLat !== null && reading.gpsLng !== null) {
        bucket.gpsLat = reading.gpsLat;
        bucket.gpsLng = reading.gpsLng;
      }
    }

    const chartReadings = Array.from(buckets.values())
      .sort((a: any, b: any) => a.timestampMs - b.timestampMs)
      .map((bucket: any) => ({
        timestamp: new Date(bucket.timestampMs).toISOString(),
        timestampMs: bucket.timestampMs,
        tempC: Number((bucket.tempSum / bucket.count).toFixed(2)),
        gpsLat: bucket.gpsLat,
        gpsLng: bucket.gpsLng,
        flaggedExcursion: bucket.flaggedExcursion,
        source: bucket.source,
      }));

    const hasSla =
      lowerBreachLimitC !== null &&
      upperBreachLimitC !== null &&
      Number.isFinite(lowerBreachLimitC) &&
      Number.isFinite(upperBreachLimitC);

    const isBreach = (reading: any) =>
      reading.flaggedExcursion ||
      (hasSla &&
        (reading.tempC < lowerBreachLimitC! ||
          reading.tempC > upperBreachLimitC!));

    // Count contiguous out-of-range chart intervals as separate excursions.
    // Excursion minutes are interval-based estimates at the selected resolution.
    const excursionEvents: any[] = [];
    let currentEvent: any = null;

    for (const reading of chartReadings) {
      if (isBreach(reading)) {
        if (!currentEvent) {
          currentEvent = {
            startAt: reading.timestamp,
            endAt: reading.timestamp,
            durationMinutes: bucketMinutes,
            minTempC: reading.tempC,
            maxTempC: reading.tempC,
            readingCount: 1,
            source: reading.source,
          };
        } else {
          currentEvent.endAt = reading.timestamp;
          currentEvent.durationMinutes += bucketMinutes;
          currentEvent.minTempC = Math.min(
            currentEvent.minTempC,
            reading.tempC,
          );
          currentEvent.maxTempC = Math.max(
            currentEvent.maxTempC,
            reading.tempC,
          );
          currentEvent.readingCount += 1;
        }
      } else if (currentEvent) {
        excursionEvents.push(currentEvent);
        currentEvent = null;
      }
    }

    if (currentEvent) {
      excursionEvents.push(currentEvent);
    }

    const breachBucketCount = chartReadings.filter(isBreach).length;
    const breachCount = excursionEvents.length;
    const totalExcursionMinutes =
      breachBucketCount * bucketMinutes;

    const compliancePercent =
      hasSla && chartReadings.length > 0
        ? Number(
          (
            ((chartReadings.length - breachBucketCount) /
              chartReadings.length) *
            100
          ).toFixed(2),
        )
        : null;

    const actualTemps = rawReadings.map(
      (reading: any) => reading.tempC,
    );
    const minTempC =
      actualTemps.length > 0 ? Math.min(...actualTemps) : null;
    const maxTempC =
      actualTemps.length > 0 ? Math.max(...actualTemps) : null;

    // Mean Kinetic Temperature, using the common activation-energy value
    // for the calculation. It is null when no temperature readings exist.
    let mktC: number | null = null;
    if (actualTemps.length > 0) {
      const activationEnergy = 83144;
      const gasConstant = 8.314;
      const averageThermalLoad = actualTemps.reduce(
        (total: number, tempC: number) => {
          const tempKelvin = tempC + 273.15;
          return (
            total +
            Math.exp(-activationEnergy / (gasConstant * tempKelvin))
          );
        },
        0,
      ) / actualTemps.length;

      if (averageThermalLoad > 0 && averageThermalLoad < 1) {
        const mktKelvin =
          -activationEnergy /
          (gasConstant * Math.log(averageThermalLoad));
        mktC = Number((mktKelvin - 273.15).toFixed(2));
      }
    }

    const allYAxisValues = [
      ...actualTemps,
      ...(lowerBreachLimitC === null ? [] : [lowerBreachLimitC]),
      ...(upperBreachLimitC === null ? [] : [upperBreachLimitC]),
      ...(chamberSetpointC === null ? [] : [chamberSetpointC]),
    ];

    const yAxisMinC =
      allYAxisValues.length > 0
        ? Math.floor(Math.min(...allYAxisValues) - 1)
        : null;
    const yAxisMaxC =
      allYAxisValues.length > 0
        ? Math.ceil(Math.max(...allYAxisValues) + 1)
        : null;

    const slaLabel =
      chamberSetpointC !== null && lowerBreachLimitC !== null
        ? `${chamberSetpointC}°C TO ${lowerBreachLimitC}°C SLA`
        : upperBreachLimitC !== null && lowerBreachLimitC !== null
          ? `${upperBreachLimitC}°C TO ${lowerBreachLimitC}°C SLA`
          : null;

    const lines: any[] = [];
    if (upperBreachLimitC !== null) {
      lines.push({
        id: 'upper_breach',
        labelKey: 'Upper Breach Limit',
        valueC: upperBreachLimitC,
        style: 'dashed_red',
      });
    }
    if (chamberSetpointC !== null) {
      lines.push({
        id: 'setpoint',
        labelKey: 'Chamber Setpoint',
        valueC: chamberSetpointC,
        style: 'dashed_green',
      });
    }
    if (lowerBreachLimitC !== null) {
      lines.push({
        id: 'lower_breach',
        labelKey: 'Lower Breach Limit',
        valueC: lowerBreachLimitC,
        style: 'dashed_blue',
      });
    }
    lines.push({
      id: 'actual_temp',
      labelKey: 'Actual Temperature',
      style: 'solid_green',
    });

    return {
      bookingRef: booking.booking_ref,
      compliancePercent,
      breachCount,
      totalExcursionMinutes,
      sla: {
        upperBreachLimitC,
        lowerBreachLimitC,
        chamberSetpointC,
        label: slaLabel,
      },
      stats: {
        minTempC,
        maxTempC,
        mktC,
        // The inspected application schema has no confirmed humidity column.
        // Return null rather than fabricate a humidity measurement.
        avgHumidityPercent: null,
      },
      chartMeta: {
        xAxisStart:
          chartReadings.length > 0
            ? chartReadings[0].timestamp
            : null,
        xAxisEnd:
          chartReadings.length > 0
            ? chartReadings[chartReadings.length - 1].timestamp
            : null,
        yAxisMinC,
        yAxisMaxC,
        lines,
      },
      readings: chartReadings.map((reading: any) => ({
        timestamp: reading.timestamp,
        tempC: reading.tempC,
        // Humidity and readable place labels are not present in the
        // currently-confirmed schema, so these remain null.
        humidityPercent: wantsHumidity ? null : undefined,
        gpsLat: reading.gpsLat,
        gpsLng: reading.gpsLng,
        locationLabel: null,
      })),
      excursionEvents,
    };
  }

  // SCREEN 14 - API 5: Get Trip Milestones Timeline
  async getTripMilestones(
    bookingId: string,
    userId: string,
  ) {
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      throw new BadRequestException(
        'A valid booking ID is required.',
      );
    }

    if (!userId) {
      throw new BadRequestException(
        'Authentication is required.',
      );
    }

    // Find the customer's booking and its latest trip record.
    const bookingResult = await this.db.query(
      `SELECT
       b.id,
       b.booking_ref,
       b.status::text AS booking_status,
       b.is_precooling_passed,
       b.precooling_verified_temp_c,
       b.precooling_verified_at,
       b.target_setpoint_c,
       b.digital_seal_number,
       b.scheduled_delivery_eta,
       b.destination_city,

       t.id AS trip_id,
       t.precooling_chamber_temp_c,
       t.precooling_time_target_reached,
       t.loading_door_close_timestamp,
       t.loading_sequence_confirmed,
       t.loading_status,
       t.loading_carton_count,
       t.cargo_intake_temp_c,
       t.bolt_seal_number,
       t.pickup_completed_timestamp,
t.delivery_arrival_timestamp,
t.handover_timestamp,
t.handover_notes

     FROM bookings b
     INNER JOIN customer_profiles cp
       ON cp.id = b.customer_id

     LEFT JOIN LATERAL (
       SELECT *
       FROM trips
       WHERE booking_id = b.id
       ORDER BY updated_at DESC
       LIMIT 1
     ) t ON TRUE

     WHERE b.id::text = $1
       AND cp.user_id::text = $2
     LIMIT 1`,
      [bookingId, userId],
    );

    if (!bookingResult.rows.length) {
      throw new NotFoundException(
        'Booking not found for this customer.',
      );
    }

    const row = bookingResult.rows[0];

    // Fetch the latest actual trip checkpoint, if available.
    let checkpoint: any = null;

    if (row.trip_id) {
      const checkpointResult = await this.db.query(
        `SELECT
         milestone_type,
         checkpoint_name,
         vehicle_speed_kmph,
         notes,
         logged_at
       FROM trip_checkpoints
       WHERE trip_id = $1
       ORDER BY logged_at DESC
       LIMIT 1`,
        [row.trip_id],
      );

      checkpoint = checkpointResult.rows[0] || null;
    }

    const toIso = (value: any): string | null =>
      value ? new Date(value).toISOString() : null;

    // 1. Pre-cooling verification
    const precoolingCompleted =
      row.is_precooling_passed === true ||
      row.precooling_verified_at != null ||
      row.precooling_time_target_reached != null;

    const precoolingTemp =
      row.precooling_verified_temp_c ??
      row.precooling_chamber_temp_c;

    const precoolingLabel =
      precoolingTemp != null
        ? `Pre-Cooling Verified (${Number(precoolingTemp)}°C)`
        : 'Pre-Cooling Verified';

    // 2. Cargo loaded and sealed
    const cargoLoaded =
      row.loading_sequence_confirmed === true ||
      row.loading_door_close_timestamp != null ||
      row.pickup_completed_timestamp != null;

    const sealNumber =
      row.bolt_seal_number ||
      row.digital_seal_number;

    const cargoLabel = cargoLoaded
      ? `Cargo Loaded & Sealed${sealNumber ? ` (#${String(sealNumber).replace(/^#/, '')})` : ''}`
      : 'Cargo Loaded & Sealed';

    const cargoDetailParts: string[] = [];

    if (row.cargo_intake_temp_c != null) {
      cargoDetailParts.push(
        `Loading probe: ${Number(row.cargo_intake_temp_c)}°C`,
      );
    }

    if (row.loading_carton_count != null) {
      cargoDetailParts.push(
        `${row.loading_carton_count} Cartons`,
      );
    }

    // 3. Latest actual in-transit checkpoint
    const checkpointCompleted = checkpoint != null;

    const checkpointName =
      checkpoint?.checkpoint_name ||
      checkpoint?.milestone_type ||
      'Checkpoint recorded';

    const checkpointLabel =
      `In Transit · ${checkpointName}`;

    const checkpointDetailParts: string[] = [];

    if (checkpoint?.vehicle_speed_kmph != null) {
      checkpointDetailParts.push(
        `Speed ${checkpoint.vehicle_speed_kmph} km/h`,
      );
    }

    if (checkpoint?.notes) {
      checkpointDetailParts.push(checkpoint.notes);
    }

    // 4. Delivery dock handover
    const handoverCompleted =
      row.handover_timestamp != null;

    const etaLabel = row.scheduled_delivery_eta
      ? new Date(row.scheduled_delivery_eta)
        .toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        })
      : null;

    const handoverLabel =
      row.destination_city
        ? `${row.destination_city} Dock Handover${etaLabel ? ` (ETA ${etaLabel})` : ''}`
        : 'Delivery Dock Handover';

    return {
      milestones: [
        {
          id: 'pre_cooling_verified',
          label: precoolingLabel,
          status: precoolingCompleted
            ? 'completed'
            : 'pending',
          completedAt: precoolingCompleted
            ? toIso(
              row.precooling_verified_at ||
              row.precooling_time_target_reached,
            )
            : null,
          detail: null,
        },
        {
          id: 'cargo_loaded_sealed',
          label: cargoLabel,
          status: cargoLoaded
            ? 'completed'
            : 'pending',
          completedAt: cargoLoaded
            ? toIso(
              row.loading_door_close_timestamp ||
              row.pickup_completed_timestamp,
            )
            : null,
          detail: cargoDetailParts.length
            ? cargoDetailParts.join(' · ')
            : null,
        },
        {
          id: 'in_transit_checkpoint',
          label: checkpointLabel,
          status: checkpointCompleted
            ? 'completed'
            : 'pending',
          completedAt: checkpointCompleted
            ? toIso(checkpoint.logged_at)
            : null,
          detail: checkpointDetailParts.length
            ? checkpointDetailParts.join(' · ')
            : null,
        },
        {
          id: 'delivery_dock_handover',
          label: handoverLabel,
          status: handoverCompleted
            ? 'completed'
            : 'pending',
          completedAt: handoverCompleted
            ? toIso(row.handover_timestamp)
            : null,
          detail: handoverCompleted
            ? row.handover_notes || null
            : 'Consignee 4-digit OTP required for sign off',
        },
      ],
    };
  }
  // SCREEN 14 - API 6: Trigger Emergency / Excursion Action
  async triggerExcursionAction(
    bookingId: string,
    userId: string,
    body: {
      action: string;
      customerNote?: string;
    },
  ) {
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      throw new BadRequestException(
        'A valid booking ID is required.',
      );
    }

    if (!userId) {
      throw new BadRequestException(
        'Authentication is required.',
      );
    }

    const allowedActions = [
      'continue_trip',
      'divert_cold_store',
      'call_24x7_noc',
      'emergency_sos',
    ];

    const action = String(body?.action || '').toLowerCase();
    const customerNote = String(
      body?.customerNote || '',
    ).trim();

    if (!allowedActions.includes(action)) {
      throw new BadRequestException(
        'Invalid action. Allowed actions: continue_trip, divert_cold_store, call_24x7_noc, emergency_sos.',
      );
    }

    if (customerNote.length > 2000) {
      throw new BadRequestException(
        'Customer note cannot exceed 2000 characters.',
      );
    }

    // Verify this booking belongs to the logged-in customer.
    const bookingResult = await this.db.query(
      `SELECT
       b.id,
       b.booking_ref,
       cp.id AS customer_id
     FROM bookings b
     INNER JOIN customer_profiles cp
       ON cp.id = b.customer_id
     WHERE b.id::text = $1
       AND cp.user_id::text = $2
     LIMIT 1`,
      [bookingId, userId],
    );

    if (!bookingResult.rows.length) {
      throw new NotFoundException(
        'Booking not found for this customer.',
      );
    }

    const booking = bookingResult.rows[0];

    const actionDetails: Record<
      string,
      { title: string; message: string }
    > = {
      continue_trip: {
        title: 'Customer Requested to Continue Trip',
        message:
          'Your request to continue the trip has been recorded for operations review.',
      },
      divert_cold_store: {
        title: 'Customer Requested Cold Store Diversion',
        message:
          'Your cold-store diversion request has been recorded for operations review.',
      },
      call_24x7_noc: {
        title: 'Customer Requested 24/7 NOC Callback',
        message:
          'Your NOC callback request has been recorded. Live callback dispatch is not configured.',
      },
      emergency_sos: {
        title: 'Customer Triggered Emergency SOS',
        message:
          'Your emergency SOS request has been recorded. Live emergency paging is not configured.',
      },
    };

    // Generate a unique operations case reference.
    const caseRef =
      'NOC-' +
      new Date().getFullYear() +
      '-' +
      crypto.randomBytes(4).toString('hex').toUpperCase();

    const description = [
      `Customer action: ${action}`,
      `Booking reference: ${booking.booking_ref}`,
      `Customer note: ${customerNote || 'No additional note provided.'}`,
    ].join('\n');

    // Create an operations support ticket.
    const ticketResult = await this.db.query(
      `INSERT INTO support_tickets (
       ticket_code,
       customer_id,
       booking_id,
       issue_category,
       title,
       description,
       status
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'open')
     RETURNING id, ticket_code, created_at`,
      [
        caseRef,
        booking.customer_id,
        booking.id,
        'trip_excursion_action',
        actionDetails[action].title,
        description,
      ],
    );

    const ticket = ticketResult.rows[0];

    return {
      actionId: `act_${ticket.id}`,
      action,
      status: 'acknowledged',
      message: actionDetails[action].message,
      estimatedResponseMinutes: null,
      caseRef: ticket.ticket_code,
    };
  }
}
