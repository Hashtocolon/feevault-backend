const db = require('../db');

// -----------------------------------------------------------------------------
// 1. CREATE ANNUAL PAYOUT BATCH (FINANCE MAKER)
// -----------------------------------------------------------------------------
async function createPayoutBatch(req, res) {
  const client = await db.pool.connect();
  try {
    const makerAdmin = req.admin;
    const { school_id, academic_year } = req.body;

    if (!school_id) {
      return res.status(400).json({ success: false, message: 'school_id is required.' });
    }

    const year = academic_year || '2027-2028';

    // Fetch school
    const schoolRes = await client.query('SELECT id, name, school_code, status FROM schools WHERE id = $1;', [school_id]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }
    const school = schoolRes.rows[0];

    // Fetch all students for this school with their target fees
    const studentsRes = await client.query(
      `SELECT s.id, s.name, s.parent_id, COALESCE(c.annual_fee_paise, 6000000) AS target_fee_paise
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.school_id = $1;`,
      [school_id]
    );

    if (studentsRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No students enrolled for this school yet.' });
    }

    let grossCollectionPaise = 0;
    let netSchoolPayoutPaise = 0;
    let totalExcessRefundPaise = 0;

    const studentItems = [];

    // Calculate savings per student from ledger
    for (const st of studentsRes.rows) {
      const balRes = await client.query(
        `SELECT COALESCE(SUM(
          CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_paise ELSE -le.amount_paise END
         ), 0) AS balance_paise
         FROM ledger_accounts la
         JOIN ledger_entries le ON la.id = le.account_id
         WHERE la.account_type = 'STUDENT_VAULT' AND la.owner_id = $1;`,
        [st.id]
      );

      const saved = parseInt(balRes.rows[0]?.balance_paise || 0);
      const targetFee = parseInt(st.target_fee_paise);

      // School gets up to the target fee, any surplus is marked as excess refund
      const schoolPay = Math.min(saved, targetFee);
      const excess = Math.max(0, saved - targetFee);

      grossCollectionPaise += saved;
      netSchoolPayoutPaise += schoolPay;
      totalExcessRefundPaise += excess;

      studentItems.push({
        student_id: st.id,
        saved_balance_paise: saved,
        school_fee_paise: targetFee,
        disbursed_to_school_paise: schoolPay,
        excess_refund_paise: excess
      });
    }

    // FeeVault platform fee: 1.0% commission + 18% GST
    const platformFeePaise = Math.floor(netSchoolPayoutPaise * 0.01);
    const gstFeePaise = Math.floor(platformFeePaise * 0.18);
    const finalNetSchoolDisbursement = netSchoolPayoutPaise - (platformFeePaise + gstFeePaise);

    await client.query('BEGIN');

    // Insert Withdrawal Cycle in DRAFT status
    const cycleRes = await client.query(
      `INSERT INTO withdrawal_cycles 
       (school_id, academic_year, status, total_gross_paise, platform_fee_paise, gst_fee_paise, 
        net_school_payout_paise, total_excess_refund_paise, created_by_maker_id)
       VALUES ($1, $2, 'DRAFT', $3, $4, $5, $6, $7, $8)
       RETURNING id, academic_year, status, total_gross_paise, net_school_payout_paise, platform_fee_paise, gst_fee_paise, created_at;`,
      [school_id, year, grossCollectionPaise, platformFeePaise, gstFeePaise, finalNetSchoolDisbursement, totalExcessRefundPaise, makerAdmin.id]
    );

    const cycle = cycleRes.rows[0];

    // Insert line items
    for (const item of studentItems) {
      await client.query(
        `INSERT INTO withdrawal_items 
         (cycle_id, student_id, saved_balance_paise, school_fee_paise, disbursed_to_school_paise, excess_refund_paise)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [cycle.id, item.student_id, item.saved_balance_paise, item.school_fee_paise, item.disbursed_to_school_paise, item.excess_refund_paise]
      );
    }

    // Audit Log
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_type, actor_name, action, entity_type, entity_id)
       VALUES ($1, 'ADMIN', $2, 'CREATE_WITHDRAWAL_BATCH', 'withdrawal_cycles', $3);`,
      [makerAdmin.id, makerAdmin.full_name, cycle.id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Annual withdrawal payout batch created in DRAFT state.',
      cycle_id: cycle.id,
      school_name: school.name,
      academic_year: cycle.academic_year,
      total_students: studentItems.length,
      gross_collection_paise: grossCollectionPaise,
      platform_commission_paise: platformFeePaise,
      gst_paise: gstFeePaise,
      net_school_payout_paise: finalNetSchoolDisbursement,
      total_excess_refund_paise: totalExcessRefundPaise,
      status: cycle.status
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in createPayoutBatch:', err);
    return res.status(500).json({ success: false, message: 'Internal server error creating payout batch.' });
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------------------
// 2. RECORD OFFLINE SCHOOL CONFIRMATION (PHASE 1)
// -----------------------------------------------------------------------------
async function recordSchoolConfirmation(req, res) {
  try {
    const { id } = req.params;
    const { confirmation_proof_url, notes } = req.body;

    const cycleRes = await db.query('SELECT id, status FROM withdrawal_cycles WHERE id = $1;', [id]);
    if (cycleRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Withdrawal cycle not found.' });
    }

    await db.query(
      `UPDATE withdrawal_cycles 
       SET status = 'SCHOOL_CONFIRMED', 
           school_confirmation_recorded_at = CURRENT_TIMESTAMP, 
           school_confirmation_proof_url = $1, 
           school_confirmation_notes = $2, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3;`,
      [confirmation_proof_url || null, notes || 'School confirmation recorded by Admin', id]
    );

    await db.query(
      `INSERT INTO audit_logs (actor_id, actor_type, actor_name, action, entity_type, entity_id, after_state)
       VALUES ($1, 'ADMIN', $2, 'RECORD_SCHOOL_CONFIRMATION', 'withdrawal_cycles', $3, $4);`,
      [req.admin.id, req.admin.full_name, id, JSON.stringify({ status: 'SCHOOL_CONFIRMED', notes })]
    );

    return res.status(200).json({
      success: true,
      cycle_id: id,
      status: 'SCHOOL_CONFIRMED',
      message: 'School confirmation recorded successfully. Batch is now ready for Finance Checker approval.'
    });
  } catch (err) {
    console.error('Error in recordSchoolConfirmation:', err);
    return res.status(500).json({ success: false, message: 'Internal server error recording confirmation.' });
  }
}

// -----------------------------------------------------------------------------
// 3. APPROVE & EXECUTE DISBURSEMENT (FINANCE CHECKER - MAKER-CHECKER RULE)
// -----------------------------------------------------------------------------
async function approveAndDisburse(req, res) {
  const client = await db.pool.connect();
  try {
    const checkerAdmin = req.admin;
    const { id } = req.params;

    const cycleRes = await client.query('SELECT * FROM withdrawal_cycles WHERE id = $1 FOR UPDATE;', [id]);
    if (cycleRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Withdrawal cycle not found.' });
    }

    const cycle = cycleRes.rows[0];

    if (cycle.status !== 'SCHOOL_CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve cycle in '${cycle.status}' state. Must be 'SCHOOL_CONFIRMED' first.`
      });
    }

    // MAKER-CHECKER RULE: Checker cannot be the same admin who created the batch
    // (Bypassed only if SUPER_ADMIN during development)
    if (cycle.created_by_maker_id === checkerAdmin.id && checkerAdmin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Maker-Checker policy violation: You cannot approve a payout batch you created. Another Finance Checker must review.'
      });
    }

    await client.query('BEGIN');

    // 1. Execute Double-Entry Ledger movement for the payout
    const grossTotal = parseInt(cycle.total_gross_paise);
    const platformFee = parseInt(cycle.platform_fee_paise);
    const gstFee = parseInt(cycle.gst_fee_paise);
    const netSchool = parseInt(cycle.net_school_payout_paise);

    // Get system accounts
    const escrowAcc = (await client.query("SELECT id FROM ledger_accounts WHERE account_type = 'BANK_ESCROW_POOL' LIMIT 1;")).rows[0].id;
    const revenueAcc = (await client.query("SELECT id FROM ledger_accounts WHERE account_type = 'PLATFORM_REVENUE' LIMIT 1;")).rows[0].id;
    const gstAcc = (await client.query("SELECT id FROM ledger_accounts WHERE account_type = 'GST_OUTPUT_PAYABLE' LIMIT 1;")).rows[0].id;

    // School Payable Account
    let schoolAccRes = await client.query("SELECT id FROM ledger_accounts WHERE account_type = 'SCHOOL_PAYABLE' AND owner_id = $1;", [cycle.school_id]);
    let schoolAccId = schoolAccRes.rows[0]?.id;
    if (!schoolAccId) {
      const newAcc = await client.query("INSERT INTO ledger_accounts (account_type, owner_id, currency, description) VALUES ('SCHOOL_PAYABLE', $1, 'INR', 'School Payable') RETURNING id;", [cycle.school_id]);
      schoolAccId = newAcc.rows[0].id;
    }

    // Create Ledger Transaction for Payout
    const txRes = await client.query(
      `INSERT INTO ledger_transactions 
       (transaction_type, reference_id, idempotency_key, description)
       VALUES ('WITHDRAWAL_PAYOUT', $1, $2, $3)
       RETURNING id;`,
      [cycle.id, 'TX_PAYOUT_' + cycle.id, `Annual School Fee Disbursement: Cycle ${cycle.id}`]
    );
    const payoutTxId = txRes.rows[0].id;

    // Immutable entries:
    // CREDIT: Bank Escrow Pool (Money leaves bank escrow)
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_paise)
       VALUES ($1, $2, 'CREDIT', $3);`,
      [payoutTxId, escrowAcc, grossTotal]
    );

    // DEBIT: School Payable (School liability cleared)
    if (netSchool > 0) {
      await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_paise)
         VALUES ($1, $2, 'DEBIT', $3);`,
        [payoutTxId, schoolAccId, netSchool]
      );
    }

    // DEBIT: Platform Revenue (FeeVault commission earned)
    if (platformFee > 0) {
      await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_paise)
         VALUES ($1, $2, 'DEBIT', $3);`,
        [payoutTxId, revenueAcc, platformFee]
      );
    }

    // DEBIT: GST Output Tax
    if (gstFee > 0) {
      await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_paise)
         VALUES ($1, $2, 'DEBIT', $3);`,
        [payoutTxId, gstAcc, gstFee]
      );
    }

    // 2. Mark Cycle as PAID
    const bankPayoutRef = 'ICICI_DISB_' + Date.now();
    const invoiceNum = 'INV-FV-' + Date.now().toString().slice(-6);

    await client.query(
      `UPDATE withdrawal_cycles 
       SET status = 'PAID', 
           approved_by_checker_id = $1, 
           payout_executed_at = CURRENT_TIMESTAMP, 
           bank_payout_reference = $2, 
           feevault_gst_invoice_number = $3, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4;`,
      [checkerAdmin.id, bankPayoutRef, invoiceNum, id]
    );

    // 3. Audit Log
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_type, actor_name, action, entity_type, entity_id, after_state)
       VALUES ($1, 'ADMIN', $2, 'APPROVE_PAYOUT_BATCH', 'withdrawal_cycles', $3, $4);`,
      [checkerAdmin.id, checkerAdmin.full_name, id, JSON.stringify({ bank_ref: bankPayoutRef, status: 'PAID' })]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Disbursement authorized and executed successfully by Finance Checker.',
      cycle_id: id,
      status: 'PAID',
      bank_payout_reference: bankPayoutRef,
      feevault_gst_invoice: invoiceNum,
      disbursed_to_school_paise: netSchool,
      feevault_commission_paise: platformFee,
      gst_paise: gstFee
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in approveAndDisburse:', err);
    return res.status(500).json({ success: false, message: 'Internal server error executing payout.' });
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------------------
// 4. LIST WITHDRAWAL CYCLES
// -----------------------------------------------------------------------------
async function listWithdrawalCycles(req, res) {
  try {
    const listRes = await db.query(
      `SELECT wc.id, wc.academic_year, wc.status, wc.total_gross_paise, wc.net_school_payout_paise,
              wc.platform_fee_paise, wc.gst_fee_paise, wc.bank_payout_reference, wc.created_at,
              sch.name AS school_name, sch.school_code,
              maker.full_name AS maker_name, checker.full_name AS checker_name
       FROM withdrawal_cycles wc
       JOIN schools sch ON wc.school_id = sch.id
       LEFT JOIN admins maker ON wc.created_by_maker_id = maker.id
       LEFT JOIN admins checker ON wc.approved_by_checker_id = checker.id
       ORDER BY wc.created_at DESC;`
    );

    return res.status(200).json({
      success: true,
      count: listRes.rows.length,
      cycles: listRes.rows
    });
  } catch (err) {
    console.error('Error in listWithdrawalCycles:', err);
    return res.status(500).json({ success: false, message: 'Internal server error listing cycles.' });
  }
}

module.exports = {
  createPayoutBatch,
  recordSchoolConfirmation,
  approveAndDisburse,
  listWithdrawalCycles
};

