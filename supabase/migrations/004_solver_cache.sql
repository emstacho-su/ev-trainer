-- 004_solver_cache.sql
-- Solver output cache table for storing solved postflop results.
-- Two-tier caching: IndexedDB (client) + this table (server/cross-device).

-- ============================================================================
-- solver_cache -- Keyed by canonical hash of game state
-- ============================================================================
CREATE TABLE solver_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_hash TEXT UNIQUE NOT NULL,
  street TEXT NOT NULL,
  board TEXT[] NOT NULL DEFAULT '{}',
  pot_bb NUMERIC(10,2) NOT NULL,
  effective_stack_bb NUMERIC(10,2) NOT NULL,
  bet_tree_config JSONB,
  solver_output JSONB NOT NULL,
  iterations INT,
  exploitability NUMERIC(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE solver_cache ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_solver_cache_hash ON solver_cache (canonical_hash);
CREATE INDEX idx_solver_cache_street ON solver_cache (street);

-- RLS: All authenticated users can read cache; only service role can write.
-- Cache is shared across users (same game state = same solution).
CREATE POLICY "Anyone can read solver cache"
  ON solver_cache FOR SELECT
  TO authenticated
  USING (true);
