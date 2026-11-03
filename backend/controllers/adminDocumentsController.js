const db = require('../db');

// -----------------------------------------------------------------------------
// 1. UPLOAD DOCUMENT ON BEHALF OF SCHOOL (PHASE 1)
// -----------------------------------------------------------------------------
async function uploadDocument(req, res) {
  try {
    const admin = req.admin;
    const { school_id, student_id, document_type, title, file_url } = req.body;

    if (!school_id || !student_id || !document_type || !title) {
      return res.status(400).json({
        success: false,
        message: 'school_id, student_id, document_type, and title are required.'
      });
    }

    // Verify student belongs to this school
    const studentRes = await db.query(
      `SELECT s.id, s.name, s.parent_id, sch.name AS school_name
       FROM students s
       JOIN schools sch ON s.school_id = sch.id
       WHERE s.id = $1 AND s.school_id = $2;`,
      [student_id, school_id]
    );

    if (studentRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Student does not belong to the selected school.' });
    }

    const student = studentRes.rows[0];
    const finalUrl = file_url || `/uploads/documents/${student_id}_${Date.now()}.pdf`;

    // 1. Insert into documents table
    const docRes = await db.query(
      `INSERT INTO documents 
       (student_id, school_id, document_type, title, file_path, uploaded_by_admin_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, student_id, school_id, document_type, title, file_path, created_at;`,
      [student_id, school_id, document_type, title.trim(), finalUrl, admin.id]
    );

    const doc = docRes.rows[0];

    // 2. Notify Parent via in-app & WhatsApp
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, channel)
       VALUES ($1, 'DOCUMENT_PUBLISHED', $2, $3, 'WHATSAPP');`,
      [
        student.parent_id,
        `New Document from ${student.school_name}! 📄`,
        `${title} has been uploaded for ${student.name}. You can view or download it directly in your FeeVault app.`
      ]
    );

    // 3. Audit Log
    await db.query(
      `INSERT INTO audit_logs (actor_id, actor_type, actor_name, action, entity_type, entity_id)
       VALUES ($1, 'ADMIN', $2, 'UPLOAD_SCHOOL_DOCUMENT', 'documents', $3);`,
      [admin.id, admin.full_name, doc.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Document published successfully on behalf of school. Parent notified.',
      document: doc
    });
  } catch (err) {
    console.error('Error in uploadDocument:', err);
    return res.status(500).json({ success: false, message: 'Internal server error uploading document.' });
  }
}

// -----------------------------------------------------------------------------
// 2. LIST UPLOADED DOCUMENTS
// -----------------------------------------------------------------------------
async function listDocuments(req, res) {
  try {
    const { school_id, student_id, document_type } = req.query;

    let query = `
      SELECT d.id, d.document_type, d.title, d.file_path, d.created_at,
             s.name AS student_name, sch.name AS school_name,
             adm.full_name AS uploaded_by_admin
      FROM documents d
      JOIN students s ON d.student_id = s.id
      JOIN schools sch ON d.school_id = sch.id
      LEFT JOIN admins adm ON d.uploaded_by_admin_id = adm.id
      WHERE d.is_active = TRUE
    `;
    const params = [];

    if (school_id) {
      params.push(school_id);
      query += ` AND d.school_id = $${params.length}`;
    }

    if (student_id) {
      params.push(student_id);
      query += ` AND d.student_id = $${params.length}`;
    }

    if (document_type) {
      params.push(document_type);
      query += ` AND d.document_type = $${params.length}`;
    }

    query += ` ORDER BY d.created_at DESC;`;

    const docsRes = await db.query(query, params);

    return res.status(200).json({
      success: true,
      count: docsRes.rows.length,
      documents: docsRes.rows
    });
  } catch (err) {
    console.error('Error in listDocuments:', err);
    return res.status(500).json({ success: false, message: 'Internal server error listing documents.' });
  }
}

module.exports = {
  uploadDocument,
  listDocuments
};

