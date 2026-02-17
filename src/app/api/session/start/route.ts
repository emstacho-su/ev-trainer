/**
 * Overview: POST route to start or resume a seeded session.
 * Interacts with: sessionHandlers.handleStart, Supabase sessionService for persistence.
 * Importance: API entry point for creating deterministic session state.
 *
 * Dual-path: authenticated users persist to Supabase; guests use in-memory store.
 */

import { NextResponse } from "next/server";
import { handleStart } from "../../../../lib/v2/api/sessionHandlers";
import type { StartResponse } from "../../../../lib/v2/api/sessionHandlers";
import { createClient } from "@/lib/supabase/server";
import { createTrainingSession, updateTrainingSession } from "@/lib/supabase/sessionService";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_ARGUMENT", message: "invalid JSON body" } },
      { status: 400 }
    );
  }

  // Determine auth state
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? undefined;

  // Business logic (unchanged) -- handles validation, session creation, spot selection
  const result = await handleStart(payload, userId);

  // Persist to Supabase for authenticated users
  if (user && result.status === 200 && "ok" in result.body && result.body.ok) {
    const body = result.body as StartResponse;
    try {
      const dbSession = await createTrainingSession(supabase, {
        user_id: user.id,
        session_id: body.session.sessionId,
        seed: body.session.seed,
        mode: body.session.mode,
        filters: body.session.filters as unknown as Record<string, unknown>,
        decisions_per_session: body.session.decisionsPerSession,
        decision_index: body.session.decisionIndex,
        current_spot: body.spot,
      });
      // Keep current_spot in sync
      await updateTrainingSession(supabase, dbSession.id, {
        current_spot: body.spot,
        decision_index: body.session.decisionIndex,
      });
    } catch (err) {
      // Log but don't fail the request -- in-memory state is the source of truth during active play
      console.error("[session/start] Supabase persist error:", err);
    }
  }

  return NextResponse.json(result.body, { status: result.status });
}
