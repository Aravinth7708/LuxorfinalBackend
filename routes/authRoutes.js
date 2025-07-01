const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Login route
if (authController.login) {
  router.post('/login', authController.login);
}

// Register route
if (authController.register) {
  router.post('/register', authController.register);
}

// Google auth route
if (authController.handleGoogleAuth) {
  router.post('/google-auth', authController.handleGoogleAuth);
}

// These routes might not have implementations - only add if they exist
if (authController.forgotPassword) {
  router.post('/forgot-password', authController.forgotPassword);
}

if (authController.resetPassword) {
  router.post('/reset-password', authController.resetPassword);
}

// Export router
module.exports = router;
