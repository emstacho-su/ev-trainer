/**
 * Overview: Authentication controller handling register, login, logout, refresh, me endpoints.
 * Interacts with: Prisma for user and token storage, auth services for hashing and JWT.
 * Importance: Core authentication flows with refresh token rotation and security best practices.
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma/client';
import { AppError } from '../middleware/error.middleware';
import { hashPassword, verifyPassword } from './auth.service';
import {
  createAccessToken,
  createRefreshToken,
  createVerificationToken,
  hashToken,
} from './token.service';
import { sendVerificationEmail } from '../email/email.service';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email().transform(e => e.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email().transform(e => e.toLowerCase()),
  password: z.string().min(1),
});

// Cookie options for refresh token
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export async function register(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', result.error.issues[0].message);
  }

  const { email, password } = result.data;

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Same response as success to prevent email enumeration
    // But actually throw - in production, consider returning same response
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  }

  // Create user
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
    select: { id: true, email: true, emailVerified: true, subscriptionTier: true },
  });

  // Create verification token and send email (don't block registration on email send)
  const { token: verifyToken, tokenHash: verifyHash, expires: verifyExpires } = createVerificationToken();

  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token: verifyHash,
      expires: verifyExpires,
      type: 'email_verification',
    },
  });

  // Send verification email in background (don't wait)
  sendVerificationEmail(user.email, verifyToken).catch(err => {
    console.error('Failed to send verification email:', err);
  });

  // Generate tokens
  const accessToken = await createAccessToken(user.id, user.email);
  const { token: refreshToken, tokenHash, expiresAt } = createRefreshToken();

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  // Set refresh token cookie
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified !== null,
      subscriptionTier: user.subscriptionTier,
    },
    accessToken,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', result.error.issues[0].message);
  }

  const { email, password } = result.data;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, emailVerified: true, subscriptionTier: true },
  });

  // Generic error for both "no user" and "wrong password" to prevent enumeration
  if (!user || !user.passwordHash) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Generate tokens
  const accessToken = await createAccessToken(user.id, user.email);
  const { token: refreshToken, tokenHash, expiresAt } = createRefreshToken();

  // Store refresh token (allow multiple devices)
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  // Set refresh token cookie
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified !== null,
      subscriptionTier: user.subscriptionTier,
    },
    accessToken,
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    // Delete the specific refresh token (logout this device only)
    await prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  }

  // Clear cookie
  res.clearCookie('refreshToken', { path: '/api/auth' });

  res.json({ success: true });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new AppError(401, 'NO_REFRESH_TOKEN', 'No refresh token provided');
  }

  const tokenHash = hashToken(refreshToken);

  // Find and validate refresh token
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, emailVerified: true, subscriptionTier: true } } },
  });

  if (!storedToken) {
    // Token not found - could be stolen and already used
    res.clearCookie('refreshToken', { path: '/api/auth' });
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  if (storedToken.expiresAt < new Date()) {
    // Token expired - clean up and reject
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    res.clearCookie('refreshToken', { path: '/api/auth' });
    throw new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
  }

  // Rotate refresh token (delete old, create new)
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const { token: newRefreshToken, tokenHash: newTokenHash, expiresAt } = createRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: storedToken.user.id,
      tokenHash: newTokenHash,
      expiresAt,
    },
  });

  // Generate new access token
  const accessToken = await createAccessToken(storedToken.user.id, storedToken.user.email);

  // Set new refresh token cookie
  res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

  res.json({
    user: {
      id: storedToken.user.id,
      email: storedToken.user.email,
      emailVerified: storedToken.user.emailVerified !== null,
      subscriptionTier: storedToken.user.subscriptionTier,
    },
    accessToken,
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  // req.user is set by requireAuth middleware
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, email: true, emailVerified: true, subscriptionTier: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified !== null,
      subscriptionTier: user.subscriptionTier,
    },
  });
}
