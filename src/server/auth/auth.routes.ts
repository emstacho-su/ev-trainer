/**
 * Overview: Authentication route definitions.
 * Interacts with: Auth controller for handlers, auth middleware for protection.
 * Importance: Maps HTTP endpoints to authentication functions.
 */

import { Router } from 'express';
import { register, login, logout, refresh, me } from './auth.controller';
import {
  sendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from './verification.controller';
import { requireAuth } from './auth.middleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);

// Email verification
router.post('/verify-email', verifyEmail);
router.post('/send-verification', requireAuth, sendVerification);

// Password reset
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', requireAuth, me);

export default router;
