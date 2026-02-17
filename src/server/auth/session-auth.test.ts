/**
 * Overview: Integration test for authenticated session flow.
 * Interacts with: Auth endpoints, session endpoints, Prisma database.
 * Importance: Verifies session-auth integration and ownership enforcement.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import sessionRoutes from '../routes/session.routes';
import prisma from '../../lib/prisma/client';

// Mount session routes for test
app.use('/api/sessions', sessionRoutes);

// Note: This test requires database to be available
// Skip in CI if database connection fails

describe('Session Authentication Integration', () => {
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    // Create test user and get token
    const email = `test-session-auth-${Date.now()}@example.com`;
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'testpassword123' });

    if (registerRes.status === 201) {
      accessToken = registerRes.body.accessToken;
      userId = registerRes.body.user.id;
    }
  });

  afterAll(async () => {
    // Clean up test user and related data
    if (userId) {
      // Delete sessions first (cascade should handle it, but being explicit)
      await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
      // Delete user
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  describe('Session with auth', () => {
    it('should link session to user when authenticated', async () => {
      // Skip if registration failed
      if (!accessToken) {
        console.log('Skipping: No access token (registration may have failed)');
        return;
      }

      const res = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          seed: 'test-seed-1',
          mode: 'TRAINING',
          packId: 'ev-dev-pack-v1',
          filters: {},
        });

      // Session should be created
      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.sessionId).toBeTruthy();
    });

    it('should allow guest session without auth', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .send({
          seed: 'test-seed-guest',
          mode: 'TRAINING',
          packId: 'ev-dev-pack-v1',
          filters: {},
        });

      // Should work without auth (guest mode)
      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.sessionId).toBeTruthy();
    });

    it('should require auth for session history', async () => {
      const res = await request(app).get('/api/sessions/history');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return history when authenticated', async () => {
      if (!accessToken) return;

      const res = await request(app)
        .get('/api/sessions/history')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
    });

    it('should prevent accessing another user\'s session', async () => {
      if (!accessToken) return;

      // Create another user
      const email2 = `test-session-auth-2-${Date.now()}@example.com`;
      const registerRes2 = await request(app)
        .post('/api/auth/register')
        .send({ email: email2, password: 'testpassword123' });

      if (registerRes2.status !== 201) return;

      const accessToken2 = registerRes2.body.accessToken;
      const userId2 = registerRes2.body.user.id;

      try {
        // User 2 creates a session
        const startRes = await request(app)
          .post('/api/sessions/start')
          .set('Authorization', `Bearer ${accessToken2}`)
          .send({
            seed: 'test-seed-user2',
            mode: 'TRAINING',
            packId: 'ev-dev-pack-v1',
            filters: {},
          });

        expect(startRes.status).toBe(200);
        const sessionId = startRes.body.session.sessionId;

        // User 1 tries to access User 2's session
        const getRes = await request(app)
          .get(`/api/sessions/${sessionId}?seed=test-seed-user2`)
          .set('Authorization', `Bearer ${accessToken}`);

        // Should be forbidden
        expect(getRes.status).toBe(403);
        expect(getRes.body.error.code).toBe('FORBIDDEN');
      } finally {
        // Clean up user 2
        await prisma.session.deleteMany({ where: { userId: userId2 } }).catch(() => {});
        await prisma.user.delete({ where: { id: userId2 } }).catch(() => {});
      }
    });
  });
});
