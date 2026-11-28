const express = require('express');
const router = express.Router();

const profileController = require('../controllers/profileController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/me', authenticateToken, profileController.getMyProfile);

router.post(
  '/compliance/gstin/verify',
  authenticateToken,
  profileController.verifyGstin
);

router.post(
  '/customer/profile',
  authenticateToken,
  profileController.saveCustomerProfile
);

module.exports = router;