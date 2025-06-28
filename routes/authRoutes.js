const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Existing route
router.get('/verify', authController.verifyToken);

// New OTP routes
router.post('/send-registration-otp', authController.sendRegistrationOTP);
router.post('/send-login-otp', authController.sendLoginOTP);
router.post('/verify-register', authController.verifyAndRegister);
router.post('/verify-login', authController.verifyAndLogin);

module.exports = router;
