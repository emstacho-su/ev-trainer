import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './auth.service';

describe('auth.service', () => {
  describe('hashPassword', () => {
    it('should return a hash different from input', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash).toContain('$argon2id$');
    });

    it('should produce different hashes for same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      const result = await verifyPassword(hash, password);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      const result = await verifyPassword(hash, 'wrongPassword');
      expect(result).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const result = await verifyPassword('invalid-hash', 'password');
      expect(result).toBe(false);
    });
  });
});
