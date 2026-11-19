
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import PDFDocument = require('pdfkit');

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  private async getBooking(bookingId: string, userId: string) {
    const result = await this.db.getPool().query(
      `SELECT
          b.id,
          b.booking_ref,
          b.customer_id,
          b.sla_min_temp_c,
          b.sla_max_temp_c,
          b.target_setpoint_c,
          cp.user_id
       FROM bookings b
       JOIN customer_profiles cp ON cp.id = b.customer_id
       WHERE b.id = $1`,
      [bookingId],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Booking not found');
    }

    if (result.rows[0].user_id !== userId) {
      throw new ForbiddenException(
        'You are not allowed to access this booking',
      );
    }

    return result.rows[0];
  }

  private getResolution(value?: string): string {
    const allowed = ['1min', '5min', '15min', '1hr'];
    const resolution = value || '15min';

    if (!allowed.includes(resolution)) {
      throw new BadRequestException(
        'Resolution must be 1min, 5min, 15min or 1hr',
      );
    }

    return resolution;
  }

  private calculateMkt(temperatures: number[]): number | null {
    if (!temperatures.length) return null;

    const R = 8.314;
    const Ea = 83100;

    const values = temperatures.map((temp) => {
      const kelvin = temp + 273.15;
      return Math.exp(-Ea / (R * kelvin));
    });

    const average =
      values.reduce((sum, value) => sum + value, 0) / values.length;

    return Number((-Ea / (R * Math.log(average) - 273.15)).toFixed(2));
  }

  async getTemperatureAnalytics(
    bookingId: string,
    userId: string,
    resolution?: string,
    includeHumidity = false,
  ) {
    const booking = await this.getBooking(bookingId, userId);
    const interval = this.getResolution(resolution);

    const readingsResult = await this.db.getPool().query(
      `SELECT
          date_bin(
            $2::interval,
            recorded_at,
            TIMESTAMPTZ '2000-01-01'
          ) AS timestamp,
          AVG(chamber_temp_c)::numeric(6,2) AS temp_c,
          AVG(humidity_percent)::numeric(6,2) AS humidity_percent,
          AVG(latitude)::numeric(10,7) AS gps_lat,
          AVG(longitude)::numeric(10,7) AS gps_lng
       FROM telematics_snapshots
       WHERE booking_id = $1
       GROUP BY 1
       ORDER BY 1 ASC`,
      [bookingId, interval],
    );

    const rawReadings = readingsResult.rows;

    const temperatures = rawReadings.map((r) => Number(r.temp_c));

    const minTemp = temperatures.length
      ? Math.min(...temperatures)
      : null;

    const maxTemp = temperatures.length
      ? Math.max(...temperatures)
      : null;

    const lowerLimit = Number(booking.sla_min_temp_c);
    const upperLimit = Number(booking.sla_max_temp_c);
    const setpoint = Number(booking.target_setpoint_c);

    const outsideReadings = rawReadings.filter((r) => {
      const temp = Number(r.temp_c);
      return temp < lowerLimit || temp > upperLimit;
    });

    const compliancePercent = temperatures.length
      ? Number(
          (
            ((temperatures.length - outsideReadings.length) /
              temperatures.length) *
            100
          ).toFixed(2),
        )
      : null;

    let excursionMinutes = 0;

    for (let i = 0; i < rawReadings.length; i++) {
      const current = rawReadings[i];
      const temp = Number(current.temp_c);

      if (temp < lowerLimit || temp > upperLimit) {
        if (i < rawReadings.length - 1) {
          const next = rawReadings[i + 1];
          const difference =
            new Date(next.timestamp).getTime() -
            new Date(current.timestamp).getTime();

          excursionMinutes += Math.max(0, difference / 60000);
        }
      }
    }

    const chartReadings = await Promise.all(
      rawReadings.map(async (r) => {
        let locationLabel: string | null = null;

        if (r.gps_lat !== null && r.gps_lng !== null) {
          locationLabel = null;
        }

        const reading: any = {
          timestamp: r.timestamp,
          tempC: Number(r.temp_c),
          gpsLat: r.gps_lat === null ? null : Number(r.gps_lat),
          gpsLng: r.gps_lng === null ? null : Number(r.gps_lng),
          locationLabel,
        };

        if (includeHumidity) {
          reading.humidityPercent =
            r.humidity_percent === null
              ? null
              : Number(r.humidity_percent);
        }

        return reading;
      }),
    );

    const excursionEvents = outsideReadings.map((r) => ({
      timestamp: r.timestamp,
      tempC: Number(r.temp_c),
      type:
        Number(r.temp_c) > upperLimit
          ? 'upper_breach'
          : 'lower_breach',
    }));

    return {
      bookingRef: booking.booking_ref,
      compliancePercent,
      breachCount: excursionEvents.length,
      totalExcursionMinutes: Number(excursionMinutes.toFixed(2)),
      sla: {
        upperBreachLimitC: upperLimit,
        lowerBreachLimitC: lowerLimit,
        chamberSetpointC: setpoint,
        label: `${setpoint}°C TO ${lowerLimit}°C SLA`,
      },
      stats: {
        minTempC: minTemp,
        maxTempC: maxTemp,
        mktC: this.calculateMkt(temperatures),
        avgHumidityPercent:
          includeHumidity && rawReadings.length
            ? Number(
                (
                  rawReadings.reduce(
                    (sum, r) =>
                      sum +
                      (r.humidity_percent === null
                        ? 0
                        : Number(r.humidity_percent)),
                    0,
                  ) / rawReadings.length
                ).toFixed(2),
              )
            : null,
      },
      chartMeta: {
        xAxisStart: rawReadings[0]?.timestamp || null,
        xAxisEnd: rawReadings[rawReadings.length - 1]?.timestamp || null,
        yAxisMinC:
          minTemp === null ? null : Math.floor(minTemp - 1),
        yAxisMaxC:
          maxTemp === null ? null : Math.ceil(maxTemp + 1),
        lines: [
          {
            id: 'upper_breach',
            labelKey: 'Upper Breach Limit',
            valueC: upperLimit,
            style: 'dashed_red',
          },
          {
            id: 'setpoint',
            labelKey: 'Chamber Setpoint',
            valueC: setpoint,
            style: 'dashed_green',
          },
          {
            id: 'lower_breach',
            labelKey: 'Lower Breach Limit',
            valueC: lowerLimit,
            style: 'dashed_blue',
          },
          {
            id: 'actual_temp',
            labelKey: 'Actual Temperature',
            style: 'solid_green',
          },
        ],
      },
      readings: chartReadings,
      excursionEvents,
    };
  }

  async getDoorLog(bookingId: string, userId: string) {
    const booking = await this.getBooking(bookingId, userId);

    const result = await this.db.getPool().query(
      `SELECT
          id,
          opened_at,
          closed_at,
          duration_minutes,
          location_label,
          event_type,
          temp_at_open_c,
          temp_at_close_c,
          is_authorized
       FROM door_sensor_events
       WHERE booking_id = $1
       ORDER BY opened_at ASC`,
      [bookingId],
    );

    const doorEvents = result.rows.map((r) => ({
      eventId: r.id,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
      durationMinutes:
        r.duration_minutes === null
          ? null
          : Number(r.duration_minutes),
      locationLabel: r.location_label,
      eventType: r.event_type,
      eventTypeBadge: String(r.event_type || '')
        .replaceAll('_', ' ')
        .toUpperCase(),
      tempAtOpenC:
        r.temp_at_open_c === null ? null : Number(r.temp_at_open_c),
      tempAtCloseC:
        r.temp_at_close_c === null ? null : Number(r.temp_at_close_c),
      isAuthorized: r.is_authorized,
    }));

    return {
      bookingRef: booking.booking_ref,
      totalDoorOpenings: doorEvents.length,
      unplannedOpenings: doorEvents.filter(
        (e) => e.eventType === 'unplanned',
      ).length,
      breachCount: 0,
      doorEvents,
    };
  }

  async exportTemperaturePdf(bookingId: string, userId: string) {
    const booking = await this.getBooking(bookingId, userId);

    const analytics = await this.getTemperatureAnalytics(
      bookingId,
      userId,
      '15min',
      true,
    );

    const doorLog = await this.getDoorLog(bookingId, userId);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 45 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('ColdRoute Temperature Certificate');
      doc.moveDown();

      doc.fontSize(11).text(`Booking: ${booking.booking_ref}`);
      doc.text(`Generated: ${new Date().toISOString()}`);
      doc.moveDown();

      doc.fontSize(14).text('Temperature Compliance');
      doc.fontSize(11);
      doc.text(`Compliance: ${analytics.compliancePercent ?? 'N/A'}%`);
      doc.text(`Breach Count: ${analytics.breachCount}`);
      doc.text(
        `Total Excursion Minutes: ${analytics.totalExcursionMinutes}`,
      );
      doc.text(`Minimum Temperature: ${analytics.stats.minTempC ?? 'N/A'}°C`);
      doc.text(`Maximum Temperature: ${analytics.stats.maxTempC ?? 'N/A'}°C`);
      doc.text(`MKT: ${analytics.stats.mktC ?? 'N/A'}°C`);
      doc.text(`Average Humidity: ${analytics.stats.avgHumidityPercent ?? 'N/A'}%`);
      doc.moveDown();

      doc.fontSize(14).text('SLA Limits');
      doc.fontSize(11);
      doc.text(`Upper Limit: ${analytics.sla.upperBreachLimitC}°C`);
      doc.text(`Lower Limit: ${analytics.sla.lowerBreachLimitC}°C`);
      doc.text(`Setpoint: ${analytics.sla.chamberSetpointC}°C`);
      doc.moveDown();

      doc.fontSize(14).text('Temperature Readings');
      doc.fontSize(9);

      analytics.readings.forEach((r) => {
        doc.text(
          `${new Date(r.timestamp).toISOString()} | ${r.tempC}°C | Humidity: ${r.humidityPercent ?? 'N/A'}% | GPS: ${r.gpsLat ?? 'N/A'}, ${r.gpsLng ?? 'N/A'}`,
        );
      });

      doc.moveDown();
      doc.fontSize(14).text('Door Sensor Events');
      doc.fontSize(9);

      doorLog.doorEvents.forEach((e) => {
        doc.text(
          `${e.eventTypeBadge} | Opened: ${e.openedAt} | Closed: ${e.closedAt || 'Still open'} | Location: ${e.locationLabel || 'N/A'}`,
        );
      });

      doc.moveDown();
      doc.fontSize(11).text(
        'ColdRoute Temperature Report - Generated from recorded IoT telemetry.',
      );

      doc.end();
    });
  }
}
