const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middlewares/auth');
const dispatchController = require('../controllers/dispatchController');

// SCREEN 12 - API 2
// Generate Agora Call Token
router.post(
    '/:bookingId/agora/token',
    authenticateToken,
    dispatchController.generateAgoraToken
);
// SCREEN 12 - API 3
// Fetch Chat Message History
router.get(
    '/:bookingId/chat/messages',
    authenticateToken,
    dispatchController.getChatMessages
);

module.exports = router;