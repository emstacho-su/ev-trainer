import { AppError } from '../middleware/error.middleware';
import { GOOGLE_CONFIG, GITHUB_CONFIG } from './oauth.config';

// Google types
export interface GoogleTokens {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  picture?: string;
}

// GitHub types
export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
  email?: string;  // May be null if private
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

// Google OAuth
export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const response = await fetch(GOOGLE_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CONFIG.clientId,
      client_secret: GOOGLE_CONFIG.clientSecret,
      redirect_uri: GOOGLE_CONFIG.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google token exchange failed:', error);
    throw new AppError(400, 'OAUTH_FAILED', 'Failed to exchange Google authorization code');
  }

  return response.json();
}

export async function getGoogleUser(accessToken: string): Promise<GoogleUser> {
  const response = await fetch(GOOGLE_CONFIG.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new AppError(400, 'OAUTH_FAILED', 'Failed to get Google user info');
  }

  return response.json();
}

// GitHub OAuth
export async function exchangeGitHubCode(code: string): Promise<string> {
  const response = await fetch(GITHUB_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CONFIG.clientId,
      client_secret: GITHUB_CONFIG.clientSecret,
      code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error('GitHub token exchange failed:', data.error_description);
    throw new AppError(400, 'OAUTH_FAILED', data.error_description || 'Failed to exchange GitHub authorization code');
  }

  return data.access_token;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch(GITHUB_CONFIG.userUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new AppError(400, 'OAUTH_FAILED', 'Failed to get GitHub user info');
  }

  return response.json();
}

export async function getGitHubPrimaryEmail(accessToken: string): Promise<string> {
  const response = await fetch(GITHUB_CONFIG.emailsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new AppError(400, 'OAUTH_FAILED', 'Failed to get GitHub email');
  }

  const emails: GitHubEmail[] = await response.json();
  const primary = emails.find(e => e.primary && e.verified);

  if (!primary) {
    throw new AppError(400, 'OAUTH_FAILED', 'No verified primary email on GitHub account');
  }

  return primary.email;
}
