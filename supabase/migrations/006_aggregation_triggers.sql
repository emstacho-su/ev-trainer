-- 006_aggregation_triggers.sql
-- Auto-aggregation triggers: upsert daily_stats and spot_stats on session_entries INSERT.

-- ============================================================================
-- Aggregate into daily_stats on each decision entry
-- ============================================================================
CREATE OR REPLACE FUNCTION public.aggregate_daily_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_is_correct BOOLEAN;
  v_ev_loss NUMERIC(10,4);
BEGIN
  -- Look up the session owner
  SELECT user_id INTO v_user_id
  FROM training_sessions
  WHERE id = NEW.session_id;

  -- Skip if guest session (no user_id)
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extract grading data from result JSONB
  v_is_correct := COALESCE((NEW.result->>'isCorrect')::BOOLEAN, false);
  v_ev_loss := COALESCE(ABS((NEW.result->>'evDiff')::NUMERIC), 0);

  INSERT INTO daily_stats (user_id, date, total_decisions, correct_decisions, avg_ev_loss)
  VALUES (
    v_user_id,
    CURRENT_DATE,
    1,
    CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    v_ev_loss
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_decisions = daily_stats.total_decisions + 1,
    correct_decisions = daily_stats.correct_decisions + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    -- Running average: ((old_avg * old_count) + new_value) / new_count
    avg_ev_loss = (
      (daily_stats.avg_ev_loss * daily_stats.total_decisions) + v_ev_loss
    ) / (daily_stats.total_decisions + 1);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_session_entry_aggregate_daily
  AFTER INSERT ON session_entries
  FOR EACH ROW EXECUTE FUNCTION public.aggregate_daily_stats();

-- ============================================================================
-- Aggregate into spot_stats on each decision entry
-- ============================================================================
CREATE OR REPLACE FUNCTION public.aggregate_spot_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_is_correct BOOLEAN;
  v_ev_loss NUMERIC(10,4);
  v_street TEXT;
  v_hero_position TEXT;
  v_villain_position TEXT;
BEGIN
  -- Look up session owner
  SELECT user_id INTO v_user_id
  FROM training_sessions
  WHERE id = NEW.session_id;

  -- Skip guest sessions
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extract grading and spot metadata from JSONB
  v_is_correct := COALESCE((NEW.result->>'isCorrect')::BOOLEAN, false);
  v_ev_loss := COALESCE(ABS((NEW.result->>'evDiff')::NUMERIC), 0);
  v_street := COALESCE(NEW.spot->>'street', 'PREFLOP');
  v_hero_position := COALESCE(NEW.spot->>'heroPosition', 'UTG');
  v_villain_position := NEW.spot->>'villainPosition';

  INSERT INTO spot_stats (user_id, spot_id, street, hero_position, villain_position,
                          total_decisions, correct_decisions, avg_ev_loss, last_practiced)
  VALUES (
    v_user_id,
    NEW.spot_id,
    v_street,
    v_hero_position,
    v_villain_position,
    1,
    CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    v_ev_loss,
    NOW()
  )
  ON CONFLICT (user_id, spot_id)
  DO UPDATE SET
    total_decisions = spot_stats.total_decisions + 1,
    correct_decisions = spot_stats.correct_decisions + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    avg_ev_loss = (
      (spot_stats.avg_ev_loss * spot_stats.total_decisions) + v_ev_loss
    ) / (spot_stats.total_decisions + 1),
    last_practiced = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_session_entry_aggregate_spot
  AFTER INSERT ON session_entries
  FOR EACH ROW EXECUTE FUNCTION public.aggregate_spot_stats();
