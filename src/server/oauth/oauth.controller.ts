import type { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../lib/prisma/client';
import { AppError } from '../middleware/error.middleware';
import { createAccessToken, createRefreshToken } from '../auth/token.service';
import {
  GOOGLE_CONFIG,
  GITHUB_CONFIG,
  FRONTEND_URL,
} from './oauth.config';
import {
  exchangeGoogleCode,
  getGoogleUser,
  exchangeGitHubCode,
  getGitHubUser,
  getGitHubPrimaryEmail,
} from './oauth.service';

// Cookie options for OAuth state (CSRF protection)
const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 10 * 60 * 1000, // 10 minutes
  path: '/',
};

// Cookie options for refresh token (same as auth.controller)
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Helper to handle OAuth user creation/linking
async function handleOAuthUser(
  email: string,
  provider: string,
  providerId: string
): Promise<{ id: string; email: string; isNew: boolean }> {
  // First, check if user exists with this OAuth provider
  const existingOAuth = await prisma.user.findFirst({
    where: {
      oauthProvider: provider,
      oauthProviderId: providerId,
    },
    select: { id: true, email: true },
  });

  if (existingOAuth) {
    return { ...existingOAuth, isNew: false };
  }

  // Check if user exists with this email (link accounts)
  const existingEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, oauthProvider: true },
  });

  if (existingEmail) {
    // Link OAuth to existing account (only if no other OAuth is linked)
    if (!existingEmail.oauthProvider) {
      await prisma.user.update({
        where: { id: existingEmail.id },
        data: {
          oauthProvider: provider,
          oauthProviderId: providerId,
          emailVerified: new Date(), // OAuth providers verify email
        },
      });
    }
    return { ...existingEmail, isNew: false };
  }

  // Create new user
  const newUser = await prisma.user.create({
    data: {
      email,
      oauthProvider: provider,
      oauthProviderId: providerId,
      emailVerified: new Date(), // OAuth providers verify email
    },
    select: { id: true, email: true },
  });

  return { ...newUser, isNew: true };
}

// Helper to complete OAuth flow (issue tokens, redirect)
async function completeOAuthFlow(
  res: Response,
  userId: string,
  email: string,
  isNew: boolean
): Promise<void> {
  // Generate tokens
  const accessToken = await createAccessToken(userId, email);
  const { token: refreshToken, tokenHash, expiresAt } = createRefreshToken();

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  // Set refresh token cookie
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  // Redirect to frontend with access token in URL fragment
  // Fragment (#) is not sent to server, safer than query params
  const redirectUrl = new URL('/auth/callback', FRONTEND_URL);
  redirectUrl.hash = `access_token=${accessToken}&is_new=${isNew}`;

  res.redirect(redirectUrl.toString());
}

// Google OAuth
export function initiateGoogle(req: Request, res: Response): void {
  if (!GOOGLE_CONFIG.clientId) {
    throw new AppError(503, 'OAUTH_NOT_CONFIGURED', 'Google OAuth is not configured');
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, STATE_COOKIE_OPTIONS);

  const params = new URLSearchParams({
    client_id: GOOGLE_CONFIG.clientId,
    redirect_uri: GOOGLE_CONFIG.redirectUri,
    response_type: 'code',
    scope: GOOGLE_CONFIG.scope,
    state,
    access_type: 'offline', // Get refresh token from Google
    prompt: 'consent',
  });

  res.redirect(`${GOOGLE_CONFIG.authUrl}?${params}`);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query;

  // Handle user denied access
  if (error) {
    res.redirect(`${FRONTEND_URL}/auth/error?error=${error}`);
    return;
  }

  // Validate state (CSRF protection)
  const storedState = req.cookies.oauth_state;
  res.clearCookie('oauth_state', { path: '/' });

  if (!state || state !== storedState) {
    res.redirect(`${FRONTEND_URL}/auth/error?error=csrf_failed`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.redirect(`${FRONTEND_URL}/auth/error?error=no_code`);
    return;
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeGoogleCode(code);

    // Get user info
    const googleUser = await getGoogleUser(tokens.access_token);

    if (!googleUser.verified_email) {
      res.redirect(`${FRONTEND_URL}/auth/error?error=email_not_verified`);
      return;
    }

    // Create or link user
    const user = await handleOAuthUser(
      googleUser.email.toLowerCase(),
      'google',
      googleUser.id
    );

    // Complete flow
    await completeOAuthFlow(res, user.id, user.email, user.isNew);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${FRONTEND_URL}/auth/error?error=oauth_failed`);
  }
}

// GitHub OAuth
export function initiateGitHub(req: Request, res: Response): void {
  if (!GITHUB_CONFIG.clientId) {
    throw new AppError(503, 'OAUTH_NOT_CONFIGURED', 'GitHub OAuth is not configured');
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, STATE_COOKIE_OPTIONS);

  const params = new URLSearchParams({
    client_id: GITHUB_CONFIG.clientId,
    redirect_uri: GITHUB_CONFIG.redirectUri,
    scope: GITHUB_CONFIG.scope,
    state,
  });

  res.redirect(`${GITHUB_CONFIG.authUrl}?${params}`);
}

export async function githubCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query;

  // Handle user denied access
  if (error) {
    res.redirect(`${FRONTEND_URL}/auth/error?error=${error}`);
    return;
  }

  // Validate state (CSRF protection)
  const storedState = req.cookies.oauth_state;
  res.clearCookie('oauth_state', { path: '/' });

  if (!state || state !== storedState) {
    res.redirect(`${FRONTEND_URL}/auth/error?error=csrf_failed`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.redirect(`${FRONTEND_URL}/auth/error?error=no_code`);
    return;
  }

  try {
    // Exchange code for access token
    const accessToken = await exchangeGitHubCode(code);

    // Get user info and email
    const [githubUser, email] = await Promise.all([
      getGitHubUser(accessToken),
      getGitHubPrimaryEmail(accessToken),
    ]);

    // Create or link user
    const user = await handleOAuthUser(
      email.toLowerCase(),
      'github',
      githubUser.id.toString()
    );

    // Complete flow
    await completeOAuthFlow(res, user.id, user.email, user.isNew);
  } catch (err) {
    console.error('GitHub OAuth error:', err);
    res.redirect(`${FRONTEND_URL}/auth/error?error=oauth_failed`);
  }
}
