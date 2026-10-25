const express = require('express');
const authController = require('../controllers/authController');
const { validateBody } = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  sendOtpSchema,
  verifyPhoneSchema,
} = require('../validation/auth');

const router = express.Router();

router.post('/register', validateBody(registerSchema), authController.register);
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);
router.post('/logout', optionalAuth, validateBody(logoutSchema), authController.logout);
router.post('/send-otp', optionalAuth, validateBody(sendOtpSchema), authController.sendOtp);
router.post('/verify-phone', optionalAuth, validateBody(verifyPhoneSchema), authController.verifyPhone);
router.get('/me', requireAuth, authController.getMe);

module.exports = router;
