/**
 * Overview: Email verification and password reset controller.
 * Interacts with: Prisma for token storage, email service for sending emails.
 * Importance: Security-critical flows for email verification and password recovery.
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma/client';
import { AppError } from '../middleware/error.middleware';
import { hashPassword } from './auth.service';
import {
  createVerificationToken,
  createPasswordResetToken,
  hashToken,
} from './token.service';
import { sendVerificationEmail, sendPasswordResetEmail } from '../email/email.service';

// Validation schemas
const emailSchema = z.object({
  email: z.string().email().transform(e => e.toLowerCase()),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function sendVerification(req: Request, res: Response): Promise<void> {
  // Must be authenticated (we send to logged-in user's email)
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Must be logged in to request verification email');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { email: true, emailVerified: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (user.emailVerified) {
    throw new AppError(400, 'ALREADY_VERIFIED', 'Email is already verified');
  }

  // Delete any existing verification tokens for this user
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: user.email,
      type: 'email_verification',
    },
  });

  // Create new verification token
  const { token, tokenHash, expires } = createVerificationToken();

  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token: tokenHash,
      expires,
      type: 'email_verification',
    },
  });

  // Send email
  const result = await sendVerificationEmail(user.email, token);

  if (!result.success) {
    throw new AppError(500, 'EMAIL_FAILED', 'Failed to send verification email');
  }

  res.json({ success: true, message: 'Verification email sent' });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const result = verifyEmailSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', result.error.issues[0].message);
  }

  const { token } = result.data;
  const tokenHash = hashToken(token);

  // Find verification token
  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token: tokenHash,
      type: 'email_verification',
    },
  });

  if (!verificationToken) {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid verification token');
  }

  if (verificationToken.expires < new Date()) {
    // Clean up expired token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: verificationToken.identifier,
          token: tokenHash,
        },
      },
    });
    throw new AppError(400, 'TOKEN_EXPIRED', 'Verification token has expired');
  }

  // Mark email as verified and delete token (atomic transaction)
  await prisma.$transaction([
    prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: verificationToken.identifier,
          token: tokenHash,
        },
      },
    }),
  ]);

  res.json({ success: true, message: 'Email verified successfully' });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const result = emailSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', result.error.issues[0].message);
  }

  const { email } = result.data;

  // IMPORTANT: Always return same response to prevent email enumeration
  // Do the work in background but respond immediately
  const successResponse = {
    success: true,
    message: 'If this email exists, you will receive a password reset link',
  };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  // No user found - return success anyway (prevent enumeration)
  if (!user) {
    res.json(successResponse);
    return;
  }

  // OAuth-only users can't reset password
  if (!user.passwordHash) {
    res.json(successResponse);
    return;
  }

  // Delete any existing reset tokens for this user
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: user.email,
      type: 'password_reset',
    },
  });

  // Create new reset token
  const { token, tokenHash, expires } = createPasswordResetToken();

  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token: tokenHash,
      expires,
      type: 'password_reset',
    },
  });

  // Send email (don't await - respond immediately)
  sendPasswordResetEmail(user.email, token).catch(err => {
    console.error('Failed to send password reset email:', err);
  });

  res.json(successResponse);
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', result.error.issues[0].message);
  }

  const { token, password } = result.data;
  const tokenHash = hashToken(token);

  // Find reset token
  const resetToken = await prisma.verificationToken.findFirst({
    where: {
      token: tokenHash,
      type: 'password_reset',
    },
  });

  if (!resetToken) {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired reset token');
  }

  if (resetToken.expires < new Date()) {
    // Clean up expired token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: resetToken.identifier,
          token: tokenHash,
        },
      },
    });
    throw new AppError(400, 'TOKEN_EXPIRED', 'Reset token has expired');
  }

  // Hash new password
  const passwordHash = await hashPassword(password);

  // Update password and delete token (atomic transaction)
  // Also revoke all refresh tokens (force re-login on all devices)
  const user = await prisma.user.findUnique({
    where: { email: resetToken.identifier },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(400, 'INVALID_TOKEN', 'User not found');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    }),
    prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: resetToken.identifier,
          token: tokenHash,
        },
      },
    }),
  ]);

  res.json({ success: true, message: 'Password reset successfully' });
}
