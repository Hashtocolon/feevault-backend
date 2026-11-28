
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import { VerificationDecisionDto } from './dto/verification-decision.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';

@Injectable()
export class AdminOnboardingService {
  constructor(private readonly db: DatabaseService) {}

  // API 3.1 - Verification Queue
  async getVerificationQueue(
    queue?: string,
    priority?: string,
  ) {
    const allowedQueues = [
      'PARTNER_DOCS',
      'CUSTOMER_CREDIT',
      'PHARMA_LICENCE',
    ];

    const allowedPriorities = ['NORMAL', 'URGENT'];

    if (queue && !allowedQueues.includes(queue)) {
      throw new BadRequestException('Invalid queue filter');
    }

    if (priority && !allowedPriorities.includes(priority)) {
      throw new BadRequestException('Invalid priority filter');
    }

    const result = await this.db.query(
      `SELECT
        id,
        queue,
        applicant,
        reference_number,
        doc_type,
        priority,
        submitted_at,
        status
       FROM admin_verification_queue
       WHERE ($1::varchar IS NULL OR queue = $1)
         AND ($2::varchar IS NULL OR priority = $2)
       ORDER BY
         CASE WHEN priority = 'URGENT' THEN 0 ELSE 1 END,
         submitted_at ASC`,
      [queue ?? null, priority ?? null],
    );

    return result.rows.map((item) => ({
      id: item.id,
      queue: item.queue,
      applicant: item.applicant,
      referenceNumber: item.reference_number,
      docType: item.doc_type,
      priority:
        item.priority === 'URGENT' ? 'Urgent' : 'Normal',
      submittedAt: item.submitted_at,
      status: item.status,
    }));
  }

  // API 3.2 - Approve / Reject Verification
  async decideVerification(
    itemId: string,
    dto: VerificationDecisionDto,
    adminId: string,
  ) {
    const result = await this.db.query(
      `UPDATE admin_verification_queue
       SET
         status = $1,
         reviewer_note = $2,
         reviewed_by = $3,
         reviewed_at = NOW()
       WHERE id = $4
         AND status = 'PENDING_REVIEW'
       RETURNING id, status`,
      [
        dto.decision === 'APPROVED' ? 'ACTIVATED' : 'REJECTED',
        dto.reviewerNote ?? null,
        adminId,
        itemId,
      ],
    );

    if (!result.rows.length) {
      const existing = await this.db.query(
        `SELECT id, status
         FROM admin_verification_queue
         WHERE id = $1`,
        [itemId],
      );

      if (!existing.rows.length) {
        throw new NotFoundException('Verification item not found');
      }

      throw new ConflictException(
        `Verification item cannot be decided. Current status: ${existing.rows[0].status}`,
      );
    }

    return {
      success: true,
      itemStatus: result.rows[0].status,
    };
  }

  // API 3.3 - List Enterprise Customers
  async getCustomers() {
    const result = await this.db.query(
      `SELECT
        id,
        legal_name,
        gstin,
        pan,
        billing_email,
        credit_limit_inr,
        payment_terms,
        utilized_credit_inr,
        status
       FROM admin_enterprise_customers
       ORDER BY created_at DESC`,
    );

    return result.rows.map((customer) => ({
      customerId: customer.id,
      legalName: customer.legal_name,
      gstin: customer.gstin,
      pan: customer.pan,
      billingEmail: customer.billing_email,
      creditLimitInr: Number(customer.credit_limit_inr),
      paymentTerms: customer.payment_terms,
      utilizedCreditInr: Number(customer.utilized_credit_inr),
      status: customer.status,
    }));
  }

  // API 3.4 - Create Enterprise Customer
  async createCustomer(dto: CreateCustomerDto) {
    const gstin = dto.gstin.toUpperCase();
    const pan = dto.pan.toUpperCase();

    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      throw new BadRequestException('Invalid GSTIN format');
    }

    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      throw new BadRequestException('Invalid PAN format');
    }

    try {
      const result = await this.db.query(
        `INSERT INTO admin_enterprise_customers (
          legal_name,
          gstin,
          pan,
          billing_email,
          credit_limit_inr,
          payment_terms,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
        RETURNING id, status, payment_terms`,
        [
          dto.legalBusinessName,
          gstin,
          pan,
          dto.billingEmail,
          dto.creditLimitInr,
          dto.paymentTerms,
        ],
      );

      return {
        customerId: result.rows[0].id,
        status: result.rows[0].status,
        message: `Customer created with ${result.rows[0].payment_terms} credit facility`,
      };
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'A customer with this GSTIN already exists',
        );
      }
      throw error;
    }
  }

  // API 3.5 - List Transport Partners
  async getPartners() {
    const result = await this.db.query(
      `SELECT
        id,
        partner_name,
        partner_type,
        pan,
        bank_account_verified,
        vehicle_count,
        active_trips,
        compliance_status
       FROM admin_transport_partners
       ORDER BY created_at DESC`,
    );

    return result.rows.map((partner) => ({
      partnerId: partner.id,
      partnerName: partner.partner_name,
      partnerType: partner.partner_type,
      pan: partner.pan,
      bankAccountVerified: partner.bank_account_verified,
      vehicleCount: Number(partner.vehicle_count),
      activeTrips: Number(partner.active_trips),
      complianceStatus: partner.compliance_status,
    }));
  }

  // API 3.6 - Add Transport Partner
  async createPartner(dto: CreatePartnerDto) {
    const pan = dto.pan.toUpperCase();

    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      throw new BadRequestException('Invalid PAN format');
    }

    const result = await this.db.query(
      `INSERT INTO admin_transport_partners (
        partner_name,
        partner_type,
        pan,
        bank_upi_reference,
        vehicle_registration,
        reefer_make_model,
        compliance_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_DOC_UPLOAD')
      RETURNING id, compliance_status`,
      [
        dto.partnerName,
        dto.partnerType,
        pan,
        dto.bankUpiReference ?? null,
        dto.vehicleRegistration ?? null,
        dto.reeferMakeModel ?? null,
      ],
    );

    return {
      partnerId: result.rows[0].id,
      status: result.rows[0].compliance_status,
    };
  }
}
