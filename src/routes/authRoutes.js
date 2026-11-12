const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/auth');

// Public Auth Endpoints
router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);
router.post('/otp/resend', authController.resendOtp);
router.post('/refresh', authController.refreshToken);

// Protected Auth Endpoints
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
