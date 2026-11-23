const db = require('../db');

// -----------------------------------------------------------------------------
// 1. LOOKUP / AUTO-FETCH SCHOOL BY NAME OR CODE
// -----------------------------------------------------------------------------
async function lookupSchool(req, res) {
  try {
    const { code, search, query, q } = req.query;
    const term = (search || query || q || code || '').trim();

    if (!term) {
      // Return top 10 registered schools if no search term
      const allSchools = await db.query(
        `SELECT id, school_code, name, city, state, address, academic_year_start, status
         FROM schools 
         WHERE status != 'SUSPENDED'
         ORDER BY name ASC
         LIMIT 10;`
      );
      return res.status(200).json({ success: true, schools: allSchools.rows });
    }

    // Exact code match
    if (code && !search && !query && !q) {
      const cleanCode = code.trim().toUpperCase();
      const schoolRes = await db.query(
        `SELECT id, school_code, name, city, state, address, academic_year_start, status
         FROM schools 
         WHERE UPPER(school_code) = $1 AND status != 'SUSPENDED';`,
        [cleanCode]
      );
      if (schoolRes.rows.length > 0) {
        return res.status(200).json({
          success: true,
          school: schoolRes.rows[0],
          schools: schoolRes.rows
        });
      }
    }

    // Substring / prefix auto-fetch by school name or school code
    const schoolRes = await db.query(
      `SELECT id, school_code, name, city, state, address, academic_year_start, status
       FROM schools 
       WHERE (name ILIKE $1 OR school_code ILIKE $1) AND status != 'SUSPENDED'
       ORDER BY name ASC
       LIMIT 10;`,
      [`%${term}%`]
    );

    return res.status(200).json({
      success: true,
      schools: schoolRes.rows
    });
  } catch (err) {
    console.error('Error in lookupSchool:', err);
    return res.status(500).json({ success: false, message: 'Internal server error looking up school.' });
  }
}

// -----------------------------------------------------------------------------
// 1B. REQUEST ENROLLMENT FOR UNLISTED SCHOOL
// -----------------------------------------------------------------------------
async function requestSchoolEnrollment(req, res) {
  try {
    const parentId = req.user?.id || null;
    const { school_name, city, contact_info } = req.body;

    if (!school_name || !school_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'School name is required for enrollment request.'
      });
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const requestCode = `REQ-${randomNum}`;

    await db.query(
      `INSERT INTO school_enrollment_requests (request_code, parent_id, school_name, city, contact_info, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING');`,
      [
        requestCode,
        parentId,
        school_name.trim(),
        (city || '').trim() || null,
        (contact_info || '').trim() || null
      ]
    );

    return res.status(201).json({
      success: true,
      request_code: requestCode,
      message: `Enrollment request for "${school_name.trim()}" submitted successfully (${requestCode}). FeeVault team will verify and enroll.`
    });
  } catch (err) {
    console.error('Error in requestSchoolEnrollment:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error submitting enrollment request.'
    });
  }
}

// -----------------------------------------------------------------------------
// 2. ADD STUDENT (LINK CHILD PROFILE)
// -----------------------------------------------------------------------------
async function addStudent(req, res) {
  try {
    const parentId = req.user.id;
    const {
      name,
      school_name,
      school_code,
      school_id,
      class_name,
      grade,
      class_id,
      gender,
      date_of_birth,
      admission_reference
    } = req.body;

    if (!name || (!school_name && !school_id && !school_code)) {
      return res.status(400).json({
        success: false,
        message: 'Student name and school name are required.'
      });
    }

    let resolvedSchoolId = school_id || null;
    let resolvedSchoolName = (school_name || '').trim();
    let resolvedSchoolCode = (school_code || '').trim();

    // Auto-resolve school ID if code or name matches registered schools
    if (!resolvedSchoolId && resolvedSchoolCode) {
      const sRes = await db.query(
        'SELECT id, name, school_code FROM schools WHERE UPPER(school_code) = UPPER($1);',
        [resolvedSchoolCode]
      );
      if (sRes.rows.length > 0) {
        resolvedSchoolId = sRes.rows[0].id;
        resolvedSchoolName = sRes.rows[0].name;
        resolvedSchoolCode = sRes.rows[0].school_code;
      }
    } else if (!resolvedSchoolId && resolvedSchoolName) {
      const sRes = await db.query(
        'SELECT id, name, school_code FROM schools WHERE UPPER(name) = UPPER($1) OR name ILIKE $2 LIMIT 1;',
        [resolvedSchoolName, `%${resolvedSchoolName}%`]
      );
      if (sRes.rows.length > 0) {
        resolvedSchoolId = sRes.rows[0].id;
        resolvedSchoolName = sRes.rows[0].name;
        resolvedSchoolCode = sRes.rows[0].school_code;
      }
    } else if (resolvedSchoolId) {
      const sRes = await db.query(
        'SELECT name, school_code FROM schools WHERE id = $1;',
        [resolvedSchoolId]
      );
      if (sRes.rows.length > 0) {
        resolvedSchoolName = sRes.rows[0].name;
        resolvedSchoolCode = sRes.rows[0].school_code;
      }
    }

    const assignedClassName = (class_name || grade || '').trim();

    // Insert student
    const studentRes = await db.query(
      `INSERT INTO students (parent_id, school_id, class_id, name, gender, date_of_birth, admission_reference, class_name, school_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_VERIFICATION')
       RETURNING id, parent_id, school_id, class_id, name, gender, date_of_birth, class_name, school_name, status, created_at;`,
      [
        parentId,
        resolvedSchoolId,
        class_id || null,
        name.trim(),
        gender || null,
        date_of_birth || null,
        admission_reference || null,
        assignedClassName,
        resolvedSchoolName
      ]
    );

    const student = studentRes.rows[0];

    // If Student ID Card was uploaded, persist in documents table dynamically
    const { id_card_name, id_card_uri, id_card_base64 } = req.body;
    if (id_card_name || id_card_uri || id_card_base64) {
      const docPath = id_card_uri || id_card_name || 'id_card.png';
      const isPng = docPath.toLowerCase().endsWith('.png');
      const mime = isPng ? 'image/png' : 'image/jpeg';
      try {
        await db.query(
          `INSERT INTO documents (student_id, school_id, document_type, title, file_path, mime_type, is_active)
           VALUES ($1, $2, 'STUDENT_ID_CARD', $3, $4, $5, TRUE);`,
          [student.id, resolvedSchoolId, id_card_name || 'Student ID Card', docPath, mime]
        );
      } catch (docErr) {
        console.error('Non-blocking error saving student ID card document:', docErr);
      }
    }

    // Automatically create dedicated STUDENT_VAULT in Double-Entry Ledger
    await db.query(
      `INSERT INTO ledger_accounts (account_type, owner_id, currency, description)
       VALUES ('STUDENT_VAULT', $1, 'INR', $2)
       ON CONFLICT DO NOTHING;`,
      [student.id, `Locked Savings Vault for ${student.name}`]
    );

    return res.status(201).json({
      success: true,
      message: 'Student added successfully',
      student: {
        id: student.id,
        name: student.name,
        school_name: resolvedSchoolName,
        school_code: resolvedSchoolCode,
        class_name: assignedClassName,
        gender: student.gender,
        date_of_birth: student.date_of_birth,
        status: student.status,
        saved_balance_paise: 0
      }
    });
  } catch (err) {
    console.error('Error in addStudent:', err);
    return res.status(500).json({ success: false, message: 'Internal server error adding student.' });
  }
}

// -----------------------------------------------------------------------------
// 3. GET INDIVIDUAL STUDENT DETAILS & DOCUMENTS
// -----------------------------------------------------------------------------
async function getStudentDetails(req, res) {
  try {
    const parentId = req.user.id;
    const studentId = req.params.id;

    // Fetch student info with school details
    const studentRes = await db.query(
      `SELECT s.id, s.name, s.gender, s.date_of_birth, s.admission_reference, s.status, s.created_at,
              COALESCE(sch.name, s.school_name, 'School Verification Pending') AS school_name, 
              COALESCE(sch.school_code, '') AS school_code, 
              sch.city AS school_city, sch.state AS school_state,
              COALESCE(c.standard, s.class_name, 'Not Assigned') AS standard,
              COALESCE(c.annual_fee_paise, 6000000) AS annual_fee_paise
       FROM students s
       LEFT JOIN schools sch ON s.school_id = sch.id
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.id = $1 AND s.parent_id = $2;`,
      [studentId, parentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found or access unauthorized.' });
    }

    const student = studentRes.rows[0];

    // Compute saved balance from double-entry ledger entries for this student's vault
    const balanceRes = await db.query(
      `SELECT COALESCE(SUM(
        CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_paise ELSE -le.amount_paise END
       ), 0) AS saved_balance_paise
       FROM ledger_accounts la
       JOIN ledger_entries le ON la.id = le.account_id
       WHERE la.account_type = 'STUDENT_VAULT' AND la.owner_id = $1;`,
      [studentId]
    );

    const savedBalance = parseInt(balanceRes.rows[0]?.saved_balance_paise || 0);

    // Fetch accrued interest
    const interestRes = await db.query(
      `SELECT COALESCE(SUM(daily_accrued_paise), 0) AS accrued_interest_paise
       FROM interest_accruals 
       WHERE student_id = $1;`,
      [studentId]
    );

    const accruedInterest = parseInt(interestRes.rows[0]?.accrued_interest_paise || 0);

    // Fetch uploaded school documents
    const docsRes = await db.query(
      `SELECT id, document_type, title, file_path, mime_type, created_at AS uploaded_at
       FROM documents
       WHERE student_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC;`,
      [studentId]
    );

    return res.status(200).json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        gender: student.gender,
        date_of_birth: student.date_of_birth,
        standard: student.standard,
        class_name: student.standard,
        school_name: student.school_name,
        school_code: student.school_code,
        school_city: student.school_city,
        school_state: student.school_state,
        status: student.status,
        admission_reference: student.admission_reference,
        annual_fee_paise: parseInt(student.annual_fee_paise),
        saved_balance_paise: savedBalance,
        accrued_interest_paise: accruedInterest,
        documents: docsRes.rows
      }
    });
  } catch (err) {
    console.error('Error in getStudentDetails:', err);
    return res.status(500).json({ success: false, message: 'Internal server error fetching student details.' });
  }
}

// -----------------------------------------------------------------------------
// 4. LIST ALL STUDENTS FOR LOGGED-IN PARENT
// -----------------------------------------------------------------------------
async function listStudents(req, res) {
  try {
    const parentId = req.user.id;

    const listRes = await db.query(
      `SELECT s.id, s.name, s.gender, s.date_of_birth, s.status,
              COALESCE(sch.name, s.school_name, 'School Verification Pending') AS school_name, 
              COALESCE(sch.school_code, '') AS school_code, 
              COALESCE(c.standard, s.class_name, 'Not Assigned') AS standard,
              COALESCE(c.annual_fee_paise, 6000000) AS target_fee_paise
       FROM students s
       LEFT JOIN schools sch ON s.school_id = sch.id
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.parent_id = $1
       ORDER BY s.created_at ASC;`,
      [parentId]
    );

    // For each child, derive balance from ledger
    const studentsWithBalances = await Promise.all(
      listRes.rows.map(async (row) => {
        const balRes = await db.query(
          `SELECT COALESCE(SUM(
            CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_paise ELSE -le.amount_paise END
           ), 0) AS balance_paise
           FROM ledger_accounts la
           JOIN ledger_entries le ON la.id = le.account_id
           WHERE la.account_type = 'STUDENT_VAULT' AND la.owner_id = $1;`,
          [row.id]
        );
        const bal = parseInt(balRes.rows[0]?.balance_paise || 0);
        const target = parseInt(row.target_fee_paise || 6000000);
        return {
          student_id: row.id,
          name: row.name,
          gender: row.gender,
          date_of_birth: row.date_of_birth,
          standard: row.standard,
          class_name: row.standard,
          school_name: row.school_name,
          school_code: row.school_code,
          status: row.status,
          saved_balance_paise: bal,
          target_fee_paise: target,
          percentage_completed: target > 0 ? Math.min(100, parseFloat(((bal / target) * 100).toFixed(1))) : 0
        };
      })
    );

    return res.status(200).json({
      success: true,
      students: studentsWithBalances
    });
  } catch (err) {
    console.error('Error in listStudents:', err);
    return res.status(500).json({ success: false, message: 'Internal server error listing students.' });
  }
}

module.exports = {
  lookupSchool,
  requestSchoolEnrollment,
  addStudent,
  getStudentDetails,
  listStudents
};
