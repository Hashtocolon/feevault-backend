const db = require('../db');

// -----------------------------------------------------------------------------
// 1. GET TAX & INTEREST STATEMENT (FORM 16A)
// -----------------------------------------------------------------------------
async function getTaxStatement(req, res) {
  try {
    const parentId = req.user.id;
    const year = req.query.year || '2026';

    // Calculate total interest earned by parent's children
    const intRes = await db.query(
      `SELECT COALESCE(SUM(ia.daily_accrued_paise), 0) AS gross_interest_paise
       FROM interest_accruals ia
       JOIN students s ON ia.student_id = s.id
       WHERE s.parent_id = $1 AND EXTRACT(YEAR FROM ia.accrual_date) = $2;`,
      [parentId, year]
    );

    const grossInterest = parseInt(intRes.rows[0]?.gross_interest_paise || 0);
    // TDS standard threshold calculation (10% TDS if applicable)
    const tdsDeducted = Math.floor(grossInterest * 0.10);

    return res.status(200).json({
      success: true,
      financial_year: `${year}-${parseInt(year) + 1}`,
      gross_interest_paise: grossInterest,
      tds_deducted_paise: tdsDeducted,
      tds_rate_percentage: 10,
      form_16a_available: true,
      form_16a_pdf_url: `/api/v1/documents/tax/form16a-${year}.pdf`,
      monthly_statement_pdf_url: `/api/v1/documents/statements/statement-latest.pdf`
    });
  } catch (err) {
    console.error('Error in getTaxStatement:', err);
    return res.status(500).json({ success: false, message: 'Internal server error generating tax statement.' });
  }
}

// -----------------------------------------------------------------------------
// 2. FILE EXCEPTION REQUEST (SCHOOL TRANSFER / ACCIDENTAL PAYMENT)
// -----------------------------------------------------------------------------
async function fileException(req, res) {
  try {
    const parentId = req.user.id;
    const { exception_type, student_id, reason, proof_document_url, amount_paise } = req.body;

    if (!exception_type || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Exception type and reason are required.'
      });
    }

    const insertRes = await db.query(
      `INSERT INTO exceptions 
       (exception_type, parent_id, student_id, amount_paise, reason, supporting_document_url, status, raised_by_user_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', 'PARENT')
       RETURNING id, exception_type, student_id, amount_paise, reason, status, created_at;`,
      [exception_type, parentId, student_id || null, amount_paise || null, reason.trim(), proof_document_url || null]
    );

    const exp = insertRes.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Exception request submitted successfully. Our operations team and finance checker will review.',
      exception: exp
    });
  } catch (err) {
    console.error('Error in fileException:', err);
    return res.status(500).json({ success: false, message: 'Internal server error submitting exception.' });
  }
}

// -----------------------------------------------------------------------------
// 3. LIST PARENT EXCEPTION REQUESTS
// -----------------------------------------------------------------------------
async function listExceptions(req, res) {
  try {
    const parentId = req.user.id;

    const listRes = await db.query(
      `SELECT e.id, e.exception_type, e.reason, e.status, e.resolution_notes, e.created_at, e.resolved_at,
              s.name AS student_name
       FROM exceptions e
       LEFT JOIN students s ON e.student_id = s.id
       WHERE e.parent_id = $1
       ORDER BY e.created_at DESC;`,
      [parentId]
    );

    return res.status(200).json({
      success: true,
      exceptions: listRes.rows
    });
  } catch (err) {
    console.error('Error in listExceptions:', err);
    return res.status(500).json({ success: false, message: 'Internal server error retrieving exceptions.' });
  }
}

module.exports = {
  getTaxStatement,
  fileException,
  listExceptions
};

