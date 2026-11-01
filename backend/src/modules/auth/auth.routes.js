import { Router } from 'express';
import {
  register,
  login,
  adminRegister,
  adminLogin,
  logout,
  refresh,
  me,
  otpSend,
  otpVerify,
  googleAuth,
} from './auth.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { env } from '../../config/env.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Tighter rate limit for auth endpoints (relaxed in development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 100 : 20,
  message: { success: false, message: 'Too many requests. Try again later.' },
});

// SMS send rate limit
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 100 : 5,
  message: { success: false, message: 'Too many OTP requests. Try again in 10 minutes.' },
});

// Verification rate limit (separate from send)
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 200 : 20,
  message: { success: false, message: 'Too many verification attempts. Try again in 10 minutes.' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/admin/register', authLimiter, adminRegister);
router.post('/admin/login', authLimiter, adminLogin);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', protect, me);

// OTP routes
router.post('/otp/send', otpSendLimiter, otpSend);
router.post('/otp/verify', otpVerifyLimiter, otpVerify);

// Google OAuth route
router.post('/google', googleAuth);

export default router;