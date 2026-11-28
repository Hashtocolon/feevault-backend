const express = require('express');
const router = express.Router();

const failedDeliveryController =
  require('../controllers/failedDeliveryController');

const { authenticateToken } = require('../middlewares/auth');

router.post(
  '/trips/:bookingId/failed-delivery-decision',
  authenticateToken,
  failedDeliveryController.submitFailedDeliveryDecision
);

module.exports = router;