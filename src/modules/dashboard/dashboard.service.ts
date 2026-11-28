import {
  Injectable,
  BadRequestException,
  GoneException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'crypto';

import {
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
} from 'fs/promises';

import { tmpdir } from 'os';
import { join } from 'path';
@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) { }

  async getDashboardSummary(userId: string) {
    if (!userId) {
      return {
        summary: {
          totalBookings: 0,
          activeBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
        },
      };
    }

    try {
      const [total, active, completed, cancelled] = await Promise.all([
        this.db.query(
          `SELECT COUNT(*) FROM booking_quotes WHERE customer_id::text = $1`,
          [userId],
        ),
        this.db.query(
          `SELECT COUNT(*) FROM booking_quotes
           WHERE customer_id::text = $1 AND status IN ('CONFIRMED','DRIVER_ASSIGNED','IN_TRANSIT','searching','assigned','in_transit')`,
          [userId],
        ),
        this.db.query(
          `SELECT COUNT(*) FROM booking_quotes
           WHERE customer_id::text = $1 AND status IN ('DELIVERED','completed')`,
          [userId],
        ),
        this.db.query(
          `SELECT COUNT(*) FROM booking_quotes
           WHERE customer_id::text = $1 AND status IN ('CANCELLED','cancelled')`,
          [userId],
        ),
      ]);

      return {
        summary: {
          totalBookings: parseInt(total.rows[0]?.count || '0', 10),
          activeBookings: parseInt(active.rows[0]?.count || '0', 10),
          completedBookings: parseInt(completed.rows[0]?.count || '0', 10),
          cancelledBookings: parseInt(cancelled.rows[0]?.count || '0', 10),
        },
      };
    } catch (e) {
      return {
        summary: {
          totalBookings: 0,
          activeBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
        },
      };
    }
  }

  async getActiveShipments(userId: string) {
    if (!userId) {
      return { totalActiveCount: 0, shipments: [] };
    }

    try {
      // Find customer profile id if exists
      const profRes = await this.db.query(
        `SELECT id FROM customer_profiles WHERE user_id::text = $1 LIMIT 1`,
        [userId],
      );
      const customerId = profRes.rows[0]?.id;

      const result = await this.db.query(
        `SELECT
           bq.id,
           bq.booking_ref,
           bq.status,
           bq.pickup_address,
           bq.drop_address,
           bq.scheduled_pickup_at,
           bq.actual_pickup_at,
           bq.vehicle_class,
           bq.created_at
         FROM booking_quotes bq
         WHERE (bq.customer_id::text = $1 OR ($2::uuid IS NOT NULL AND bq.customer_id = $2))
           AND bq.status IN ('CONFIRMED','DRIVER_ASSIGNED','IN_TRANSIT','searching','assigned','in_transit','at_pickup','loading')
         ORDER BY bq.created_at DESC`,
        [userId, customerId || null],
      );

      return {
        totalActiveCount: result.rows.length,
        shipments: result.rows.map((row) => ({
          id: row.id,
          bookingRef: row.booking_ref,
          status: row.status,
          pickupAddress: row.pickup_address,
          dropAddress: row.drop_address,
          scheduledPickupAt: row.scheduled_pickup_at,
          actualPickupAt: row.actual_pickup_at,
          vehicleClass: row.vehicle_class,
          createdAt: row.created_at,
        })),
      };
    } catch (err) {
      console.warn('Dashboard active shipments query error:', err.message);
      return { totalActiveCount: 0, shipments: [] };
    }
  }

  // SCREEN 13 - API 1: Fetch Filtered Shipments
  async getShipments(
    userId: string,
    filters: {
      status: string;
      search: string;
      dateRange: string;
      page: string;
      limit: string;
    },
  ) {
    if (!userId) {
      throw new BadRequestException('User authentication is required.');
    }

    const status = String(filters.status || 'all').toLowerCase();
    const search = String(filters.search || '').trim();
    const dateRange = String(filters.dateRange || '30d').toLowerCase();
    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 20);

    const allowedStatuses = [
      'all',
      'in_transit',
      'scheduled',
      'delivered',
      'disputed',
      'cancelled',
    ];

    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException('Invalid shipment status filter.');
    }

    if (!['30d', '90d', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange.');
    }

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException('Invalid pagination values.');
    }

    const ownedCte = `
      WITH owned_bookings AS (
        SELECT
          b.*,
          CASE
            WHEN LOWER(b.status::text) = 'disputed'
              OR EXISTS (
                SELECT 1
                FROM claims c
                WHERE c.booking_id = b.id
              )
              THEN 'disputed'

            WHEN LOWER(b.status::text) IN
              ('in_transit', 'en_route')
              THEN 'in_transit'

            WHEN LOWER(b.status::text) IN
              ('delivered', 'completed')
              THEN 'delivered'

            WHEN LOWER(b.status::text) IN
              ('cancelled', 'canceled')
              THEN 'cancelled'

            ELSE 'scheduled'
          END AS shipment_status

        FROM bookings b
        WHERE
          b.user_id::text = $1
          OR EXISTS (
            SELECT 1
            FROM customer_profiles cp
            WHERE cp.id = b.customer_id
              AND cp.user_id::text = $1
          )
      )
    `;

    // Get counts for all shipment status tabs.
    const countsResult = await this.db.query(
      `${ownedCte}
       SELECT
         COUNT(*) AS all_count,
         COUNT(*) FILTER (
           WHERE shipment_status = 'in_transit'
         ) AS in_transit,
         COUNT(*) FILTER (
           WHERE shipment_status = 'scheduled'
         ) AS scheduled,
         COUNT(*) FILTER (
           WHERE shipment_status = 'delivered'
         ) AS delivered,
         COUNT(*) FILTER (
           WHERE shipment_status = 'disputed'
         ) AS disputed,
         COUNT(*) FILTER (
           WHERE shipment_status = 'cancelled'
         ) AS cancelled
       FROM owned_bookings`,
      [userId],
    );

    // Fetch only the requested page.
    const offset = (page - 1) * limit;

    const listResult = await this.db.query(
      `${ownedCte},
       filtered_shipments AS (
         SELECT *
         FROM owned_bookings f
         WHERE
           ($2 = 'all' OR f.shipment_status = $2)

           AND (
             $3 = ''
             OR CONCAT_WS(
               ' ',
               f.booking_ref,
               f.lr_number,
               f.origin_city,
               f.destination_city,
               f.origin_address,
               f.destination_address
             ) ILIKE '%' || $3 || '%'
           )

           AND (
             $4 = 'all'
             OR COALESCE(
               f.pickup_date::timestamptz,
               f.created_at
             ) >= NOW() -
               CASE
                 WHEN $4 = '30d' THEN INTERVAL '30 days'
                 ELSE INTERVAL '90 days'
               END
           )
       )

       SELECT
         f.id,
         f.booking_ref,
         f.lr_number,
         f.origin_city,
         f.origin_address,
         f.destination_city,
         f.destination_address,
         COALESCE(
           f.pickup_date::text,
           f.pickup_window_start::text,
           f.created_at::text
         ) AS pickup_date,

         f.shipment_status,
         f.sla_min_temp_c,
         f.sla_max_temp_c,
         f.target_setpoint_c,

         q.cargo_description,
         COALESCE(
           t.precooling_status,
           ''
         ) AS precooling_status,

         COALESCE(
           temperature.manual_temp_c,
           t.precooling_chamber_temp_c
         ) AS current_temp_c,

         latest_claim.id AS claim_id,
         latest_claim.status AS claim_status,
         latest_claim.claim_value_minor,
         latest_claim.is_within_24hr_window

       FROM filtered_shipments f

       LEFT JOIN LATERAL (
         SELECT
           bq.cargo_description
         FROM booking_quotes bq
         WHERE
           bq.converted_booking_id = f.id
           OR (
             f.quote_id IS NOT NULL
             AND bq.quote_id = f.quote_id
           )
         ORDER BY
           (bq.converted_booking_id = f.id) DESC NULLS LAST
         LIMIT 1
       ) q ON TRUE

       LEFT JOIN LATERAL (
         SELECT
           t.id,
           t.precooling_status,
           t.precooling_chamber_temp_c
         FROM trips t
         WHERE t.booking_id = f.id
         ORDER BY t.created_at DESC
         LIMIT 1
       ) t ON TRUE

       LEFT JOIN LATERAL (
         SELECT
           tm.manual_temp_c
         FROM trip_manual_temp_logs tm
         WHERE tm.trip_id = t.id
         ORDER BY tm.reading_timestamp DESC
         LIMIT 1
       ) temperature ON TRUE

       LEFT JOIN LATERAL (
         SELECT
           c.id,
           c.status,
           c.claim_value_minor,
           c.is_within_24hr_window
         FROM claims c
         WHERE c.booking_id = f.id
         ORDER BY c.filed_at DESC
         LIMIT 1
       ) latest_claim ON TRUE

       ORDER BY COALESCE(
         f.pickup_date::timestamptz,
         f.created_at
       ) DESC

       LIMIT $5 OFFSET $6`,
      [userId, status, search, dateRange, limit, offset],
    );

    const countRow = countsResult.rows[0];

    const filteredCountResult = await this.db.query(
      `${ownedCte}
       SELECT COUNT(*) AS total
       FROM owned_bookings f
       WHERE ($2 = 'all' OR f.shipment_status = $2)
         AND (
           $3 = ''
           OR CONCAT_WS(
             ' ',
             f.booking_ref,
             f.lr_number,
             f.origin_city,
             f.destination_city,
             f.origin_address,
             f.destination_address
           ) ILIKE '%' || $3 || '%'
         )
         AND (
           $4 = 'all'
           OR COALESCE(
             f.pickup_date::timestamptz,
             f.created_at
           ) >= NOW() -
             CASE
               WHEN $4 = '30d' THEN INTERVAL '30 days'
               ELSE INTERVAL '90 days'
             END
         )`,
      [userId, status, search, dateRange],
    );

    const totalRecords = Number(
      filteredCountResult.rows[0]?.total || 0,
    );

    const formatAmount = (minor: any) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(Number(minor || 0) / 100);

    const shipments = listResult.rows.map((row: any) => {
      const temp =
        row.current_temp_c == null
          ? null
          : Number(row.current_temp_c);

      const minTemp =
        row.sla_min_temp_c == null
          ? null
          : Number(row.sla_min_temp_c);

      const maxTemp =
        row.sla_max_temp_c == null
          ? null
          : Number(row.sla_max_temp_c);

      const temperatureStatus =
        temp === null || minTemp === null || maxTemp === null
          ? null
          : temp >= minTemp && temp <= maxTemp
            ? 'safe'
            : 'excursion_reported';

      const claim = row.claim_id
        ? {
          claimId: row.claim_id,
          status: row.claim_status,
          amountMinor: Number(row.claim_value_minor),
          amountFormatted: formatAmount(
            row.claim_value_minor,
          ),
          isWithin24HrWindow:
            row.is_within_24hr_window,
        }
        : null;

      const targetTemp =
        row.target_setpoint_c == null
          ? null
          : Number(row.target_setpoint_c);

      const minLabel =
        minTemp == null ? null : `${minTemp}°C`;

      const maxLabel =
        maxTemp == null ? null : `${maxTemp}°C`;

      const tempBandLabel =
        targetTemp != null
          ? `Target: ${targetTemp}°C`
          : minLabel && maxLabel
            ? `Target range: ${minLabel} to ${maxLabel}`
            : null;

      const isPreCoolingActive = [
        'in_progress',
        'active',
        'running',
      ].includes(
        String(row.precooling_status).toLowerCase(),
      );

      const actions =
        row.shipment_status === 'disputed'
          ? ['view_claim']
          : row.shipment_status === 'in_transit'
            ? ['track_live']
            : ['details'];

      return {
        shipmentId: row.id,
        bookingRef: row.booking_ref,
        lrNumber: row.lr_number,
        origin:
          row.origin_city || row.origin_address,
        destination:
          row.destination_city || row.destination_address,
        pickupDate: row.pickup_date,
        cargoDescription: row.cargo_description,
        tempBandLabel,
        currentTempC: temp,
        tempStatus: temperatureStatus,
        status: row.shipment_status,
        isPreCoolingActive,
        claim,
        actions,
      };
    });

    return {
      countsByStatus: {
        all: Number(countRow.all_count),
        in_transit: Number(countRow.in_transit),
        scheduled: Number(countRow.scheduled),
        delivered: Number(countRow.delivered),
        disputed: Number(countRow.disputed),
        cancelled: Number(countRow.cancelled),
      },
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },
      shipments,
    };
  }
  private getShipmentExportSecret(): string {
    const secret = process.env.SHIPMENT_EXPORT_SECRET;

    if (!secret || secret.length < 32) {
      throw new InternalServerErrorException(
        'SHIPMENT_EXPORT_SECRET is not configured correctly.',
      );
    }

    return secret;
  }

  async exportShipments(
    userId: string,
    filters: {
      status: string;
      dateRange: string;
    },
  ) {
    if (!userId) {
      throw new BadRequestException('User authentication is required.');
    }

    // Reuse the existing filtered shipments API in pages of 100.
    const shipments: any[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await this.getShipments(userId, {
        status: filters.status || 'all',
        search: '',
        dateRange: filters.dateRange || 'all',
        page: String(page),
        limit: '100',
      });

      shipments.push(...result.shipments);
      totalPages = result.pagination.totalPages;
      page++;
    } while (page <= totalPages);

    const headers = [
      'Shipment ID',
      'Booking Reference',
      'LR Number',
      'Origin',
      'Destination',
      'Pickup Date',
      'Cargo Description',
      'Temperature Band',
      'Current Temperature (C)',
      'Temperature Status',
      'Shipment Status',
      'Pre-cooling Active',
      'Claim ID',
      'Claim Status',
      'Claim Amount Minor',
      'Claim Amount Formatted',
      'Within 24 Hour Window',
    ];

    const csvCell = (value: any): string => {
      const text = value == null ? '' : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csvRows = shipments.map((shipment) => [
      shipment.shipmentId,
      shipment.bookingRef,
      shipment.lrNumber,
      shipment.origin,
      shipment.destination,
      shipment.pickupDate,
      shipment.cargoDescription,
      shipment.tempBandLabel,
      shipment.currentTempC,
      shipment.tempStatus,
      shipment.status,
      shipment.isPreCoolingActive,
      shipment.claim?.claimId,
      shipment.claim?.status,
      shipment.claim?.amountMinor,
      shipment.claim?.amountFormatted,
      shipment.claim?.isWithin24HrWindow,
    ]);

    const csvContent =
      '\uFEFF' +
      [
        headers.map(csvCell).join(','),
        ...csvRows.map((row) => row.map(csvCell).join(',')),
      ].join('\r\n');

    const generatedAt = new Date();
    const expiresAt = Math.floor(generatedAt.getTime() / 1000) + 1800;
    const fileId = randomUUID();

    const timestamp = generatedAt
      .toISOString()
      .replace(/\D/g, '')
      .slice(0, 14);

    const fileName = `ColdRoute_Shipments_Export_${timestamp}.csv`;

    const exportDirectory = join(
      tmpdir(),
      'coldroute-shipments-exports',
    );

    await mkdir(exportDirectory, { recursive: true });

    // Remove expired export files when a new export is generated.
    const existingFiles = await readdir(exportDirectory);

    for (const existingFile of existingFiles) {
      const match = /^([0-9a-f-]{36})\.(\d+)\.csv$/i.exec(
        existingFile,
      );

      if (match && Number(match[2]) <= Math.floor(Date.now() / 1000)) {
        await unlink(join(exportDirectory, existingFile)).catch(() => { });
      }
    }

    const filePath = join(
      exportDirectory,
      `${fileId}.${expiresAt}.csv`,
    );

    await writeFile(filePath, csvContent, {
      encoding: 'utf8',
      flag: 'wx',
    });

    // Sign the download token using the private environment secret.
    const payload = `${fileId}.${expiresAt}.${fileName}`;

    const signature = createHmac(
      'sha256',
      this.getShipmentExportSecret(),
    )
      .update(payload)
      .digest('base64url');

    const token = Buffer.from(
      `${payload}.${signature}`,
    ).toString('base64url');

    return {
      token,
      fileName,
      generatedAt: generatedAt.toISOString(),
      expiresInSeconds: 1800,
    };
  }

  async getShipmentExport(token: string) {
    const secret = this.getShipmentExportSecret();

    let decoded: string;

    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      throw new NotFoundException('Invalid export download link.');
    }

    const parts = decoded.split('.');

    if (parts.length !== 4) {
      throw new NotFoundException('Invalid export download link.');
    }

    const [fileId, expiresText, fileName, signature] = parts;

    if (
      !/^[0-9a-f-]{36}$/i.test(fileId) ||
      !/^\d+$/.test(expiresText) ||
      !/^[A-Za-z0-9_-]+\.csv$/.test(fileName)
    ) {
      throw new NotFoundException('Invalid export download link.');
    }

    const payload = `${fileId}.${expiresText}.${fileName}`;

    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('base64url');

    const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
    const actualBuffer = Buffer.from(signature, 'base64url');

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new NotFoundException('Invalid export download link.');
    }

    const expiresAt = Number(expiresText);

    if (expiresAt <= Math.floor(Date.now() / 1000)) {
      const expiredPath = join(
        tmpdir(),
        'coldroute-shipments-exports',
        `${fileId}.${expiresAt}.csv`,
      );

      await unlink(expiredPath).catch(() => { });

      throw new GoneException('This export download link has expired.');
    }

    const filePath = join(
      tmpdir(),
      'coldroute-shipments-exports',
      `${fileId}.${expiresAt}.csv`,
    );

    try {
      const content = await readFile(filePath, 'utf8');

      return {
        fileName,
        content,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new GoneException('The exported CSV file is no longer available.');
      }

      throw error;
    }
  }

}
