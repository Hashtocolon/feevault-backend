const db = require('../db');

// -----------------------------------------------------------------------------
// 1. GET WALLET SUMMARY (HOME DASHBOARD API)
// -----------------------------------------------------------------------------
async function getWalletSummary(req, res) {
  try {
    const parentId = req.user.id;

    // 1. Get all students linked to this parent
    const studentsRes = await db.query(
      `SELECT s.id, s.name, s.status, sch.name AS school_name, sch.school_code, 
              c.standard, COALESCE(c.annual_fee_paise, 6000000) AS target_fee_paise
       FROM students s
       JOIN schools sch ON s.school_id = sch.id
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.parent_id = $1
       ORDER BY s.created_at ASC;`,
      [parentId]
    );

    let totalSavingsLocked = 0;
    let totalInterestEarned = 0;

    const childrenCards = await Promise.all(
      studentsRes.rows.map(async (st) => {
        // Derive savings balance from Double-Entry Ledger entries
        const balRes = await db.query(
          `SELECT COALESCE(SUM(
            CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_paise ELSE -le.amount_paise END
           ), 0) AS balance_paise
           FROM ledger_accounts la
           JOIN ledger_entries le ON la.id = le.account_id
           WHERE la.account_type = 'STUDENT_VAULT' AND la.owner_id = $1;`,
          [st.id]
        );
        const childBal = parseInt(balRes.rows[0]?.balance_paise || 0);
        totalSavingsLocked += childBal;

        // Accrued interest
        const intRes = await db.query(
          `SELECT COALESCE(SUM(daily_accrued_paise), 0) AS interest_paise 
           FROM interest_accruals WHERE student_id = $1;`,
          [st.id]
        );
        const childInterest = parseInt(intRes.rows[0]?.interest_paise || 0);
        totalInterestEarned += childInterest;

        const target = parseInt(st.target_fee_paise);
        return {
          student_id: st.id,
          name: st.name,
          school_name: st.school_name,
          school_code: st.school_code,
          standard: st.standard || 'Class 4',
          saved_balance_paise: childBal,
          target_fee_paise: target,
          percentage_completed: target > 0 ? Math.min(100, parseFloat(((childBal / target) * 100).toFixed(1))) : 0,
          status: st.status
        };
      })
    );

    // 2. Fetch Recent Transactions
    const txRes = await db.query(
      `SELECT id, amount_paise, status, upi_transaction_ref, created_at, split_details
       FROM payments
       WHERE parent_id = $1
       ORDER BY created_at DESC
       LIMIT 5;`,
      [parentId]
    );

    // 3. Compute annual payout countdown (target: 15 May 2027)
    const payoutDate = new Date('2027-05-15T00:00:00Z');
    const today = new Date();
    const diffTime = Math.max(0, payoutDate - today);
    const daysUntilPayout = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return res.status(200).json({
      success: true,
      data: {
        total_savings_locked_paise: totalSavingsLocked,
        total_interest_earned_paise: totalInterestEarned,
        annual_payout_date: '2027-05-15',
        days_until_payout: daysUntilPayout,
        children: childrenCards,
        recent_transactions: txRes.rows.map(tx => ({
          id: tx.id,
          amount_paise: parseInt(tx.amount_paise),
          status: tx.status,
          upi_ref: tx.upi_transaction_ref || 'UPI-' + tx.id.slice(0, 8),
          date: tx.created_at
        }))
      }
    });
  } catch (err) {
    console.error('Error in getWalletSummary:', err);
    return res.status(500).json({ success: false, message: 'Internal server error retrieving wallet summary.' });
  }
}

// -----------------------------------------------------------------------------
// 2. CREATE PAYMENT ORDER (WITH AUTO/MANUAL SPLIT)
// -----------------------------------------------------------------------------
async function createPayment(req, res) {
  try {
    const parentId = req.user.id;
    const { amount_paise, idempotency_key, split } = req.body;

    if (!amount_paise || amount_paise <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount.' });
    }

    if (!idempotency_key) {
      return res.status(400).json({ success: false, message: 'Idempotency key is required to prevent duplicate charges.' });
    }

    // 1. Idempotency Check: if this exact key was already created, return existing record
    const existingPayment = await db.query(
      'SELECT id, amount_paise, status, upi_intent_url, created_at FROM payments WHERE idempotency_key = $1;',
      [idempotency_key]
    );

    if (existingPayment.rows.length > 0) {
      const p = existingPayment.rows[0];
      return res.status(200).json({
        success: true,
        payment_id: p.id,
        amount_paise: parseInt(p.amount_paise),
        upi_intent_url: p.upi_intent_url,
        status: p.status,
        message: 'Returning existing payment order (Idempotency matched).'
      });
    }

    // 2. Validate split
    let splitDetails = split;
    if (!splitDetails || !Array.isArray(splitDetails) || splitDetails.length === 0) {
      // Auto-assign to parent's children if not explicitly provided
      const kids = await db.query('SELECT id FROM students WHERE parent_id = $1;', [parentId]);
      if (kids.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Please add a child profile before saving.' });
      }
      const count = kids.rows.length;
      const perKid = Math.floor(amount_paise / count);
      splitDetails = kids.rows.map((k, idx) => ({
        student_id: k.id,
        amount_paise: idx === count - 1 ? amount_paise - perKid * (count - 1) : perKid
      }));
    } else {
      // Verify split sum
      const splitSum = splitDetails.reduce((sum, item) => sum + parseInt(item.amount_paise || 0), 0);
      if (splitSum !== parseInt(amount_paise)) {
        return res.status(400).json({
          success: false,
          message: `Split allocation sum (₹${(splitSum / 100).toFixed(2)}) must equal total payment amount (₹${(amount_paise / 100).toFixed(2)}).`
        });
      }
    }

    const paymentId = 'pay_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const amountInRupees = (amount_paise / 100).toFixed(2);
    const upiIntentUrl = `upi://pay?pa=feevault.escrow@icici&pn=FeeVaultEscrow&am=${amountInRupees}&tr=${paymentId}&tn=SchoolFeeSavings`;

    // 3. Create payment record in database
    const insertRes = await db.query(
      `INSERT INTO payments 
       (parent_id, amount_paise, split_details, status, upi_intent_url, idempotency_key, created_at)
       VALUES ($1, $2, $3, 'CREATED', $4, $5, CURRENT_TIMESTAMP)
       RETURNING id, amount_paise, status, upi_intent_url, created_at;`,
      [parentId, amount_paise, JSON.stringify(splitDetails), upiIntentUrl, idempotency_key]
    );

    const payment = insertRes.rows[0];

    return res.status(200).json({
      success: true,
      payment_id: payment.id,
      amount_paise: parseInt(payment.amount_paise),
      upi_intent_url: payment.upi_intent_url,
      virtual_account: {
        account_number: 'VAULTICICI' + req.user.phone.slice(-6),
        ifsc: 'ICIC0000104',
        beneficiary: 'FeeVault ICICI Escrow Collection'
      },
      status: payment.status
    });
  } catch (err) {
    console.error('Error in createPayment:', err);
    return res.status(500).json({ success: false, message: 'Internal server error creating payment.' });
  }
}

// -----------------------------------------------------------------------------
// 3. CHECK PAYMENT STATUS
// -----------------------------------------------------------------------------
async function getPaymentStatus(req, res) {
  try {
    const parentId = req.user.id;
    const { id } = req.params;

    const payRes = await db.query(
      'SELECT id, amount_paise, status, upi_transaction_ref, paid_at FROM payments WHERE id = $1 AND parent_id = $2;',
      [id, parentId]
    );

    if (payRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const p = payRes.rows[0];
    return res.status(200).json({
      success: true,
      payment_id: p.id,
      status: p.status,
      amount_paise: parseInt(p.amount_paise),
      upi_ref: p.upi_transaction_ref || null,
      paid_at: p.paid_at || null
    });
  } catch (err) {
    console.error('Error in getPaymentStatus:', err);
    return res.status(500).json({ success: false, message: 'Internal server error checking payment status.' });
  }
}

// -----------------------------------------------------------------------------
// 4. CONFIRM PAYMENT & EXECUTE DOUBLE-ENTRY LEDGER (WEBHOOK / TEST EXECUTION)
// -----------------------------------------------------------------------------
async function confirmPaymentAndExecuteLedger(paymentId, upiRef, client) {
  // 1. Fetch payment
  const pRes = await client.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE;', [paymentId]);
  if (pRes.rows.length === 0) throw new Error('Payment not found');
  const payment = pRes.rows[0];

  if (payment.status === 'SUCCESS') return payment; // Already executed

  const amountPaise = parseInt(payment.amount_paise);
  const parentId = payment.parent_id;
  const splitDetails = typeof payment.split_details === 'string' ? JSON.parse(payment.split_details) : payment.split_details;

  // 2. Ensure system accounts exist
  const escrowRes = await client.query("SELECT id FROM ledger_accounts WHERE account_type = 'BANK_ESCROW_POOL' LIMIT 1;");
  if (escrowRes.rows.length === 0) throw new Error('Master Escrow Pool account missing in ledger');
  const escrowAccountId = escrowRes.rows[0].id;

  // Ensure parent vault account exists
  let parentAccRes = await client.query("SELECT id FROM ledger_accounts WHERE account_type = 'PARENT_VAULT' AND owner_id = $1;", [parentId]);
  let parentAccountId;
  if (parentAccRes.rows.length === 0) {
    const newAcc = await client.query(
      "INSERT INTO ledger_accounts (account_type, owner_id, currency, description) VALUES ('PARENT_VAULT', $1, 'INR', 'Parent Savings Vault') RETURNING id;",
      [parentId]
    );
    parentAccountId = newAcc.rows[0].id;
  } else {
    parentAccountId = parentAccRes.rows[0].id;
  }

  // 3. Create Double-Entry Ledger Transaction
  const txRes = await client.query(
    `INSERT INTO ledger_transactions 
     (transaction_type, reference_id, idempotency_key, description)
     VALUES ('DEPOSIT', $1, $2, $3)
     RETURNING id;`,
    [payment.id, 'TX_DEP_' + payment.id, `UPI Top-Up for Parent: ₹${(amountPaise / 100).toFixed(2)}`]
  );
  const ledgerTxId = txRes.rows[0].id;

  // 4. Immutable Ledger Entries (Sum of debits == Sum of credits)
  // DEBIT: Bank Escrow Pool (Asset increases with incoming money)
  await client.query(
    `INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_paise)
     VALUES ($1, $2, 'DEBIT', $3);`,
    [ledgerTxId, escrowAccountId, amountPaise]
  );

  // CREDIT: Each Student's Vault according to split_details
  for (const item of splitDetails) {
    const studentId = item.student_id;
    const splitAmount = parseInt(item.amount_paise);

    let stdAccRes = await client.query(
      "SELECT id FROM ledger_accounts WHERE account_type = 'STUDENT_VAULT' AND owner_id = $1;",
      [studentId]
    );

    let studentAccountId;
    if (stdAccRes.rows.length === 0) {
      const newStdAcc = await client.query(
        "INSERT INTO ledger_accounts (account_type, owner_id, currency, description) VALUES ('STUDENT_VAULT', $1, 'INR', 'Locked Student Vault') RETURNING id;",
        [studentId]
      );
      studentAccountId = newStdAcc.rows[0].id;
    } else {
      studentAccountId = stdAccRes.rows[0].id;
    }

    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_paise)
       VALUES ($1, $2, 'CREDIT', $3);`,
      [ledgerTxId, studentAccountId, splitAmount]
    );
  }

  // 5. Mark Payment as SUCCESS
  const cleanUpiRef = upiRef || 'UPI_' + Date.now();
  await client.query(
    `UPDATE payments 
     SET status = 'SUCCESS', 
         upi_transaction_ref = $1, 
         paid_at = CURRENT_TIMESTAMP, 
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2;`,
    [cleanUpiRef, payment.id]
  );

  // 6. Send Notification record
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, channel)
     VALUES ($1, 'PAYMENT_SUCCESS', 'Savings Deposit Confirmed! 🎉', $2, 'WHATSAPP');`,
    [parentId, `₹${(amountPaise / 100).toFixed(2)} successfully saved in your locked FeeVault.`]
  );

  return payment;
}

// -----------------------------------------------------------------------------
// 5. TEST/MOCK PAYMENT SUCCESS WEBHOOK
// -----------------------------------------------------------------------------
async function mockPaySuccess(req, res) {
  const client = await db.pool.connect();
  try {
    const { payment_id, upi_ref } = req.body;
    if (!payment_id) {
      return res.status(400).json({ success: false, message: 'payment_id is required.' });
    }

    await client.query('BEGIN');
    await confirmPaymentAndExecuteLedger(payment_id, upi_ref, client);
    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed and Double-Entry Ledger updated successfully!',
      payment_id,
      status: 'SUCCESS'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error confirming payment:', err);
    return res.status(500).json({ success: false, message: err.message || 'Payment processing error' });
  } finally {
    client.release();
  }
}

module.exports = {
  getWalletSummary,
  createPayment,
  getPaymentStatus,
  mockPaySuccess
};

