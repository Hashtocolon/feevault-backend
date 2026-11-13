import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ConsentService {
  constructor(private readonly db: DatabaseService) {}

  async getConsents(userId: string) {
    const result = await this.db.query(
      `SELECT terms_accepted, marketing_opt_in, consent_metadata, updated_at
       FROM user_consents
       WHERE user_id = $1`,
      [userId],
    );

    return {
      consents: result.rows[0] || {
        terms_accepted: false,
        marketing_opt_in: false,
        consent_metadata: {},
      },
    };
  }

  async saveConsents(body: any, userId: string) {
    const { termsAccepted, marketingOptIn, consentData } = body;

    const result = await this.db.query(
      `INSERT INTO user_consents (user_id, terms_accepted, marketing_opt_in, consent_metadata, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET terms_accepted = COALESCE(EXCLUDED.terms_accepted, user_consents.terms_accepted),
           marketing_opt_in = COALESCE(EXCLUDED.marketing_opt_in, user_consents.marketing_opt_in),
           consent_metadata = COALESCE(EXCLUDED.consent_metadata, user_consents.consent_metadata),
           updated_at = NOW()
       RETURNING *`,
      [
        userId,
        termsAccepted !== undefined ? termsAccepted : true,
        marketingOptIn !== undefined ? marketingOptIn : false,
        consentData ? JSON.stringify(consentData) : '{}',
      ],
    );

    return {
      success: true,
      consents: result.rows[0],
      message: 'Consents updated successfully',
    };
  }
}

