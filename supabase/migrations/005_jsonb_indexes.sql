-- 005_jsonb_indexes.sql
-- GIN indexes on frequently queried JSONB columns for performance.

-- session_entries.result contains grade, EV, action data queried in stats
CREATE INDEX idx_session_entries_result ON session_entries USING GIN (result);

-- training_sessions.filters contains position/pot type filters for analytics
CREATE INDEX idx_session_entries_filters ON training_sessions USING GIN (filters);

-- Composite index for action lookups within sessions
CREATE INDEX idx_session_entries_action ON session_entries (session_id, action_id);
