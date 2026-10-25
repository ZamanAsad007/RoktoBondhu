const { z } = require('zod');

const phoneRegex = /^\+?[0-9]{8,18}$/;

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone number format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['USER', 'ADMIN', 'ORG']).optional().default('USER'),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or phone is required').optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine((data) => data.identifier || data.email, {
  message: 'Either email or identifier is required',
  path: ['identifier'],
});

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token is required'),
});

const logoutSchema = z.object({
  refreshToken: z.string().trim().optional(),
});

const sendOtpSchema = z.object({
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone number format').optional(),
});

const verifyPhoneSchema = z.object({
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone number format').optional(),
  otp: z.string().trim().min(4, 'OTP must be at least 4 digits').max(8),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  sendOtpSchema,
  verifyPhoneSchema,
};
