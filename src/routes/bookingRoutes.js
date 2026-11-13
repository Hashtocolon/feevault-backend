const express = require('express');
const router = express.Router();

const bookingController = require('../controllers/bookingController');
const { authenticateToken } = require('../middlewares/auth');

router.post(
  '/bookings/create',
  authenticateToken,
  bookingController.createBooking
);

module.exports = router;