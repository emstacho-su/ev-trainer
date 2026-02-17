-- 001_initial_schema.sql
-- Creates all tables for the EV Trainer application.
-- Tables are ordered for FK resolution: profiles -> spots -> training_sessions -> session_entries -> daily_stats -> spot_stats
-- RLS is enabled on EVERY table immediately after creation.

-- ============================================================================
-- 1. profiles -- Extends auth.users with app-specific data
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'FREE',
  trainer_preferences JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. spots -- Practice spot library (replaces bundled JSON packs)
-- ============================================================================
CREATE TABLE spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id TEXT NOT NULL UNIQUE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Spot data
  street TEXT NOT NULL,
  hero_position TEXT NOT NULL,
  villain_position TEXT,
  board TEXT[] NOT NULL DEFAULT '{}',
  hero_to_act TEXT NOT NULL,
  positions TEXT[] NOT NULL,
  stacks_bb JSONB NOT NULL,
  pot_bb NUMERIC(10,2) NOT NULL,
  history TEXT[] NOT NULL DEFAULT '{}',
  hero_hand TEXT[],

  -- Metadata
  pot_type TEXT NOT NULL,
  effective_stack_bb NUMERIC(10,2) NOT NULL,
  scenario_type TEXT,
  difficulty_rating NUMERIC(4,2),
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- Sharing
  share_code TEXT UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE spots ENABLE ROW LEVEL SECURITY;

-- Indexes for spots
CREATE INDEX idx_spots_system ON spots (is_system) WHERE is_system = true;
CREATE INDEX idx_spots_created_by ON spots (created_by);
CREATE INDEX idx_spots_tags ON spots USING GIN (tags);
CREATE INDEX idx_spots_street ON spots (street);
CREATE INDEX idx_spots_hero_position ON spots (hero_position);
CREATE INDEX idx_spots_pot_type ON spots (pot_type);

-- ============================================================================
-- 3. training_sessions -- Training/practice sessions
-- ============================================================================
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  seed TEXT NOT NULL,
  mode TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  decision_index INT NOT NULL DEFAULT 0,
  decisions_per_session INT NOT NULL DEFAULT 10,
  current_spot JSONB,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  target_stack_bb NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(session_id, seed)
);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

-- Enable replica identity FULL for Realtime cross-tab/cross-device sync
ALTER TABLE training_sessions REPLICA IDENTITY FULL;

-- Indexes for training_sessions
CREATE INDEX idx_sessions_user_created ON training_sessions (user_id, created_at);

-- ============================================================================
-- 4. session_entries -- Individual decisions within sessions
-- ============================================================================
CREATE TABLE session_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  index INT NOT NULL,
  spot_id TEXT NOT NULL,
  spot JSONB NOT NULL,
  action_id TEXT NOT NULL,
  result JSONB,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(session_id, index)
);

ALTER TABLE session_entries ENABLE ROW LEVEL SECURITY;

-- Indexes for session_entries
CREATE INDEX idx_entries_session ON session_entries (session_id, index);
CREATE INDEX idx_entries_flagged ON session_entries (session_id, is_flagged) WHERE is_flagged = true;

-- ============================================================================
-- 5. daily_stats -- Pre-aggregated daily performance
-- ============================================================================
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_decisions INT NOT NULL DEFAULT 0,
  correct_decisions INT NOT NULL DEFAULT 0,
  avg_ev_loss NUMERIC(10,4) NOT NULL DEFAULT 0,
  sessions_completed INT NOT NULL DEFAULT 0,

  UNIQUE(user_id, date)
);

ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- Indexes for daily_stats
CREATE INDEX idx_daily_stats_user_date ON daily_stats (user_id, date);

-- ============================================================================
-- 6. spot_stats -- Per-spot performance tracking
-- ============================================================================
CREATE TABLE spot_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id TEXT NOT NULL,
  street TEXT NOT NULL,
  hero_position TEXT NOT NULL,
  villain_position TEXT,
  total_decisions INT NOT NULL DEFAULT 0,
  correct_decisions INT NOT NULL DEFAULT 0,
  avg_ev_loss NUMERIC(10,4) NOT NULL DEFAULT 0,
  last_practiced TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, spot_id)
);

ALTER TABLE spot_stats ENABLE ROW LEVEL SECURITY;

-- Indexes for spot_stats
CREATE INDEX idx_spot_stats_user ON spot_stats (user_id, spot_id);
CREATE INDEX idx_spot_stats_user_position ON spot_stats (user_id, hero_position);
CREATE INDEX idx_spot_stats_user_last ON spot_stats (user_id, last_practiced);
