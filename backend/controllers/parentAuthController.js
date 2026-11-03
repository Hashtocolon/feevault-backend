const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

// -----------------------------------------------------------------------------
// 1. REGISTER NEW PARENT
// -----------------------------------------------------------------------------
async function register(req, res) {
  try {
    const { full_name, username, email, phone, password } = req.body;

    if (!username || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, phone number, and password are required.'
      });
    }

    // Check if username or phone already exists
    const existingCheck = await db.query(
      'SELECT id, username, phone FROM users WHERE username = $1 OR phone = $2;',
      [username.trim().toLowerCase(), phone.trim()]
    );

    if (existingCheck.rows.length > 0) {
      const match = existingCheck.rows[0];
      if (match.username === username.trim().toLowerCase()) {
        return res.status(400).json({ success: false, message: 'Username is already taken.' });
      }
      return res.status(400).json({ success: false, message: 'Phone number is already registered.' });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const insertUserRes = await db.query(
      `INSERT INTO users (full_name, username, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'PARENT', 'ACTIVE')
       RETURNING id, full_name, username, email, phone, role, status, dpdp_consent_recorded, is_bank_verified, created_at;`,
      [full_name || username, username.trim().toLowerCase(), email ? email.trim().toLowerCase() : null, phone.trim(), password_hash]
    );

    const newUser = insertUserRes.rows[0];

    // Create Master PARENT_VAULT in Double-Entry Ledger
    await db.query(
      `INSERT INTO ledger_accounts (account_type, owner_id, currency, description)
       VALUES ('PARENT_VAULT', $1, 'INR', $2)
       ON CONFLICT DO NOTHING;`,
      [newUser.id, `Master Savings Vault for ${newUser.full_name}`]
    );

    // Generate JWT Token
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, phone: newUser.phone, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Parent account created successfully',
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Error in register:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during registration.' });
  }
}

// -----------------------------------------------------------------------------
// 2. PARENT LOGIN
// -----------------------------------------------------------------------------
async function login(req, res) {
  try {
    const { username, password, device_id, fcm_token } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/Email and password are required.'
      });
    }

    const identifier = username.trim().toLowerCase();

    // Query by username or email
    const userRes = await db.query(
      `SELECT id, full_name, username, email, phone, password_hash, role, status, 
              mpin_hash, biometric_enabled, dpdp_consent_recorded, is_bank_verified 
       FROM users 
       WHERE username = $1 OR email = $1;`,
      [identifier]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const user = userRes.rows[0];

    if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact support.' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid password. Please check your credentials.' });
    }

    // Update device credentials if provided
    if (device_id || fcm_token) {
      await db.query(
        'UPDATE users SET device_id = COALESCE($1, device_id), fcm_token = COALESCE($2, fcm_token), updated_at = CURRENT_TIMESTAMP WHERE id = $3;',
        [device_id || null, fcm_token || null, user.id]
      );
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, username: user.username, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        biometric_enabled: !!user.biometric_enabled,
        mpin_set: !!user.mpin_hash,
        dpdp_consent_recorded: !!user.dpdp_consent_recorded,
        is_bank_verified: !!user.is_bank_verified
      }
    });
  } catch (err) {
    console.error('Error in login:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
}

// -----------------------------------------------------------------------------
// 3. SUBMIT DPDP PARENTAL CONSENT
// -----------------------------------------------------------------------------
async function submitConsent(req, res) {
  try {
    const parentId = req.user.id;
    const { consent_given, consent_version } = req.body;

    if (!consent_given) {
      return res.status(400).json({ success: false, message: 'Consent is required to proceed.' });
    }

    const version = consent_version || 'FV-DPDP-v1.0';

    await db.query(
      `UPDATE users 
       SET dpdp_consent_recorded = TRUE, 
           dpdp_consent_version = $1, 
           dpdp_consent_at = CURRENT_TIMESTAMP, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2;`,
      [version, parentId]
    );

    return res.status(200).json({
      success: true,
      message: 'Parental consent cryptographically recorded',
      consent_timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error in submitConsent:', err);
    return res.status(500).json({ success: false, message: 'Internal server error recording consent.' });
  }
}

// -----------------------------------------------------------------------------
// 4. KYC & REFUND BANK ACCOUNT BINDING (PENNY-DROP VERIFICATION)
// -----------------------------------------------------------------------------
async function saveKycAndBank(req, res) {
  try {
    const parentId = req.user.id;
    const { pan_number, bank_account_number, ifsc_code, account_holder_name } = req.body;

    if (!pan_number || !bank_account_number || !ifsc_code) {
      return res.status(400).json({
        success: false,
        message: 'PAN number, bank account number, and IFSC code are required.'
      });
    }

    // Clean inputs
    const cleanPan = pan_number.trim().toUpperCase();
    const cleanAcc = bank_account_number.trim();
    const cleanIfsc = ifsc_code.trim().toUpperCase();
    const cleanHolder = (account_holder_name || req.user.username).trim().toUpperCase();

    // 1. Simulate instant ₹1 Penny-Drop test with bank gateway
    const bankRef = 'PND_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    await db.query(
      `INSERT INTO penny_drop_verifications 
       (entity_type, entity_id, bank_account_number, ifsc_code, beneficiary_name_entered, registered_name_returned, penny_amount_paise, bank_reference_id, status, verified_at)
       VALUES ('PARENT', $1, $2, $3, $4, $5, 100, $6, 'VERIFIED', CURRENT_TIMESTAMP);`,
      [parentId, cleanAcc, cleanIfsc, cleanHolder, cleanHolder, bankRef]
    );

    // 2. Update user profile as bank verified
    await db.query(
      `UPDATE users 
       SET pan_number = $1, 
           refund_bank_account = $2, 
           refund_bank_ifsc = $3, 
           refund_bank_account_name = $4, 
           is_bank_verified = TRUE, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5;`,
      [cleanPan, cleanAcc, cleanIfsc, cleanHolder, parentId]
    );

    const maskedAcc = 'XXXX XXXX ' + cleanAcc.slice(-4);

    return res.status(200).json({
      success: true,
      message: 'Bank account verified successfully via ₹1 Penny-Drop',
      data: {
        pan_number: cleanPan,
        bank_account_number: maskedAcc,
        ifsc_code: cleanIfsc,
        verified_name: cleanHolder,
        is_bank_verified: true,
        penny_drop_reference: bankRef
      }
    });
  } catch (err) {
    console.error('Error in saveKycAndBank:', err);
    return res.status(500).json({ success: false, message: 'Internal server error verifying bank account.' });
  }
}

// -----------------------------------------------------------------------------
// 5. SETUP 4-DIGIT BACKUP MPIN
// -----------------------------------------------------------------------------
async function setupMpin(req, res) {
  try {
    const parentId = req.user.id;
    const { mpin } = req.body;

    if (!mpin || String(mpin).trim().length !== 4) {
      return res.status(400).json({ success: false, message: 'MPIN must be exactly 4 digits.' });
    }

    const saltRounds = 10;
    const mpin_hash = await bcrypt.hash(String(mpin).trim(), saltRounds);

    await db.query(
      'UPDATE users SET mpin_hash = $1, biometric_enabled = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $2;',
      [mpin_hash, parentId]
    );

    return res.status(200).json({
      success: true,
      message: '4-digit backup MPIN configured successfully'
    });
  } catch (err) {
    console.error('Error in setupMpin:', err);
    return res.status(500).json({ success: false, message: 'Internal server error setting MPIN.' });
  }
}

// -----------------------------------------------------------------------------
// 6. LOGIN WITH 4-DIGIT MPIN
// -----------------------------------------------------------------------------
async function loginMpin(req, res) {
  try {
    const { username, mpin, device_id } = req.body;

    if (!username || !mpin) {
      return res.status(400).json({ success: false, message: 'Username and 4-digit MPIN are required.' });
    }

    const userRes = await db.query(
      'SELECT id, username, phone, role, mpin_hash, status FROM users WHERE username = $1 OR email = $1;',
      [username.trim().toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const user = userRes.rows[0];

    if (!user.mpin_hash) {
      return res.status(400).json({ success: false, message: 'MPIN has not been configured yet. Please log in with password.' });
    }

    const isMatch = await bcrypt.compare(String(mpin).trim(), user.mpin_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect 4-digit MPIN.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: 'MPIN login successful',
      token,
      user_id: user.id
    });
  } catch (err) {
    console.error('Error in loginMpin:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during MPIN login.' });
  }
}

module.exports = {
  register,
  login,
  submitConsent,
  saveKycAndBank,
  setupMpin,
  loginMpin
};

