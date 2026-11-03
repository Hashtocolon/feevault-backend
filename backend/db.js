const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ WARNING: DATABASE_URL is not set in environment or .env file!');
}

// Cloud PostgreSQL (Neon, Render, Supabase, etc.) requires SSL.
// Only local development (localhost) disables SSL.
const isLocalhost = connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'));
const useSSL = isLocalhost ? false : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString: connectionString,
  ssl: useSSL
});

// Auto-initialize schema on startup
async function initDatabase() {
  if (!connectionString) return;
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to Neon PostgreSQL database successfully!');
    
    // Check if 'users' table exists
    const checkRes = await client.query("SELECT to_regclass('public.users');");
    const tableExists = checkRes.rows[0].to_regclass !== null;
    
    if (!tableExists) {
      console.log('⚠️ Tables not found. Executing schema.sql to initialize all FeeVault Phase 1 tables...');
      const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      await client.query(schemaSql);
      console.log('🎉 FeeVault Phase 1 PostgreSQL schema initialized successfully!');
    } else {
      console.log('✅ FeeVault PostgreSQL schema is already initialized and ready.');
    }
  } catch (err) {
    console.error('❌ PostgreSQL connection/initialization error:', err.message);
  } finally {
    if (client) client.release();
  }
}

// Run initialization
initDatabase();

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
