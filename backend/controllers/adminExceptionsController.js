const db = require('../db');

// -----------------------------------------------------------------------------
// 1. LIST ALL EXCEPTION REQUESTS
// -----------------------------------------------------------------------------
async function listExceptions(req, res) {
  try {
    const { status } = req.query;

    let query = `
      SELECT e.id, e.exception_type, e.reason, e.amount_paise, e.supporting_document_url, 
             e.status, e.resolution_notes, e.created_at, e.resolved_at,
             u.full_name AS parent_name, u.phone AS parent_phone,
             s.name AS student_name,
             maker.full_name AS proposed_by, checker.full_name AS approved_by
      FROM exceptions e
      JOIN users u ON e.parent_id = u.id
      LEFT JOIN students s ON e.student_id = s.id
      LEFT JOIN admins maker ON e.proposed_by_maker_id = maker.id
      LEFT JOIN admins checker ON e.approved_by_checker_id = checker.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND e.status = $${params.length}`;
    }

    query += ` ORDER BY e.created_at DESC;`;

    const exRes = await db.query(query, params);

    return res.status(200).json({
      success: true,
      count: exRes.rows.length,
      exceptions: exRes.rows
    });
  } catch (err) {
    console.error('Error in listExceptions:', err);
    return res.status(500).json({ success: false, message: 'Internal server error listing exceptions.' });
  }
}

// -----------------------------------------------------------------------------
// 2. RESOLVE EXCEPTION (MAKER-CHECKER APPROVE/REJECT)
// -----------------------------------------------------------------------------
async function resolveException(req, res) {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const { action, target_school_id, resolution_notes } = req.body;

    if (!action || !['APPROVE_TRANSFER', 'APPROVE_REFUND', 'REJECT'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'APPROVE_TRANSFER', 'APPROVE_REFUND', or 'REJECT'."
      });
    }

    const exRes = await db.query('SELECT * FROM exceptions WHERE id = $1;', [id]);
    if (exRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exception record not found.' });
    }

    const exp = exRes.rows[0];

    let newStatus = 'APPROVED';
    if (action === 'REJECT') newStatus = 'REJECTED';

    // If school transfer approved, update the child's school
    if (action === 'APPROVE_TRANSFER' && exp.student_id && target_school_id) {
      await db.query('UPDATE students SET school_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [
        target_school_id,
        exp.student_id
      ]);
    }

    // Update exception status
    await db.query(
      `UPDATE exceptions 
       SET status = $1, 
           approved_by_checker_id = $2, 
           resolution_notes = $3, 
           resolved_at = CURRENT_TIMESTAMP, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4;`,
      [newStatus, admin.id, resolution_notes || 'Resolved by Admin', id]
    );

    // Notify parent
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, channel)
       VALUES ($1, 'EXCEPTION_RESOLVED', $2, $3, 'WHATSAPP');`,
      [
        exp.parent_id,
        `Your Exception Request has been ${newStatus}!`,
        resolution_notes || `Your request for ${exp.exception_type} has been reviewed and ${newStatus.toLowerCase()}.`
      ]
    );

    // Audit Log
    await db.query(
      `INSERT INTO audit_logs (actor_id, actor_type, actor_name, action, entity_type, entity_id, after_state)
       VALUES ($1, 'ADMIN', $2, 'RESOLVE_EXCEPTION', 'exceptions', $3, $4);`,
      [admin.id, admin.full_name, id, JSON.stringify({ action, newStatus, resolution_notes })]
    );

    return res.status(200).json({
      success: true,
      message: `Exception request ${newStatus.toLowerCase()} successfully.`,
      exception_id: id,
      status: newStatus
    });
  } catch (err) {
    console.error('Error in resolveException:', err);
    return res.status(500).json({ success: false, message: 'Internal server error resolving exception.' });
  }
}

module.exports = {
  listExceptions,
  resolveException
};

