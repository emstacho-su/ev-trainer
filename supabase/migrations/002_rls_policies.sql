-- 002_rls_policies.sql
-- Row Level Security policies for all tables.
-- Uses (SELECT auth.uid()) everywhere for query planner caching (99.99% perf improvement).

-- ============================================================================
-- profiles policies
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

-- Users can update their own profile
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Users can insert their own profile (needed for trigger/manual creation)
CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

-- ============================================================================
-- spots policies
-- ============================================================================

-- Anyone can read system spots (no auth required)
CREATE POLICY "Read system spots" ON spots
  FOR SELECT
  USING (is_system = true);

-- Authenticated users can read their own spots
CREATE POLICY "Read own spots" ON spots
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Anyone can read shared spots (via share_code)
CREATE POLICY "Read shared spots" ON spots
  FOR SELECT
  USING (share_code IS NOT NULL);

-- Authenticated non-anonymous users can insert their own spots
CREATE POLICY "Insert own spots" ON spots
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND is_system = false
    AND ((SELECT (auth.jwt()->>'is_anonymous')::boolean) IS NOT true)
  );

-- ============================================================================
-- training_sessions policies
-- ============================================================================

-- Users can manage (SELECT, INSERT, UPDATE, DELETE) their own sessions
CREATE POLICY "Users manage own sessions" ON training_sessions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- session_entries policies
-- ============================================================================

-- Users can manage their own session entries (via session ownership subquery)
CREATE POLICY "Users manage own session entries" ON session_entries
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT id FROM training_sessions
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM training_sessions
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- daily_stats policies
-- ============================================================================

-- Users can manage their own daily stats
CREATE POLICY "Users manage own daily stats" ON daily_stats
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- spot_stats policies
-- ============================================================================

-- Users can manage their own spot stats
CREATE POLICY "Users manage own spot stats" ON spot_stats
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
