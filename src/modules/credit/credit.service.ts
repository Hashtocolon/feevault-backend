import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CreditService {
  constructor(private readonly db: DatabaseService) {}

  async createCreditRequest(body: any, userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    // Support both frontend schema variants
    const requestedLimitMinor =
      body.requestedLimitMinor ||
      (body.creditLimit ? Math.round(Number(body.creditLimit) * 100) : null) ||
      (body.limit ? Math.round(Number(body.limit) * 100) : 5000000); // 50,000 INR default

    const requestedPaymentTermsDays =
      Number(body.requestedPaymentTermsDays) || Number(body.paymentTerms) || 30;

    const businessTurnoverRange =
      body.businessTurnoverRange || body.turnoverRange || '10L - 50L';

    const documentIds = Array.isArray(body.documentIds)
      ? body.documentIds.filter((id: string) => typeof id === 'string' && UUID_REGEX.test(id))
      : [];

    // Find customer profile
    let profileResult = await this.db.query(
      `SELECT id, entity_type FROM customer_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    );

    let customerId = profileResult.rows[0]?.id;

    // Auto-create or ensure profile exists
    if (!customerId) {
      const newProf = await this.db.query(
        `INSERT INTO customer_profiles (user_id, updated_at)
         VALUES ($1, NOW())
         ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [userId],
      );
      customerId = newProf.rows[0]?.id;
    }

    // Check existing pending request
    const existing = await this.db.query(
      `SELECT id, status FROM credit_requests
       WHERE customer_id = $1 AND status IN ('PENDING', 'under_review') LIMIT 1`,
      [customerId],
    );

    if (existing.rows.length) {
      return {
        success: false,
        message: 'You already have a credit request under review.',
        creditRequestId: existing.rows[0].id,
        status: existing.rows[0].status,
      };
    }

    const result = await this.db.query(
      `INSERT INTO credit_requests (
        customer_id,
        requested_limit_minor,
        requested_payment_terms_days,
        business_turnover_range,
        document_ids,
        status
      )
      VALUES ($1, $2, $3, $4, $5::uuid[], 'under_review')
      RETURNING id, status, created_at`,
      [
        customerId,
        requestedLimitMinor,
        requestedPaymentTermsDays,
        businessTurnoverRange,
        documentIds,
      ],
    );

    const creditRequest = result.rows[0];
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(requestedLimitMinor / 100);

    return {
      success: true,
      creditRequestId: creditRequest.id,
      status: creditRequest.status,
      requestedLimitFormatted: formattedAmount,
      paymentTerms: `Net ${requestedPaymentTermsDays} Days`,
      message: 'Application submitted to Admin Credit Queue. Decision turnaround: 24 hours.',
    };
  }

  async linkMasterContract(contractIdOrRef: string, customerIdParam: string, userId: string) {
    const searchRef = contractIdOrRef || customerIdParam;

    if (!searchRef) {
      throw new BadRequestException('Contract reference is required');
    }

    // Find contract by ref or id
    const contractResult = await this.db.query(
      `SELECT id, contract_ref, status, start_date, end_date, rate_card_json
       FROM master_contracts
       WHERE contract_ref = $1 OR id::text = $1
       LIMIT 1`,
      [searchRef.trim()],
    );

    if (contractResult.rows.length === 0) {
      throw new NotFoundException('Master contract not found');
    }

    const contract = contractResult.rows[0];

    // Link to customer profile
    if (userId) {
      await this.db.query(
        `UPDATE customer_profiles
         SET master_contract_id = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [contract.id, userId],
      );
    }

    return {
      success: true,
      contractId: contract.id,
      contractNumber: contract.contract_ref,
      status: contract.status,
      validTill: contract.end_date,
      message: 'Master contract linked successfully',
    };
  }
}
