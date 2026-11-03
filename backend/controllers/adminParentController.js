const db = require('../db');

// -----------------------------------------------------------------------------
// 1. LIST ALL PARENTS
// -----------------------------------------------------------------------------
async function listParents(req, res) {
  try {
    const { search, status } = req.query;

    let query = `
      SELECT u.id, u.full_name, u.username, u.email, u.phone, u.status, u.pan_number,
             u.refund_bank_account, u.refund_bank_ifsc, u.is_bank_verified, u.device_id, u.created_at,
             COUNT(DISTINCT s.id) AS children_count
      FROM users u
      LEFT JOIN students s ON u.id = s.parent_id
      WHERE u.role = 'PARENT'
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND u.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(u.full_name) LIKE $${params.length} OR u.phone LIKE $${params.length} OR LOWER(u.username) LIKE $${params.length})`;
    }

    query += ` GROUP BY u.id ORDER BY u.created_at DESC;`;

    const parentsRes = await db.query(query, params);

    // Compute total savings per parent from ledger
    const parentsWithSavings = await Promise.all(
      parentsRes.rows.map(async (p) => {
        const balRes = await db.query(
          `SELECT COALESCE(SUM(
            CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_paise ELSE -le.amount_paise END
           ), 0) AS total_saved_paise
           FROM students st
           JOIN ledger_accounts la ON la.owner_id = st.id AND la.account_type = 'STUDENT_VAULT'
           JOIN ledger_entries le ON la.id = le.account_id
           WHERE st.parent_id = $1;`,
          [p.id]
        );

        const maskedAcc = p.refund_bank_account ? 'XXXX XXXX ' + p.refund_bank_account.slice(-4) : 'Not Provided';

        return {
          id: p.id,
          full_name: p.full_name || p.username,
          username: p.username,
          phone: p.phone,
          email: p.email,
          status: p.status,
          pan_number: p.pan_number || 'Pending KYC',
          refund_bank: maskedAcc + (p.refund_bank_ifsc ? ` (${p.refund_bank_ifsc})` : ''),
          is_bank_verified: !!p.is_bank_verified,
          children_count: parseInt(p.children_count || 0),
          total_saved_paise: parseInt(balRes.rows[0]?.total_saved_paise || 0),
          has_bound_device: !!p.device_id,
          created_at: p.created_at
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: parentsWithSavings.length,
      parents: parentsWithSavings
    });
  } catch (err) {
    console.error('Error in listParents:', err);
    return res.status(500).json({ success: false, message: 'Internal server error listing parents.' });
  }
}

// -----------------------------------------------------------------------------
// 2. GET PARENT PROFILE DETAILS
// -----------------------------------------------------------------------------
async function getParentDetails(req, res) {
  try {
    const { id } = req.params;

    const parentRes = await db.query(
      `SELECT id, full_name, username, email, phone, status, pan_number, 
              refund_bank_account, refund_bank_ifsc, refund_bank_account_name, is_bank_verified,
              dpdp_consent_recorded, dpdp_consent_version, dpdp_consent_at,
              device_id, biometric_enabled, reminder_time, daily_reminder_opt_out, created_at
       FROM users 
       WHERE id = $1 AND role = 'PARENT';`,
      [id]
    );

    if (parentRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parent not found.' });
    }

    const parent = parentRes.rows[0];

    // Fetch linked children
    const childrenRes = await db.query(
      `SELECT st.id, st.name, st.gender, st.status, sch.name AS school_name, sch.school_code, c.standard
       FROM students st
       JOIN schools sch ON st.school_id = sch.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE st.parent_id = $1;`,
      [id]
    );

    // Fetch children balances from ledger
    const children = await Promise.all(
      childrenRes.rows.map(async (ch) => {
        const balRes = await db.query(
          `SELECT COALESCE(SUM(
            CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_paise ELSE -le.amount_paise END
           ), 0) AS balance_paise
           FROM ledger_accounts la
           JOIN ledger_entries le ON la.id = le.account_id
           WHERE la.account_type = 'STUDENT_VAULT' AND la.owner_id = $1;`,
          [ch.id]
        );
        return {
          ...ch,
          saved_balance_paise: parseInt(balRes.rows[0]?.balance_paise || 0)
        };
      })
    );

    // Fetch payment transaction history
    const txRes = await db.query(
      `SELECT id, amount_paise, status, upi_transaction_ref, paid_at, created_at
       FROM payments 
       WHERE parent_id = $1 
       ORDER BY created_at DESC;`,
      [id]
    );

    return res.status(200).json({
      success: true,
      parent: {
        ...parent,
        children,
        transactions: txRes.rows
      }
    });
  } catch (err) {
    console.error('Error in getParentDetails:', err);
    return res.status(500).json({ success: false, message: 'Internal server error fetching parent details.' });
  }
}

// -----------------------------------------------------------------------------
// 3. REMOTE REVOKE PARENT DEVICE
// -----------------------------------------------------------------------------
async function revokeParentDevice(req, res) {
  try {
    const { id } = req.params;

    await db.query(
      `UPDATE users 
       SET device_id = NULL, fcm_token = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1;`,
      [id]
    );

    await db.query(
      `INSERT INTO audit_logs (actor_id, actor_type, actor_name, action, entity_type, entity_id)
       VALUES ($1, 'ADMIN', $2, 'REVOKE_PARENT_DEVICE', 'users', $3);`,
      [req.admin.id, req.admin.full_name, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Parent device credentials revoked. Parent must re-authenticate on their device.'
    });
  } catch (err) {
    console.error('Error in revokeParentDevice:', err);
    return res.status(500).json({ success: false, message: 'Internal server error revoking device.' });
  }
}

module.exports = {
  listParents,
  getParentDetails,
  revokeParentDevice
};

