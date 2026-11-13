
const express = require('express');

const router = express.Router();

const {
    verifyConsigneeGstin,
    verifyExistingEwayBill
} = require('../controllers/complianceController');

const {
    authenticateToken
} = require('../middlewares/auth');

// Screen 9 - API 1: Verify Consignee GSTIN
router.post(
    '/gstin/verify',
    authenticateToken,
    verifyConsigneeGstin
);

// Screen 9 - API 2: Verify Existing E-Way Bill
router.post(
    '/ewaybill/verify',
    authenticateToken,
    verifyExistingEwayBill
);

module.exports = router;
