
const express = require('express');
const router = express.Router();

const dispatchController = require('../controllers/dispatchController');
const { authenticateToken } = require('../middlewares/auth');

// Screen 11 - API 1
router.get(
    '/:bookingId/dispatch-status',
    authenticateToken,
    dispatchController.getDispatchStatus
);
router.post(
    '/:bookingId/cancel',
    authenticateToken,
    dispatchController.cancelBooking
);
router.post(
    '/:bookingId/escalate-ops',
    authenticateToken,
    dispatchController.escalateOps
);
// Screen 12 - API 1: Booking Confirmation
router.get(
    '/:bookingId/confirmation',
    authenticateToken,
    dispatchController.getBookingConfirmation
);

module.exports = router;
