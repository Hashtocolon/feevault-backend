require('dotenv').config();
const db = require('./db');

async function migrate() {
  try {
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(10),
      ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log('SUCCESS: reset_otp and reset_otp_expires_at columns added to users table!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
