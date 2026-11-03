const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize database connection & schema check
const db = require('./db');

// Import Route Handlers
const parentRoutes = require('./routes/parentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Mount API Routes
app.use('/api/v1', parentRoutes);
app.use('/api/v1/admin', adminRoutes);

// Basic API Health Check
app.get('/api/v1/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() AS current_time, COUNT(*) AS school_count FROM schools;');
    return res.status(200).json({
      status: 'UP',
      service: 'FeeVault Phase 1 Backend API',
      timestamp: result.rows[0].current_time,
      database: 'Connected to Neon PostgreSQL',
      active_schools: parseInt(result.rows[0].school_count)
    });
  } catch (err) {
    return res.status(500).json({
      status: 'DEGRADED',
      service: 'FeeVault Phase 1 Backend API',
      database_error: err.message
    });
  }
});

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'FeeVault Backend API (Phase 1)',
    version: '1.0.0',
    description: 'Locked-savings platform for school fees with double-entry ledger',
    endpoints: {
      health: '/api/v1/health',
      parent_api: '/api/v1',
      admin_api: '/api/v1/admin'
    }
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 FeeVault Phase 1 API running on port ${PORT}`);
  console.log(`📡 Health Check URL: http://localhost:${PORT}/api/v1/health`);
  console.log(`📲 Parent API Base:  http://localhost:${PORT}/api/v1`);
  console.log(`====================================================`);
});
