export interface TokenPayload {
  sub: string;      // userId
  email: string;
  type: 'access';
}

export interface AuthUser {
  userId: string;
  email: string;
}

export interface RefreshTokenData {
  token: string;       // Raw token (for cookie)
  tokenHash: string;   // Hashed token (for DB)
  expiresAt: Date;
}
