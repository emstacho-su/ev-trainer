import { describe, it, expect } from 'vitest';
import {
  createAccessToken,
  verifyAccessToken,
  hashToken,
  createRefreshToken,
  createVerificationToken,
  createPasswordResetToken,
} from './token.service';

describe('token.service', () => {
  describe('createAccessToken / verifyAccessToken', () => {
    it('should create and verify a valid token', async () => {
      const token = await createAccessToken('user-123', 'test@example.com');
      const payload = await verifyAccessToken(token);
      expect(payload.sub).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
      expect(payload.type).toBe('access');
    });

    it('should reject tampered token', async () => {
      const token = await createAccessToken('user-123', 'test@example.com');
      const tampered = token.slice(0, -5) + 'xxxxx';
      await expect(verifyAccessToken(tampered)).rejects.toThrow();
    });
  });

  describe('hashToken', () => {
    it('should return consistent hash for same input', () => {
      const token = 'test-token-123';
      expect(hashToken(token)).toBe(hashToken(token));
    });

    it('should return different hash for different input', () => {
      expect(hashToken('token1')).not.toBe(hashToken('token2'));
    });
  });

  describe('createRefreshToken', () => {
    it('should return token, hash, and expiry', () => {
      const { token, tokenHash, expiresAt } = createRefreshToken();
      expect(token).toHaveLength(64);
      expect(tokenHash).toHaveLength(64);
      expect(token).not.toBe(tokenHash);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate unique tokens each time', () => {
      const r1 = createRefreshToken();
      const r2 = createRefreshToken();
      expect(r1.token).not.toBe(r2.token);
    });
  });

  describe('createVerificationToken', () => {
    it('should return token with 24h expiry', () => {
      const { token, tokenHash, expires } = createVerificationToken();
      expect(token).toHaveLength(64);
      expect(tokenHash).toHaveLength(64);
      const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000;
      expect(expires.getTime()).toBeCloseTo(expectedExpiry, -3);
    });
  });

  describe('createPasswordResetToken', () => {
    it('should return token with 1h expiry', () => {
      const { token, tokenHash, expires } = createPasswordResetToken();
      expect(token).toHaveLength(64);
      expect(tokenHash).toHaveLength(64);
      const expectedExpiry = Date.now() + 60 * 60 * 1000;
      expect(expires.getTime()).toBeCloseTo(expectedExpiry, -3);
    });
  });
});
