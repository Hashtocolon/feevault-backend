import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CreditService {
  constructor(private readonly db: DatabaseService) {}

  async createCreditRequest(body: any, userId: string) {
    const { creditLimit, requestNote } = body;

    // Check if customer already has a pending request
    const existing = await this.db.query(
      `SELECT id FROM credit_requests
       WHERE customer_id = $1 AND status = 'PENDING'`,
      [userId],
    );

    if (existing.rows.length) {
      return {
        success: false,
        message: 'You already have a pending credit request',
        existingRequestId: existing.rows[0].id,
      };
    }

    const result = await this.db.query(
      `INSERT INTO credit_requests (customer_id, requested_limit, note, status, created_at)
       VALUES ($1, $2, $3, 'PENDING', NOW())
       RETURNING id, status, created_at`,
      [userId, creditLimit || null, requestNote || null],
    );

    return {
      success: true,
      creditRequest: result.rows[0],
      message: 'Credit request submitted successfully',
    };
  }

  async linkMasterContract(contractId: string, customerId: string, userId: string) {
    const contract = await this.db.query(
      `SELECT id, contract_ref, status FROM master_contracts WHERE id = $1`,
      [contractId],
    );

    if (!contract.rows.length) {
      throw new NotFoundException('Contract not found');
    }

    await this.db.query(
      `UPDATE customer_profiles
       SET master_contract_id = $1, updated_at = NOW()
       WHERE customer_id = $2`,
      [contractId, userId],
    );

    return {
      success: true,
      contractId,
      message: 'Master contract linked successfully',
    };
  }
}

