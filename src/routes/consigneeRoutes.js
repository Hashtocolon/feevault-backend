const express = require('express');
const router = express.Router();

const consigneeController = require('../controllers/consigneeController');

// These three APIs do NOT use JWT authentication.
// They validate the time-limited share token instead.

router.get(
  '/consignee/portal',
  consigneeController.getConsigneePortal
);

router.post(
  '/consignee/portal/verify-otp',
  consigneeController.verifyDeliveryOtp
);

router.post(
  '/consignee/portal/outcome',
  consigneeController.submitReceiverOutcome
);

module.exports = router;