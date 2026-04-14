// src/__tests__/supabase/statsService.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  getDailyStats,
  getOverviewStats,
  getPositionStats,
  getWeaknessBreakdown,
  upsertDailyStats,
  upsertSpotStats,
  getDrillSuggestions,
} from '@/lib/supabase/statsService';

/**
 * Chainable Supabase mock with configurable responses per table.
 */
function createMockSupabase(responses: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: vi.fn((table: string) => {
      const resp = responses[table] ?? { data: null, error: null };
      const chain: any = {};
      const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'gte', 'lte', 'order', 'range', 'limit'];
      for (const m of methods) {
        chain[m] = vi.fn(() => chain);
      }
      chain.maybeSingle = vi.fn(() => Promise.resolve(resp));
      chain.single = vi.fn(() => Promise.resolve(resp));
      // Default: return the chain as a resolved promise (for queries without terminal method)
      chain.then = (resolve: Function) => resolve(resp);
      return chain;
    }),
  } as any;
}

describe('statsService', () => {
  describe('getDailyStats', () => {
    it('transforms daily_stats rows into PerformanceDataPoint format', async () => {
      const rows = [
        {
          date: '2026-04-01',
          total_decisions: 20,
          correct_decisions: 15,
          avg_ev_loss: 0.5,
          sessions_completed: 2,
        },
        {
          date: '2026-04-02',
          total_decisions: 10,
          correct_decisions: 8,
          avg_ev_loss: 0.3,
          sessions_completed: 1,
        },
      ];

      const supabase = createMockSupabase({
        daily_stats: { data: rows, error: null },
      });

      const result = await getDailyStats(supabase, 'user-1');
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-04-01');
      expect(result[0].hands).toBe(20);
      expect(result[0].accuracy).toBe(75); // 15/20 * 100
      expect(result[0].avgEVLoss).toBe(0.5);
    });

    it('handles empty data gracefully', async () => {
      const supabase = createMockSupabase({
        daily_stats: { data: [], error: null },
      });

      const result = await getDailyStats(supabase, 'user-1');
      expect(result).toEqual([]);
    });

    it('throws on query error', async () => {
      const supabase = createMockSupabase({
        daily_stats: { data: null, error: { message: 'Network error' } },
      });

      await expect(getDailyStats(supabase, 'user-1')).rejects.toThrow(/Failed to fetch daily stats/);
    });
  });

  describe('getOverviewStats', () => {
    it('computes lifetime totals from daily_stats', async () => {
      const rows = [
        { date: '2026-03-01', total_decisions: 50, correct_decisions: 40, avg_ev_loss: 0.4, sessions_completed: 5 },
        { date: '2026-04-01', total_decisions: 30, correct_decisions: 20, avg_ev_loss: 0.6, sessions_completed: 3 },
      ];

      const supabase = createMockSupabase({
        daily_stats: { data: rows, error: null },
      });

      const result = await getOverviewStats(supabase, 'user-1');
      expect(result.totalDecisions).toBe(80);
      expect(result.sessionsCompleted).toBe(8);
      // accuracy: (60/80)*100 = 75
      expect(result.accuracy).toBe(75);
    });

    it('returns zero stats for empty data', async () => {
      const supabase = createMockSupabase({
        daily_stats: { data: [], error: null },
      });

      const result = await getOverviewStats(supabase, 'user-1');
      expect(result.totalDecisions).toBe(0);
      expect(result.accuracy).toBe(0);
      expect(result.avgEvLoss).toBe(0);
    });
  });

  describe('getPositionStats', () => {
    it('groups by hero + villain position', async () => {
      const rows = [
        { hero_position: 'BTN', villain_position: 'BB', total_decisions: 10, correct_decisions: 8, avg_ev_loss: 0.3, last_practiced: '2026-04-01' },
        { hero_position: 'BTN', villain_position: 'BB', total_decisions: 5, correct_decisions: 3, avg_ev_loss: 0.5, last_practiced: '2026-04-02' },
        { hero_position: 'CO', villain_position: 'BTN', total_decisions: 7, correct_decisions: 5, avg_ev_loss: 0.4, last_practiced: '2026-04-01' },
      ];

      const supabase = createMockSupabase({
        spot_stats: { data: rows, error: null },
      });

      const result = await getPositionStats(supabase, 'user-1');
      expect(result).toHaveLength(2); // BTN vs BB grouped, CO vs BTN separate
      const btnVsBb = result.find(r => r.heroPosition === 'BTN');
      expect(btnVsBb!.hands).toBe(15); // 10 + 5
    });
  });

  describe('getWeaknessBreakdown', () => {
    it('returns spots sorted by worst EV loss', async () => {
      const rows = [
        { spot_id: 's1', hero_position: 'UTG', villain_position: 'BB', street: 'PREFLOP', avg_ev_loss: 2.5, total_decisions: 15 },
        { spot_id: 's2', hero_position: 'BTN', villain_position: 'SB', street: 'FLOP', avg_ev_loss: 1.8, total_decisions: 12 },
      ];

      const supabase = createMockSupabase({
        spot_stats: { data: rows, error: null },
      });

      const result = await getWeaknessBreakdown(supabase, 'user-1');
      expect(result).toHaveLength(2);
      expect(result[0].spotId).toBe('s1');
      expect(result[0].avgEvLoss).toBe(2.5);
    });
  });

  describe('upsertDailyStats', () => {
    it('inserts new row when no existing stats for date', async () => {
      const supabase = createMockSupabase({
        daily_stats: { data: null, error: null },
      });

      await expect(
        upsertDailyStats(supabase, 'user-1', '2026-04-08', {
          totalDecisions: 10,
          correctDecisions: 8,
          avgEvLoss: 0.35,
          sessionsCompleted: 1,
        })
      ).resolves.toBeUndefined();
    });

    it('increments existing row on conflict', async () => {
      const existing = {
        id: 'ds-1',
        total_decisions: 20,
        correct_decisions: 15,
        avg_ev_loss: 0.4,
        sessions_completed: 2,
      };

      // First call returns existing (maybeSingle), second call updates
      let callCount = 0;
      const supabase = {
        from: vi.fn(() => {
          callCount++;
          const chain: any = {};
          const methods = ['select', 'insert', 'update', 'delete', 'eq', 'gte', 'lte', 'order', 'range', 'limit'];
          for (const m of methods) {
            chain[m] = vi.fn(() => chain);
          }
          if (callCount === 1) {
            chain.maybeSingle = vi.fn(() => Promise.resolve({ data: existing, error: null }));
          } else {
            chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
          }
          chain.then = (resolve: Function) => resolve({ data: null, error: null });
          return chain;
        }),
      } as any;

      await expect(
        upsertDailyStats(supabase, 'user-1', '2026-04-08', {
          totalDecisions: 10,
          correctDecisions: 7,
          avgEvLoss: 0.5,
          sessionsCompleted: 1,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('upsertSpotStats', () => {
    it('inserts new spot stats for first practice', async () => {
      const supabase = createMockSupabase({
        spot_stats: { data: null, error: null },
      });

      await expect(
        upsertSpotStats(supabase, 'user-1', {
          spotId: 'spot-btn-vs-bb-srp',
          street: 'PREFLOP',
          heroPosition: 'BTN',
          villainPosition: 'BB',
          isCorrect: true,
          evLoss: 0,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('getDrillSuggestions', () => {
    it('returns top 5 worst-performing spots', async () => {
      const rows = [
        { spot_id: 's1', hero_position: 'UTG', villain_position: 'BB', total_decisions: 20, correct_decisions: 10, avg_ev_loss: 2.0 },
        { spot_id: 's2', hero_position: 'BTN', villain_position: null, total_decisions: 15, correct_decisions: 12, avg_ev_loss: 0.8 },
      ];

      const supabase = createMockSupabase({
        spot_stats: { data: rows, error: null },
      });

      const result = await getDrillSuggestions(supabase, 'user-1');
      expect(result).toHaveLength(2);
      expect(result[0].spotLabel).toBe('UTG vs BB');
      expect(result[1].spotLabel).toBe('BTN');
    });
  });
});
