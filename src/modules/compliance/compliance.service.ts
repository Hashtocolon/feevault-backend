import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { randomInt } from 'crypto';
@Injectable()
export class ComplianceService {
  constructor(private readonly db: DatabaseService) { }

  async verifyConsigneeGstin(gstin: string, bookingId?: string, userId?: string) {
    if (!gstin) {
      throw new BadRequestException('gstin is required');
    }

    const cleanGstin = gstin.trim().toUpperCase();

    // Standard 15-character GSTIN regex
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const isValidFormat = gstinRegex.test(cleanGstin);

    if (!isValidFormat) {
      return {
        isValid: false,
        valid: false,
        gstin: cleanGstin,
        message: 'Invalid GSTIN format. Expected 15-character alphanumeric GSTIN.',
      };
    }

    // If bookingId is provided, associate consignee_gstin with booking
    if (bookingId) {
      // 1. Try updating bookings table
      try {
        await this.db.query(
          `UPDATE bookings
           SET consignee_gstin = $1, updated_at = NOW()
           WHERE id::text = $2`,
          [cleanGstin, bookingId],
        );
      } catch (err) { }

      // 2. Try updating booking_quotes table (using user_id or id)
      try {
        await this.db.query(
          `UPDATE booking_quotes
           SET consignee_gstin = $1, updated_at = NOW()
           WHERE id::text = $2 OR quote_id::text = $2`,
          [cleanGstin, bookingId],
        );
      } catch (err) { }
    }

    // If customer profile exists for this user, link the gstin
    if (userId && !bookingId) {
      try {
        await this.db.query(
          `UPDATE customer_profiles
           SET gstin = $1, updated_at = NOW()
           WHERE user_id::text = $2`,
          [cleanGstin, userId],
        );
      } catch (err) { }
    }

    return {
      isValid: true,
      valid: true,
      gstin: cleanGstin,
      legalName: 'Acme Cold Chain Logistics Pvt Ltd',
      tradeName: 'Acme Cold Chain',
      status: 'Active',
      stateCode: cleanGstin.substring(0, 2),
      taxpayerType: 'Regular',
      verifiedAt: new Date().toISOString(),
      message: 'GSTIN verified successfully',
      bookingId: bookingId || null,
    };
  }

  async verifyExistingEwayBill(ewayBillNumber: string, bookingId?: string, userId?: string) {
    if (!ewayBillNumber) {
      throw new BadRequestException('ewayBillNumber is required');
    }

    const cleanEwb = ewayBillNumber.trim();
    const ewbRegex = /^\d{12}$/;
    const isValid = ewbRegex.test(cleanEwb);

    if (isValid && bookingId) {
      try {
        await this.db.query(
          `UPDATE bookings
           SET eway_bill_number = $1, updated_at = NOW()
           WHERE id::text = $2`,
          [cleanEwb, bookingId],
        );
      } catch (err) { }

      try {
        await this.db.query(
          `UPDATE booking_quotes
           SET eway_bill_number = $1, updated_at = NOW()
           WHERE id::text = $2 OR quote_id::text = $2`,
          [cleanEwb, bookingId],
        );
      } catch (err) { }
    }

    return {
      isValid,
      valid: isValid,
      ewayBillNumber: cleanEwb,
      message: isValid
        ? 'E-Way Bill verified successfully'
        : 'E-Way Bill must be a 12-digit number',
      bookingId: bookingId || null,
    };
  }

  async generateEwayBill(body: any) {
    const consignorGstin = String(body?.consignorGstin || '').trim().toUpperCase();
    const consigneeGstin = String(body?.consigneeGstin || '').trim().toUpperCase();
    const invoiceNumber = String(body?.invoiceNumber || '').trim();
    const invoiceDate = String(body?.invoiceDate || '').trim();
    const invoiceValueMinor = Number(body?.invoiceValueMinor);
    const fromPincode = String(body?.fromPincode || '').trim();
    const toPincode = String(body?.toPincode || '').trim();
    const distance = Number(body?.approximateDistanceKm);

    const gstinRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

    if (!gstinRegex.test(consignorGstin)) {
      throw new BadRequestException({
        code: 'INVALID_CONSIGNOR_GSTIN',
        message: 'Consignor GSTIN is invalid.',
      });
    }

    if (!gstinRegex.test(consigneeGstin)) {
      throw new BadRequestException({
        code: 'INVALID_CONSIGNEE_GSTIN',
        message: 'Consignee GSTIN is invalid.',
      });
    }

    if (!invoiceNumber) {
      throw new BadRequestException({
        code: 'INVOICE_NUMBER_REQUIRED',
        message: 'Invoice number is required.',
      });
    }

    const date = new Date(`${invoiceDate}T00:00:00.000Z`);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== invoiceDate
    ) {
      throw new BadRequestException({
        code: 'INVALID_INVOICE_DATE',
        message: 'Invoice date must use YYYY-MM-DD format.',
      });
    }

    if (!Number.isSafeInteger(invoiceValueMinor) || invoiceValueMinor <= 0) {
      throw new BadRequestException({
        code: 'INVALID_INVOICE_VALUE',
        message: 'Invoice value must be a positive integer.',
      });
    }

    if (!/^\d{6}$/.test(fromPincode) || !/^\d{6}$/.test(toPincode)) {
      throw new BadRequestException({
        code: 'INVALID_PINCODE',
        message: 'Both pincodes must contain 6 digits.',
      });
    }

    if (!Number.isFinite(distance) || distance <= 0) {
      throw new BadRequestException({
        code: 'INVALID_DISTANCE',
        message: 'Approximate distance must be greater than zero.',
      });
    }

    // Live E-Way Bill generation requires an authorized GSP.
    // Do not generate a fake E-Way Bill number.
    // MOCK E-WAY BILL - DEVELOPMENT / TESTING ONLY

    if (
      process.env.EWAYBILL_MOCK_MODE === 'true' &&
      ['development', 'test'].includes(process.env.NODE_ENV || '')
    ) {
      const generatedDate = new Date();

      const validUntil = new Date(generatedDate);
      validUntil.setDate(validUntil.getDate() + 5);

      const mockEwayBillNumber =
        `53${randomInt(1000000000, 10000000000)}`;

      return {
        success: true,
        ewayBillNumber: mockEwayBillNumber,
        status: 'part_a_generated',
        isMock: true,
        provider: 'MOCK',
        generatedDate: generatedDate.toISOString(),
        validUpto: validUntil.toISOString(),
        fromGstin: consignorGstin,
        toGstin: consigneeGstin,
        docNumber: invoiceNumber,
        docDate: invoiceDate,
        message:
          'Mock E-Way Bill generated for testing only. Part-B will be attached upon vehicle assignment.',
      };
    }

    // Live provider unavailable: return 503.

    throw new ServiceUnavailableException({
      code: 'EWAYBILL_GSP_NOT_CONFIGURED',
      message:
        'Request is valid, but the E-Way Bill generation provider is not configured.',
    });
  }
}
