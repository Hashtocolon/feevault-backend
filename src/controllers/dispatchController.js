
const db = require('../config/db');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
// =====================================================
// SCREEN 11 - API 1
// GET /api/v1/bookings/:bookingId/dispatch-status
// Check Dispatch & Driver Assignment Status
// =====================================================

exports.getDispatchStatus = async (req, res, next) => {
    try {
        const userId = req.user?.userId || req.user?.id;

        if (!userId) {
            return res.status(401).json({
                code: 'UNAUTHORIZED',
                message: 'Authentication required.'
            });
        }

        if (req.user.role !== 'customer') {
            return res.status(403).json({
                code: 'CUSTOMER_ACCESS_REQUIRED',
                message: 'This API is available to customer accounts only.'
            });
        }

        const { bookingId } = req.params;

        // Validate booking UUID
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(bookingId)) {
            return res.status(400).json({
                code: 'INVALID_BOOKING_ID',
                message: 'A valid booking ID is required.'
            });
        }

        // Fetch booking belonging to logged-in customer
        const result = await db.query(
            `
            SELECT
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

            INNER JOIN customer_profiles cp
                ON cp.id = b.customer_id

            LEFT JOIN drivers d
                ON d.id = b.assigned_driver_id

            LEFT JOIN vehicles v
                ON v.id = b.assigned_vehicle_id

            LEFT JOIN LATERAL (
                SELECT chamber_temp_c
                FROM telematics_snapshots
                WHERE booking_id = b.id
                ORDER BY recorded_at DESC
                LIMIT 1
            ) ts ON TRUE

            WHERE b.id = $1
              AND cp.user_id = $2

            LIMIT 1
            `,
            [bookingId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                code: 'BOOKING_NOT_FOUND',
                message: 'Booking was not found for this customer.'
            });
        }

        const booking = result.rows[0];

        // Map database status to API response status
        let status = booking.booking_status;

        if (booking.booking_status === 'searching') {
            status = 'searching_driver';
        } else if (booking.booking_status === 'assigned') {
            status = 'driver_assigned';
        }

        // Calculate remaining time from booking creation.
        // The initial dispatch window is 90 seconds.
        let timeRemainingSeconds = 0;

        if (booking.booking_status === 'searching') {
            const elapsedSeconds = Math.floor(
                (Date.now() - new Date(booking.created_at).getTime()) / 1000
            );

            timeRemainingSeconds = Math.max(
                0,
                90 - elapsedSeconds
            );
        }

        // No real dispatch matching service is connected yet.
        // Keep this consistent with Screen 10's current response.
        const eligibleDriversCount = 0;

        let assignedDriver = null;
        let preCooling = undefined;

        if (booking.assigned_driver_id && booking.driver_id) {
            const vehicleNames = {
                tata_407_14ft: 'Tata 407 14ft Reefer',
                eicher_20ft: 'Eicher 20ft Reefer',
                bharatbenz_24ft: 'BharatBenz 24ft Reefer',
                multi_axle_32ft: 'Multi-Axle 32ft Reefer'
            };

            const phone = booking.driver_phone || '';

            const maskedPhone = phone.length > 6
                ? `${phone.slice(0, 3)}${'X'.repeat(phone.length - 6)}${phone.slice(-3)}`
                : phone;

            assignedDriver = {
                name: booking.driver_name,
                phoneMasked: maskedPhone,
                photoUrl: booking.driver_photo,
                vehicleNumber: booking.registration_number,
                vehicleClass:
                    vehicleNames[booking.vehicle_class] ||
                    booking.vehicle_class,
                hygieneGrade: booking.hygiene_grade
                    ? booking.hygiene_grade.replace('grade_', '').toUpperCase()
                    : null,
                rating: Number(booking.average_rating || 0),
                tripsCompleted: booking.trips_completed || 0
            };

            preCooling = {
                status: booking.is_precooling_passed
                    ? 'completed'
                    : 'in_progress',
                currentTempC: booking.chamber_temp_c !== null
                    ? Number(booking.chamber_temp_c)
                    : null,
                targetTempC: Number(booking.target_setpoint_c),
                etaMinutes: null
            };
        }

        const response = {
            bookingId: booking.id,
            status,
            currentWave: 1,
            timeRemainingSeconds,
            eligibleDriversCount,
            assignedDriver
        };

        if (preCooling) {
            response.preCooling = preCooling;
        }

        return res.status(200).json(response);

    } catch (error) {
        console.error(
            '[SCREEN 11] Dispatch status error:',
            error
        );

        next(error);
    }
};

// API 2: Cancel Booking
exports.cancelBooking = async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
        // 1. Validate customer authentication
        const userId = req.user?.userId || req.user?.id;
        const userRole = String(req.user?.role || '').toLowerCase();

        if (!userId || userRole !== 'customer') {
            return res.status(403).json({
                code: 'CUSTOMER_ACCESS_REQUIRED',
                message: 'Only authenticated customers can cancel bookings.'
            });
        }

        // 2. Validate booking ID
        const { bookingId } = req.params;

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!bookingId || !uuidRegex.test(bookingId)) {
            return res.status(400).json({
                code: 'INVALID_BOOKING_ID',
                message: 'A valid booking ID is required.'
            });
        }

        // 3. Accept supported cancellation reason field names
        const reason = String(
            req.body?.reason ||
            req.body?.cancellationReason ||
            req.body?.reasonCode ||
            ''
        ).trim();

        if (!reason) {
            return res.status(400).json({
                code: 'INVALID_CANCELLATION_REASON',
                message: 'Cancellation reason is required.'
            });
        }

        if (reason.length > 200) {
            return res.status(400).json({
                code: 'INVALID_CANCELLATION_REASON',
                message: 'Cancellation reason cannot exceed 200 characters.'
            });
        }

        // 4. Get PostgreSQL connection
        if (!db.pool) {
            throw new Error('Database connection pool is not available.');
        }

        client = await db.pool.connect();

        await client.query('BEGIN');
        transactionStarted = true;

        // Helper for returning an error after rolling back
        const rollbackAndRespond = async (statusCode, response) => {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(statusCode).json(response);
        };

        // 5. Fetch booking and verify customer ownership
        const bookingResult = await client.query(
            `SELECT
          b.id,
          b.booking_ref,
          b.customer_id,
          b.contract_id,
          b.status,
          b.sub_status_label,
          b.assigned_driver_id,
          b.assigned_vehicle_id,
          b.fare_total_minor,
          b.payment_method,
          b.payment_status,
          b.created_at
       FROM bookings b
       INNER JOIN customer_profiles cp
          ON cp.id = b.customer_id
       WHERE b.id = $1
         AND cp.user_id = $2
       FOR UPDATE OF b`,
            [bookingId, userId]
        );

        if (bookingResult.rows.length === 0) {
            return await rollbackAndRespond(404, {
                code: 'BOOKING_NOT_FOUND',
                message: 'Booking not found for this customer.'
            });
        }

        const booking = bookingResult.rows[0];

        // 6. Check existing booking status
        if (booking.status === 'cancelled') {
            return await rollbackAndRespond(409, {
                code: 'BOOKING_ALREADY_CANCELLED',
                message: 'This booking has already been cancelled.'
            });
        }

        if (booking.status !== 'searching') {
            return await rollbackAndRespond(409, {
                code: 'BOOKING_NOT_CANCELLABLE',
                message: 'This booking cannot be cancelled at its current stage.'
            });
        }

        // 7. Do not cancel after driver or vehicle assignment
        if (booking.assigned_driver_id || booking.assigned_vehicle_id) {
            return await rollbackAndRespond(409, {
                code: 'DRIVER_ALREADY_ASSIGNED',
                message: 'This booking cannot be cancelled through the searching-stage cancellation API.'
            });
        }

        // 8. Check payment status before cancellation
        const paymentMethod = String(
            booking.payment_method || ''
        ).toLowerCase();

        const paymentStatus = String(
            booking.payment_status || ''
        ).toLowerCase();

        const capturedPaymentStatuses = [
            'paid',
            'captured',
            'settled',
            'success',
            'completed'
        ];

        if (capturedPaymentStatuses.includes(paymentStatus)) {
            return await rollbackAndRespond(503, {
                code: 'PAYMENT_REFUND_NOT_CONFIGURED',
                message: 'Payment was already captured. Refund integration is not configured, so the booking has not been cancelled.'
            });
        }

        let refundStatus = 'not_required';

        // Business credit is only marked authorized by the current
        // booking-creation implementation. That implementation does
        // not actually deduct the customer's utilized credit.
        if (
            paymentMethod === 'business_credit' &&
            paymentStatus === 'authorized'
        ) {
            refundStatus = 'not_required';
        } else if (
            ['pending', 'failed', 'voided', 'not_required', 'unpaid'].includes(
                paymentStatus
            )
        ) {
            refundStatus = 'not_required';
        } else if (paymentStatus === 'authorized') {
            return await rollbackAndRespond(503, {
                code: 'PAYMENT_REVERSAL_NOT_CONFIGURED',
                message: 'Payment reversal is not configured for this payment method. The booking has not been cancelled.'
            });
        } else {
            return await rollbackAndRespond(503, {
                code: 'PAYMENT_STATUS_UNSUPPORTED',
                message: 'The current payment status cannot be safely reversed. The booking has not been cancelled.'
            });
        }

        // 9. Validate booking amount
        const bookingAmountMinor = Number(booking.fare_total_minor || 0);

        if (
            !Number.isFinite(bookingAmountMinor) ||
            bookingAmountMinor < 0
        ) {
            return await rollbackAndRespond(500, {
                code: 'INVALID_BOOKING_AMOUNT',
                message: 'The booking amount stored in the database is invalid.'
            });
        }

        // 10. Cancel booking
        const updateResult = await client.query(
            `UPDATE bookings
       SET
          status = 'cancelled',
          sub_status_label = 'CANCELLED BY CUSTOMER',
          updated_at = NOW()
       WHERE id = $1
         AND status = 'searching'
         AND assigned_driver_id IS NULL
         AND assigned_vehicle_id IS NULL
       RETURNING id`,
            [bookingId]
        );

        if (updateResult.rowCount === 0) {
            return await rollbackAndRespond(409, {
                code: 'BOOKING_CANCELLATION_FAILED',
                message: 'Booking status changed or a driver was assigned. Please refresh and try again.'
            });
        }

        // 11. Restore contract trip if this booking used a contract
        let contractTripRestored = false;

        if (booking.contract_id) {
            const contractResult = await client.query(
                `UPDATE master_contracts
         SET
            remaining_volume_trips = remaining_volume_trips + 1,
            updated_at = NOW()
         WHERE id = $1
         RETURNING id`,
                [booking.contract_id]
            );

            contractTripRestored = contractResult.rowCount > 0;
        }

        // 12. Commit transaction
        await client.query('COMMIT');
        transactionStarted = false;

        // 13. Format booking and refund amounts
        const formatINR = (amountMinor) => {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 2
            }).format(amountMinor / 100);
        };

        // 14. Send response
        return res.status(200).json({
            bookingId: booking.id,
            bookingNumber: booking.booking_ref,
            status: 'cancelled',
            cancellationReason: reason,
            cancellationFeeMinor: 0,
            cancellationFeeFormatted: formatINR(0),
            bookingAmountMinor,
            bookingAmountFormatted: formatINR(bookingAmountMinor),
            refundAmountMinor: 0,
            refundAmountFormatted: formatINR(0),
            refundStatus,
            contractTripRestored,
            message: 'Booking cancelled successfully.'
        });

    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Cancellation rollback error:', rollbackError);
            }
        }

        console.error('Cancel booking error:', error);

        return res.status(500).json({
            code: 'CANCEL_BOOKING_FAILED',
            message: 'Unable to cancel booking at the moment.'
        });

    } finally {
        if (client) {
            client.release();
        }
    }
};

const crypto = require('crypto');

// API 3: Escalate Booking to Operations Desk
exports.escalateOps = async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
        const userId = req.user?.userId || req.user?.id;
        const role = String(req.user?.role || '').toLowerCase();

        if (!userId || role !== 'customer') {
            return res.status(403).json({
                code: 'CUSTOMER_ACCESS_REQUIRED',
                message: 'Only customers can escalate bookings.'
            });
        }

        const { bookingId } = req.params;
        const notes = String(req.body?.notes || '').trim();

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(bookingId || '')) {
            return res.status(400).json({
                code: 'INVALID_BOOKING_ID',
                message: 'A valid booking ID is required.'
            });
        }

        if (notes.length > 2000) {
            return res.status(400).json({
                code: 'INVALID_NOTES',
                message: 'Notes cannot exceed 2000 characters.'
            });
        }

        client = await db.pool.connect();
        await client.query('BEGIN');
        transactionStarted = true;

        const rollbackResponse = async (statusCode, data) => {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(statusCode).json(data);
        };

        // Check booking ownership and current status
        const bookingResult = await client.query(
            `SELECT
         b.id,
         b.booking_ref,
         b.status,
         b.created_at,
         b.assigned_driver_id,
         b.assigned_vehicle_id,
         cp.id AS customer_id
       FROM bookings b
       INNER JOIN customer_profiles cp
         ON cp.id = b.customer_id
       WHERE b.id = $1
         AND cp.user_id = $2
       FOR UPDATE OF b`,
            [bookingId, userId]
        );

        if (!bookingResult.rows.length) {
            return await rollbackResponse(404, {
                code: 'BOOKING_NOT_FOUND',
                message: 'Booking not found.'
            });
        }

        const booking = bookingResult.rows[0];

        // Only searching bookings can be escalated
        if (
            booking.status !== 'searching' ||
            booking.assigned_driver_id ||
            booking.assigned_vehicle_id
        ) {
            return await rollbackResponse(409, {
                code: 'BOOKING_NOT_ELIGIBLE_FOR_ESCALATION',
                message: 'Only searching bookings without an assigned driver can be escalated.'
            });
        }

        // Wait until the 90-second dispatch timer expires
        const elapsedSeconds = Math.floor(
            (Date.now() - new Date(booking.created_at).getTime()) / 1000
        );

        if (elapsedSeconds < 90) {
            return await rollbackResponse(409, {
                code: 'DISPATCH_TIMEOUT_NOT_REACHED',
                message: 'Escalation is available after 90 seconds.',
                remainingSeconds: 90 - Math.max(0, elapsedSeconds)
            });
        }

        // Avoid duplicate active escalation tickets
        const existingTicket = await client.query(
            `SELECT ticket_code
       FROM support_tickets
       WHERE booking_id = $1
         AND customer_id = $2
         AND issue_category = 'dispatch_escalation'
         AND status IN ('open', 'in_progress', 'awaiting_customer')
       ORDER BY created_at DESC
       LIMIT 1`,
            [bookingId, booking.customer_id]
        );

        let ticketCode;

        if (existingTicket.rows.length) {
            ticketCode = existingTicket.rows[0].ticket_code;
        } else {
            ticketCode =
                'OPS-' +
                Date.now() +
                '-' +
                crypto.randomBytes(3).toString('hex').toUpperCase();

            const description =
                'Manual dispatch allocation requested. Notes: ' +
                (notes || 'No additional notes provided.');

            await client.query(
                `INSERT INTO support_tickets (
           ticket_code,
           customer_id,
           booking_id,
           issue_category,
           title,
           description,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
                [
                    ticketCode,
                    booking.customer_id,
                    bookingId,
                    'dispatch_escalation',
                    'Manual Dispatch Allocation Request',
                    description
                ]
            );
        }

        // Update display label without changing booking status
        await client.query(
            `UPDATE bookings
       SET sub_status_label = 'ESCALATED TO OPS',
           updated_at = NOW()
       WHERE id = $1`,
            [bookingId]
        );

        await client.query('COMMIT');
        transactionStarted = false;

        return res.status(200).json({
            bookingId: booking.id,
            status: 'escalated_to_ops',
            queuePriority: 'high',
            opsTicketRef: ticketCode,
            message: 'Manual dispatch request recorded in the operations support queue.'
        });

    } catch (error) {
        if (client && transactionStarted) {
            await client.query('ROLLBACK').catch(() => { });
            transactionStarted = false;
        }

        console.error('Escalate booking error:', error);

        return res.status(500).json({
            code: 'ESCALATION_FAILED',
            message: 'Unable to escalate booking at the moment.'
        });

    } finally {
        if (client) client.release();
    }
};

// SCREEN 12 - API 1
// GET Booking Confirmation and Driver Details

exports.getBookingConfirmation = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const role = String(req.user?.role || '').toLowerCase();

        if (!userId || role !== 'customer') {
            return res.status(403).json({
                code: 'CUSTOMER_ACCESS_REQUIRED',
                message: 'Only authenticated customers can view booking confirmation.'
            });
        }

        const { bookingId } = req.params;

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(bookingId || '')) {
            return res.status(400).json({
                code: 'INVALID_BOOKING_ID',
                message: 'A valid booking ID is required.'
            });
        }

        // Fetch booking, driver, vehicle and latest IoT reading
        const result = await db.query(
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

       INNER JOIN customer_profiles cp
          ON cp.id = b.customer_id

       LEFT JOIN drivers d
          ON d.id = b.assigned_driver_id

       LEFT JOIN vehicles v
          ON v.id = b.assigned_vehicle_id

       LEFT JOIN LATERAL (
          SELECT
              chamber_temp_c,
              probe_temp_c,
              recorded_at
          FROM telematics_snapshots
          WHERE booking_id = b.id
          ORDER BY recorded_at DESC
          LIMIT 1
       ) ts ON TRUE

       WHERE b.id = $1
         AND cp.user_id = $2`,
            [bookingId, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                code: 'BOOKING_NOT_FOUND',
                message: 'Booking not found for this customer.'
            });
        }

        const booking = result.rows[0];

        // Map database booking status
        const statusMap = {
            searching: 'searching_driver',
            assigned: 'driver_assigned',
            pre_cooling: 'pre_cooling'
        };

        const status =
            statusMap[booking.status] || booking.status;

        // Driver and vehicle details are returned only
        // when an actual driver is assigned.
        let driver = null;

        if (booking.driver_id) {
            driver = {
                name: booking.driver_name,
                photoUrl: booking.avatar_url,
                vehicleNumber: booking.registration_number,
                vehicleClass: booking.vehicle_class,
                hygieneGrade: String(
                    booking.hygiene_grade || ''
                ).replace('grade_', '').toUpperCase(),
                rating: booking.average_rating !== null
                    ? Number(booking.average_rating)
                    : null,
                completedTripsCount: booking.trips_completed
            };
        }

        const currentTemp =
            booking.chamber_temp_c !== null
                ? Number(booking.chamber_temp_c)
                : booking.precooling_verified_temp_c !== null
                    ? Number(booking.precooling_verified_temp_c)
                    : null;

        let precoolingStatus = 'pending';

        if (booking.is_precooling_passed) {
            precoolingStatus = 'completed';
        } else if (booking.driver_id && currentTemp !== null) {
            precoolingStatus = 'in_progress';
        }

        return res.status(200).json({
            bookingId: booking.id,
            bookingNumber: booking.booking_ref,
            lrNumber: booking.lr_number,
            status,
            pickupEtaMinutes: null,

            driver,

            preCooling: {
                status: precoolingStatus,
                currentTempC: currentTemp,
                targetTempC: Number(booking.target_setpoint_c),
                etaMinutes: null,
                chamberStatus: booking.is_precooling_passed
                    ? 'ready_for_loading'
                    : booking.driver_id
                        ? 'loading_locked_until_target_met'
                        : 'awaiting_driver_assignment'
            }
        });

    } catch (error) {
        console.error('Booking confirmation error:', error);

        return res.status(500).json({
            code: 'BOOKING_CONFIRMATION_FAILED',
            message: 'Unable to fetch booking confirmation.'
        });
    }
};
// =====================================================
// SCREEN 12 - API 2
// POST /api/v1/trips/:bookingId/agora/token
// Generate Agora RTC Token
// =====================================================

exports.generateAgoraToken = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const role = String(req.user?.role || '').toLowerCase();

        if (!userId || role !== 'customer') {
            return res.status(403).json({
                code: 'CUSTOMER_ACCESS_REQUIRED',
                message: 'Only customers can generate Agora call tokens.'
            });
        }

        const { bookingId } = req.params;

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(bookingId || '')) {
            return res.status(400).json({
                code: 'INVALID_BOOKING_ID',
                message: 'A valid booking ID is required.'
            });
        }

        // Verify booking ownership and assigned driver
        const result = await db.query(
            `
            SELECT
                b.id,
                b.booking_ref,
                b.status,
                b.assigned_driver_id,
                d.user_id AS driver_user_id
            FROM bookings b
            INNER JOIN customer_profiles cp
                ON cp.id = b.customer_id
            LEFT JOIN drivers d
                ON d.id = b.assigned_driver_id
            WHERE b.id = $1
              AND cp.user_id = $2
            LIMIT 1
            `,
            [bookingId, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                code: 'BOOKING_NOT_FOUND',
                message: 'Booking not found for this customer.'
            });
        }

        const booking = result.rows[0];

        if (
            ['cancelled', 'delivered', 'failed_delivery', 'disputed']
                .includes(String(booking.status).toLowerCase())
        ) {
            return res.status(409).json({
                code: 'BOOKING_NOT_ACTIVE',
                message: 'Agora calling is unavailable for this booking.'
            });
        }

        if (!booking.assigned_driver_id) {
            return res.status(409).json({
                code: 'DRIVER_NOT_ASSIGNED',
                message: 'Agora call token is available only after a driver has been assigned.'
            });
        }

        if (!booking.driver_user_id) {
            return res.status(409).json({
                code: 'DRIVER_ACCOUNT_NOT_LINKED',
                message: 'The assigned driver does not have a linked user account.'
            });
        }

        // Read Agora credentials from environment
        const appId = process.env.AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;

        if (!appId || !appCertificate) {
            return res.status(503).json({
                code: 'AGORA_NOT_CONFIGURED',
                message: 'Agora credentials are not configured.'
            });
        }

        // Generate a unique channel for this booking
        const channelName =
            'call_trip_' + String(booking.booking_ref).replace(/[^a-zA-Z0-9]/g, '');

        // Generate stable numeric Agora UIDs
        const getAgoraUid = (id) => {
            const hash = crypto
                .createHash('sha256')
                .update(String(id))
                .digest();

            return hash.readUInt32BE(0) || 1;
        };

        const uid = getAgoraUid(userId);
        const peerUid = getAgoraUid(booking.driver_user_id);

        if (uid === peerUid) {
            return res.status(500).json({
                code: 'AGORA_UID_COLLISION',
                message: 'Unable to generate distinct call participant IDs.'
            });
        }

        // Token validity: 1 hour
        const expiresInSeconds = 3600;

        const rtcToken = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            uid,
            RtcRole.PUBLISHER,
            expiresInSeconds,
            expiresInSeconds
        );

        return res.status(200).json({
            agoraAppId: appId,
            channelName,
            rtcToken,
            uid,
            peerUid,
            expiresInSeconds
        });

    } catch (error) {
        console.error('[SCREEN 12] Agora token error:', error);

        return res.status(500).json({
            code: 'AGORA_TOKEN_GENERATION_FAILED',
            message: 'Unable to generate Agora call token.'
        });
    }
};
// =====================================================
// SCREEN 12 - API 3
// GET /api/v1/trips/:bookingId/chat/messages
// Fetch In-App Chat Message History
// =====================================================

exports.getChatMessages = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const role = String(req.user?.role || '').toLowerCase();

        if (!userId || role !== 'customer') {
            return res.status(403).json({
                code: 'CUSTOMER_ACCESS_REQUIRED',
                message: 'Only customers can view trip chat messages.'
            });
        }

        const { bookingId } = req.params;

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(bookingId || '')) {
            return res.status(400).json({
                code: 'INVALID_BOOKING_ID',
                message: 'A valid booking ID is required.'
            });
        }

        // Verify that this booking belongs to the logged-in customer
        const bookingResult = await db.query(
            `
            SELECT b.id
            FROM bookings b
            INNER JOIN customer_profiles cp
                ON cp.id = b.customer_id
            WHERE b.id = $1
              AND cp.user_id = $2
            LIMIT 1
            `,
            [bookingId, userId]
        );

        if (!bookingResult.rows.length) {
            return res.status(404).json({
                code: 'BOOKING_NOT_FOUND',
                message: 'Booking not found for this customer.'
            });
        }

        // Fetch messages in chronological order
        const messageResult = await db.query(
            `
            SELECT
                m.id,
                m.sender_type,
                m.message_text,
                m.sent_at,

                CASE
                    WHEN LOWER(m.sender_type) = 'driver'
                    THEN COALESCE(d.full_name, 'Driver')

                    WHEN LOWER(m.sender_type) = 'customer'
                    THEN COALESCE(
                        cp.display_name,
                        cp.trade_name,
                        cp.company_name,
                        'Customer'
                    )

                    ELSE COALESCE(
                        d.full_name,
                        cp.display_name,
                        cp.trade_name,
                        cp.company_name,
                        m.sender_type
                    )
                END AS sender_name

            FROM trip_chat_messages m

            LEFT JOIN drivers d
                ON LOWER(m.sender_type) = 'driver'
                AND (d.user_id = m.sender_id OR d.id = m.sender_id)

            LEFT JOIN customer_profiles cp
                ON LOWER(m.sender_type) = 'customer'
                AND (cp.user_id = m.sender_id OR cp.id = m.sender_id)

            WHERE m.booking_id = $1

            ORDER BY m.sent_at ASC
            `,
            [bookingId]
        );

        const messages = messageResult.rows.map(message => ({
            messageId: message.id,
            sender: String(message.sender_type || 'unknown').toLowerCase(),
            senderName: message.sender_name,
            text: message.message_text,
            sentAt: message.sent_at
        }));

        return res.status(200).json({
            tripId: bookingId,
            messages
        });

    } catch (error) {
        console.error('[SCREEN 12] Chat history error:', error);

        return res.status(500).json({
            code: 'CHAT_HISTORY_FETCH_FAILED',
            message: 'Unable to fetch chat messages.'
        });
    }
};