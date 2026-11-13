const express = require('express');
const router = express.Router();

const shareLinkController = require('../controllers/shareLinkController');
const { authenticateToken } = require('../middlewares/auth');

router.post(
  '/trips/:bookingId/share-link',
  authenticateToken,
  shareLinkController.generateConsigneeShareLink
);

module.exports = router;