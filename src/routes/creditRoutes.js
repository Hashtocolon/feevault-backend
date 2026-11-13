const express = require('express');
const router = express.Router();

const creditController = require('../controllers/creditController');
const { authenticateToken } = require('../middlewares/auth');

router.post(
  '/customer/credit-request',
  authenticateToken,
  creditController.createCreditRequest
);

router.post(
  '/contracts/link',
  authenticateToken,
  creditController.linkMasterContract
);

module.exports = router;