export const GOOGLE_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/oauth/google/callback',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  scope: 'openid email profile',
};

export const GITHUB_CONFIG = {
  clientId: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:4000/api/oauth/github/callback',
  authUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userUrl: 'https://api.github.com/user',
  emailsUrl: 'https://api.github.com/user/emails',
  scope: 'read:user user:email',
};

export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
