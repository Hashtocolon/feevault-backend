
const express = require('express');
const router = express.Router();

const {
    getSavedLocations
} = require('../controllers/customerController');

const {
    authenticateToken
} = require('../middlewares/auth');

// Screen 7 - API 4
router.get(
    '/saved-locations',
    authenticateToken,
    getSavedLocations
);

module.exports = router;
