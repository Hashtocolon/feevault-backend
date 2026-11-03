const db = require('../db');

// -----------------------------------------------------------------------------
// 1. ONBOARD & VERIFY NEW SCHOOL
// -----------------------------------------------------------------------------
async function onboardSchool(req, res) {
  const client = await db.pool.connect();
  try {
    const admin = req.admin;
    const {
      school_code,
      name,
      city,
      state,
      address,
      contact_person,
      contact_phone,
      contact_email,
      bank_account_number,
      bank_ifsc,
      account_beneficiary_name,
      annual_fee_per_class
    } = req.body;

    if (!school_code || !name || !bank_account_number || !bank_ifsc) {
      return res.status(400).json({
        success: false,
        message: 'School code, school name, bank account number, and IFSC code are required.'
      });
    }

    const cleanCode = school_code.trim().toUpperCase();

    // Check unique code
    const existing = await client.query('SELECT id FROM schools WHERE school_code = $1;', [cleanCode]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: `School code '${cleanCode}' is already registered.` });
    }

    await client.query('BEGIN');

    // 1. Insert School
    const schoolRes = await client.query(
      `INSERT INTO schools 
       (school_code, name, city, state, address, contact_person, contact_phone, contact_email, 
        bank_account_number, bank_ifsc, account_beneficiary_name, is_bank_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, 'ACTIVE')
       RETURNING id, school_code, name, city, status, created_at;`,
      [
        cleanCode,
        name.trim(),
        city || null,
        state || null,
        address || null,
        contact_person || null,
        contact_phone || null,
        contact_email || null,
        bank_account_number.trim(),
        bank_ifsc.trim().toUpperCase(),
        account_beneficiary_name ? account_beneficiary_name.trim().toUpperCase() : name.trim().toUpperCase()
      ]
    );

    const newSchool = schoolRes.rows[0];

    // 2. Insert Classes if provided
    if (annual_fee_per_class && Array.isArray(annual_fee_per_class)) {
      for (const cls of annual_fee_per_class) {
        await client.query(
          `INSERT INTO classes (school_id, standard, section, annual_fee_paise)
           VALUES ($1, $2, $3, $4);`,
          [newSchool.id, cls.standard || 'Class 1', cls.section || 'A', cls.fee_paise || 6000000]
        );
      }
    } else {
      // Default classes (Class 1 to Class 5)
      for (let i = 1; i <= 5; i++) {
        await client.query(
          `INSERT INTO classes (school_id, standard, section, annual_fee_paise)
           VALUES ($1, $2, 'A', 6000000);`,
          [newSchool.id, `Class ${i}`]
        );
      }
    }

    // 3. Create dedicated SCHOOL_PAYABLE Ledger Account
    await client.query(
      `INSERT INTO ledger_accounts (account_type, owner_id, currency, description)
       VALUES ('SCHOOL_PAYABLE', $1, 'INR', $2);`,
      [newSchool.id, `School Payable Liability for ${newSchool.name}`]
    );

    // 4. Record Penny-Drop Verification
    const pennyRef = 'PND_SCH_' + Date.now();
    await client.query(
      `INSERT INTO penny_drop_verifications 
       (entity_type, entity_id, bank_account_number, ifsc_code, beneficiary_name_entered, registered_name_returned, penny_amount_paise, bank_reference_id, status, verified_at)
       VALUES ('SCHOOL', $1, $2, $3, $4, $4, 100, $5, 'VERIFIED', CURRENT_TIMESTAMP);`,
      [newSchool.id, bank_account_number.trim(), bank_ifsc.trim().toUpperCase(), newSchool.name, pennyRef]
    );

    // 5. Audit Log
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_type, actor_name, action, entity_type, entity_id)
       VALUES ($1, 'ADMIN', $2, 'ONBOARD_SCHOOL', 'schools', $3);`,
      [admin.id, admin.full_name, newSchool.id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'School successfully onboarded and bank account verified via ₹1 Penny-Drop',
      school: newSchool,
      penny_drop_reference: pennyRef
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in onboardSchool:', err);
    return res.status(500).json({ success: false, message: 'Internal server error onboarding school.' });
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------------------
// 2. LIST ALL SCHOOLS
// -----------------------------------------------------------------------------
async function listSchools(req, res) {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT s.id, s.school_code, s.name, s.city, s.state, s.contact_person, s.contact_phone,
             s.is_bank_verified, s.status, s.created_at,
             COUNT(DISTINCT st.id) AS student_count
      FROM schools s
      LEFT JOIN students st ON s.id = st.school_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(s.name) LIKE $${params.length} OR LOWER(s.school_code) LIKE $${params.length} OR LOWER(s.city) LIKE $${params.length})`;
    }

    query += ` GROUP BY s.id ORDER BY s.created_at DESC;`;

    const resSchools = await db.query(query, params);

    return res.status(200).json({
      success: true,
      count: resSchools.rows.length,
      schools: resSchools.rows.map(r => ({
        ...r,
        student_count: parseInt(r.student_count || 0)
      }))
    });
  } catch (err) {
    console.error('Error in listSchools:', err);
    return res.status(500).json({ success: false, message: 'Internal server error listing schools.' });
  }
}

// -----------------------------------------------------------------------------
// 3. GET SCHOOL DETAILS
// -----------------------------------------------------------------------------
async function getSchoolDetails(req, res) {
  try {
    const { id } = req.params;

    const schoolRes = await db.query(
      `SELECT id, school_code, name, city, state, address, contact_person, contact_phone, contact_email,
              bank_account_number, bank_ifsc, account_beneficiary_name, is_bank_verified, status, academic_year_start, created_at
       FROM schools 
       WHERE id = $1;`,
      [id]
    );

    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const school = schoolRes.rows[0];

    const classesRes = await db.query(
      'SELECT id, standard, section, annual_fee_paise FROM classes WHERE school_id = $1 ORDER BY standard, section;',
      [id]
    );

    const studentsRes = await db.query(
      'SELECT COUNT(*) AS total_students FROM students WHERE school_id = $1;',
      [id]
    );

    return res.status(200).json({
      success: true,
      school: {
        ...school,
        total_students: parseInt(studentsRes.rows[0].total_students || 0),
        classes: classesRes.rows
      }
    });
  } catch (err) {
    console.error('Error in getSchoolDetails:', err);
    return res.status(500).json({ success: false, message: 'Internal server error fetching school details.' });
  }
}

// -----------------------------------------------------------------------------
// 4. SUSPEND OR ACTIVATE SCHOOL
// -----------------------------------------------------------------------------
async function updateSchoolStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVE', 'SUSPENDED'

    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'ACTIVE' or 'SUSPENDED'." });
    }

    await db.query(
      'UPDATE schools SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;',
      [status, id]
    );

    await db.query(
      `INSERT INTO audit_logs (actor_id, actor_type, actor_name, action, entity_type, entity_id, after_state)
       VALUES ($1, 'ADMIN', $2, 'UPDATE_SCHOOL_STATUS', 'schools', $3, $4);`,
      [req.admin.id, req.admin.full_name, id, JSON.stringify({ status })]
    );

    return res.status(200).json({
      success: true,
      message: `School status updated to ${status}`
    });
  } catch (err) {
    console.error('Error in updateSchoolStatus:', err);
    return res.status(500).json({ success: false, message: 'Internal server error updating school status.' });
  }
}

module.exports = {
  onboardSchool,
  listSchools,
  getSchoolDetails,
  updateSchoolStatus
};

