// src/__tests__/supabase/sessionService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTrainingSession,
  getTrainingSession,
  updateTrainingSession,
  addSessionEntry,
  getSessionEntries,
  getSessionWithEntries,
  deleteTrainingSession,
  flagEntry,
  type CreateTrainingSessionParams,
  type AddSessionEntryParams,
} from '@/lib/supabase/sessionService';

/**
 * Mock Supabase client builder — simulates the PostgREST chainable query API.
 * Each call returns a chainable object ending with data/error.
 */
function createMockSupabase(responses: Record<string, { data: unknown; error: unknown; count?: number }>) {
  const from = vi.fn((table: string) => {
    const resp = responses[table] ?? { data: null, error: null };

    const chain: Record<string, any> = {};
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'gte', 'lte', 'order', 'range', 'limit'];

    for (const method of methods) {
      chain[method] = vi.fn(() => chain);
    }

    // Terminal methods resolve to the response
    chain.maybeSingle = vi.fn(() => Promise.resolve(resp));
    chain.single = vi.fn(() => Promise.resolve(resp));

    // Make the chain itself thenable (for queries that are awaited directly)
    chain.then = (resolve: Function, reject?: Function) => Promise.resolve(resp).then(resolve, reject);

    return chain;
  });

  return { from } as any;
}

const TEST_SESSION: CreateTrainingSessionParams = {
  user_id: 'user-123',
  session_id: 'session-abc',
  seed: 'seed-xyz',
  mode: 'preflop',
  filters: { positions: ['BTN', 'CO'] },
  decisions_per_session: 10,
};

const MOCK_SESSION_ROW = {
  id: 'uuid-1',
  user_id: 'user-123',
  session_id: 'session-abc',
  seed: 'seed-xyz',
  mode: 'preflop',
  filters: { positions: ['BTN', 'CO'] },
  decision_index: 0,
  decisions_per_session: 10,
  current_spot: null,
  is_complete: false,
  target_stack_bb: null,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

describe('sessionService', () => {
  describe('createTrainingSession', () => {
    it('returns existing session if duplicate (idempotent)', async () => {
      const supabase = createMockSupabase({
        training_sessions: { data: MOCK_SESSION_ROW, error: null },
      });

      const result = await createTrainingSession(supabase, TEST_SESSION);
      expect(result).toEqual(MOCK_SESSION_ROW);
      // Should not call insert since existing was found
      expect(supabase.from).toHaveBeenCalledWith('training_sessions');
    });

    it('inserts new session when none exists', async () => {
      // First call: maybeSingle returns null (no existing)
      // Second call: insert returns the new row
      let callCount = 0;
      const supabase = {
        from: vi.fn(() => {
          callCount++;
          const chain: any = {};
          const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'gte', 'lte', 'order', 'range', 'limit'];
          for (const m of methods) {
            chain[m] = vi.fn(() => chain);
          }
          chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
          chain.single = vi.fn(() => Promise.resolve({ data: MOCK_SESSION_ROW, error: null }));
          return chain;
        }),
      } as any;

      const result = await createTrainingSession(supabase, TEST_SESSION);
      expect(result).toEqual(MOCK_SESSION_ROW);
    });

    it('throws on supabase error', async () => {
      let callCount = 0;
      const supabase = {
        from: vi.fn(() => {
          callCount++;
          const chain: any = {};
          const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'range', 'limit'];
          for (const m of methods) {
            chain[m] = vi.fn(() => chain);
          }
          chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
          chain.single = vi.fn(() =>
            Promise.resolve({ data: null, error: { message: 'RLS violation' } })
          );
          return chain;
        }),
      } as any;

      await expect(createTrainingSession(supabase, TEST_SESSION)).rejects.toThrow(
        /Failed to create training session/
      );
    });
  });

  describe('getTrainingSession', () => {
    it('returns session when found', async () => {
      const supabase = createMockSupabase({
        training_sessions: { data: MOCK_SESSION_ROW, error: null },
      });

      const result = await getTrainingSession(supabase, 'session-abc', 'seed-xyz');
      expect(result).toEqual(MOCK_SESSION_ROW);
    });

    it('returns null when not found', async () => {
      const supabase = createMockSupabase({
        training_sessions: { data: null, error: null },
      });

      const result = await getTrainingSession(supabase, 'missing', 'seed');
      expect(result).toBeNull();
    });
  });

  describe('updateTrainingSession', () => {
    it('updates session fields and returns updated row', async () => {
      const updated = { ...MOCK_SESSION_ROW, decision_index: 5, is_complete: true };
      const supabase = createMockSupabase({
        training_sessions: { data: updated, error: null },
      });

      const result = await updateTrainingSession(supabase, 'uuid-1', {
        decision_index: 5,
        is_complete: true,
      });
      expect(result.decision_index).toBe(5);
      expect(result.is_complete).toBe(true);
    });
  });

  describe('addSessionEntry', () => {
    it('inserts entry and returns created row', async () => {
      const entryRow = {
        id: 'entry-1',
        session_id: 'uuid-1',
        index: 0,
        spot_id: 'spot-1',
        spot: { street: 'PREFLOP' },
        action_id: 'FOLD',
        result: { grade: 'CORRECT', evDiff: 0 },
        is_flagged: false,
        created_at: '2026-04-01T00:00:00Z',
      };

      const supabase = createMockSupabase({
        session_entries: { data: entryRow, error: null },
      });

      const params: AddSessionEntryParams = {
        session_id: 'uuid-1',
        index: 0,
        spot_id: 'spot-1',
        spot: { street: 'PREFLOP' },
        action_id: 'FOLD',
        result: { grade: 'CORRECT', evDiff: 0 },
      };

      const result = await addSessionEntry(supabase, params);
      expect(result.id).toBe('entry-1');
      expect(result.action_id).toBe('FOLD');
    });
  });

  describe('getSessionEntries', () => {
    it('returns sorted entries for session', async () => {
      const entries = [
        { id: 'e1', index: 0, spot_id: 's1', action_id: 'FOLD' },
        { id: 'e2', index: 1, spot_id: 's2', action_id: 'CALL' },
      ];
      const supabase = createMockSupabase({
        session_entries: { data: entries, error: null },
      });

      const result = await getSessionEntries(supabase, 'uuid-1');
      expect(result).toHaveLength(2);
      expect(result[0].index).toBe(0);
    });

    it('returns empty array when no entries', async () => {
      const supabase = createMockSupabase({
        session_entries: { data: [], error: null },
      });

      const result = await getSessionEntries(supabase, 'uuid-1');
      expect(result).toEqual([]);
    });
  });

  describe('deleteTrainingSession', () => {
    it('deletes session by id', async () => {
      const supabase = createMockSupabase({
        training_sessions: { data: null, error: null },
      });

      // Should not throw
      await expect(deleteTrainingSession(supabase, 'uuid-1')).resolves.toBeUndefined();
    });
  });

  describe('flagEntry', () => {
    it('toggles is_flagged and returns updated entry', async () => {
      const flaggedEntry = { id: 'e1', is_flagged: true };
      const supabase = createMockSupabase({
        session_entries: { data: flaggedEntry, error: null },
      });

      const result = await flagEntry(supabase, 'e1', true);
      expect(result.is_flagged).toBe(true);
    });
  });
});
