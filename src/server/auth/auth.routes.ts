/**
 * Overview: Authentication route definitions.
 * Interacts with: Auth controller for handlers, auth middleware for protection.
 * Importance: Maps HTTP endpoints to authentication functions.
 */

import { Router } from 'express';
import { register, login, logout, refresh, me } from './auth.controller';
import { requireAuth } from './auth.middleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);

// Protected routes
router.get('/me', requireAuth, me);

export default router;
