
const express = require('express');

const router = express.Router();

const {
    getAvailableHiringModels,
    checkServiceability,
    getVehicleClasses,
    getTemperatureBands
} = require('../controllers/masterController');

const {
    authenticateToken
} = require('../middlewares/auth');

// =====================================================
// SCREEN 7 - API 1
// Fetch Available Hiring Models
// GET /api/v1/master/hiring-models
// =====================================================

router.get(
    '/hiring-models',
    authenticateToken,
    getAvailableHiringModels
);

// =====================================================
// SCREEN 7 - API 2
// Check Pickup and Drop Serviceability
// GET /api/v1/master/serviceability
// =====================================================

router.get(
    '/serviceability',
    authenticateToken,
    checkServiceability
);

// =====================================================
// SCREEN 7 - API 3
// Fetch Reefer Vehicle Classes
// GET /api/v1/master/vehicle-classes
// =====================================================

router.get(
    '/vehicle-classes',
    authenticateToken,
    getVehicleClasses
);

// Screen 8 - API 1: Fetch Temperature SLA Bands
router.get(
    '/temp-bands',
    authenticateToken,
    getTemperatureBands
);

module.exports = router;
