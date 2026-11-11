const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('PostgreSQL client connected to Render database pool');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

