const express = require('express');
const router = express.Router();

const consentController = require('../controllers/consentController');
const { authenticateToken } = require('../middlewares/auth');

router.get(
  '/consents',
  authenticateToken,
  consentController.getConsents
);

router.post(
  '/consents',
  authenticateToken,
  consentController.saveConsents
);

module.exports = router;