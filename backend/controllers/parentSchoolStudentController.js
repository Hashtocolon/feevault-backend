const db = require('../db');

// -----------------------------------------------------------------------------
// 1. LOOKUP SCHOOL BY SCHOOL CODE
// -----------------------------------------------------------------------------
async function lookupSchool(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanCode = code.trim().toUpperCase();

    // Query school
    const schoolRes = await db.query(
      `SELECT id, school_code, name, city, state, address, academic_year_start, status
       FROM schools 
       WHERE UPPER(school_code) = $1 AND status != 'SUSPENDED';`,
      [cleanCode]
    );

    if (schoolRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No active school found with code '${cleanCode}'. Please check with your school administration.`
      });
    }

    const school = schoolRes.rows[0];

    // Query available classes for this school
    const classesRes = await db.query(
      `SELECT id, standard, section, annual_fee_paise 
       FROM classes 
       WHERE school_id = $1 
       ORDER BY standard, section;`,
      [school.id]
    );

    return res.status(200).json({
      success: true,
      school: {
        id: school.id,
        school_code: school.school_code,
        name: school.name,
        city: school.city,
        state: school.state,
        address: school.address,
        academic_year_start: school.academic_year_start,
        classes: classesRes.rows
      }
    });
  } catch (err) {
    console.error('Error in lookupSchool:', err);
    return res.status(500).json({ success: false, message: 'Internal server error looking up school.' });
  }
}

// -----------------------------------------------------------------------------
// 2. ADD STUDENT (LINK CHILD PROFILE)
// -----------------------------------------------------------------------------
async function addStudent(req, res) {
  try {
    const parentId = req.user.id;
    const { name, school_id, class_id, gender, date_of_birth, admission_reference } = req.body;

    if (!name || !school_id) {
      return res.status(400).json({
        success: false,
        message: 'Student name and school_id are required.'
      });
    }

    // Insert student
    const studentRes = await db.query(
      `INSERT INTO students (parent_id, school_id, class_id, name, gender, date_of_birth, admission_reference, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_VERIFICATION')
       RETURNING id, parent_id, school_id, class_id, name, gender, date_of_birth, status, created_at;`,
      [parentId, school_id, class_id || null, name.trim(), gender || null, date_of_birth || null, admission_reference || null]
    );

    const student = studentRes.rows[0];

    // Automatically create dedicated STUDENT_VAULT in Double-Entry Ledger
    await db.query(
      `INSERT INTO ledger_accounts (account_type, owner_id, currency, description)
       VALUES ('STUDENT_VAULT', $1, 'INR', $2)
       ON CONFLICT DO NOTHING;`,
      [student.id, `Locked Savings Vault for ${student.name}`]
    );

    // Get school details for response
    const schoolInfo = await db.query('SELECT name, school_code FROM schools WHERE id = $1;', [school_id]);
    const classInfo = class_id ? await db.query('SELECT standard FROM classes WHERE id = $1;', [class_id]) : { rows: [] };

    return res.status(201).json({
      success: true,
      message: 'Student linked successfully',
      student: {
        id: student.id,
        name: student.name,
        school_name: schoolInfo.rows[0]?.name || '',
        school_code: schoolInfo.rows[0]?.school_code || '',
        standard: classInfo.rows[0]?.standard || 'Not Assigned',
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
    const { id: studentId } = req.params;

    // Fetch student info
    const studentRes = await db.query(
      `SELECT s.id, s.name, s.gender, s.date_of_birth, s.status, s.admission_reference,
              sch.name AS school_name, sch.school_code,
              c.standard, COALESCE(c.annual_fee_paise, 6000000) AS target_fee_paise
       FROM students s
       JOIN schools sch ON s.school_id = sch.id
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

    // Fetch uploaded school documents (Receipts, Progress Reports, Certificates)
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
        standard: student.standard || 'Class 4',
        school_name: student.school_name,
        school_code: student.school_code,
        status: student.status,
        saved_balance_paise: savedBalance,
        accrued_interest_paise: accruedInterest,
        target_fee_paise: parseInt(student.target_fee_paise),
        percentage_completed: student.target_fee_paise > 0 
          ? Math.min(100, parseFloat(((savedBalance / student.target_fee_paise) * 100).toFixed(1))) 
          : 0,
        documents: docsRes.rows
      }
    });
  } catch (err) {
    console.error('Error in getStudentDetails:', err);
    return res.status(500).json({ success: false, message: 'Internal server error retrieving student details.' });
  }
}

// -----------------------------------------------------------------------------
// 4. LIST ALL STUDENTS FOR LOGGED-IN PARENT
// -----------------------------------------------------------------------------
async function listStudents(req, res) {
  try {
    const parentId = req.user.id;

    const listRes = await db.query(
      `SELECT s.id, s.name, s.status, sch.name AS school_name, sch.school_code, c.standard,
              COALESCE(c.annual_fee_paise, 6000000) AS target_fee_paise
       FROM students s
       JOIN schools sch ON s.school_id = sch.id
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
          standard: row.standard || 'Class 4',
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
  addStudent,
  getStudentDetails,
  listStudents
};

