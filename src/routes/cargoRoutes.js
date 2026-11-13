
const express = require('express');

const router = express.Router();

const {
    checkCargoCompatibility
} = require('../controllers/cargoController');

const {
    authenticateToken
} = require('../middlewares/auth');

// Screen 8 - API 2
router.post(
    '/compatibility-check',
    authenticateToken,
    checkCargoCompatibility
);

module.exports = router;
