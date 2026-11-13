import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ComplianceService {
  constructor(private readonly db: DatabaseService) {}

  async verifyConsigneeGstin(gstin: string, bookingId: string, userId: string) {
    if (!gstin || !bookingId) {
      throw new BadRequestException('gstin and bookingId are required');
    }

    // Basic GSTIN format validation: 15 chars alphanumeric
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const isValidFormat = gstinRegex.test(gstin.toUpperCase());

    // Update booking with consignee GSTIN
    await this.db.query(
      `UPDATE booking_quotes
       SET consignee_gstin = $1, updated_at = NOW()
       WHERE id = $2 AND customer_id = $3`,
      [gstin.toUpperCase(), bookingId, userId],
    );

    return {
      gstin: gstin.toUpperCase(),
      valid: isValidFormat,
      message: isValidFormat ? 'GSTIN format is valid' : 'Invalid GSTIN format',
      bookingId,
    };
  }

  async verifyExistingEwayBill(ewayBillNumber: string, bookingId: string, userId: string) {
    if (!ewayBillNumber || !bookingId) {
      throw new BadRequestException('ewayBillNumber and bookingId are required');
    }

    // E-way bill is 12 digits
    const ewbRegex = /^\d{12}$/;
    const isValid = ewbRegex.test(ewayBillNumber);

    // Store e-way bill number in booking
    await this.db.query(
      `UPDATE booking_quotes
       SET eway_bill_number = $1, updated_at = NOW()
       WHERE id = $2 AND customer_id = $3`,
      [ewayBillNumber, bookingId, userId],
    );

    return {
      ewayBillNumber,
      valid: isValid,
      message: isValid
        ? 'E-Way Bill number is valid'
        : 'E-Way Bill must be a 12-digit number',
      bookingId,
    };
  }
}

