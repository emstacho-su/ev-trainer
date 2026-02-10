import { Resend } from 'resend';
import { verificationEmailHtml, passwordResetEmailHtml } from './email.templates';

// Initialize Resend client
// In development without API key, emails will be logged instead of sent
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || 'EV Trainer <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendVerificationEmail(to: string, token: string): Promise<EmailResult> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  if (!resend) {
    // Development mode - log instead of send
    console.log(`[EMAIL DEV] Verification email to ${to}`);
    console.log(`[EMAIL DEV] Verify URL: ${verifyUrl}`);
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Verify your email address',
      html: verificationEmailHtml(verifyUrl),
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<EmailResult> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  if (!resend) {
    // Development mode - log instead of send
    console.log(`[EMAIL DEV] Password reset email to ${to}`);
    console.log(`[EMAIL DEV] Reset URL: ${resetUrl}`);
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Reset your password',
      html: passwordResetEmailHtml(resetUrl),
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}
