const express = require('express');
const router = express.Router();

const quoteController = require('../controllers/quoteController');
const { authenticateToken } = require('../middlewares/auth');

router.post(
  '/quotes/generate',
  authenticateToken,
  quoteController.generateQuote
);

module.exports = router;