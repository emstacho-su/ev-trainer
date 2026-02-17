/**
 * Overview: POST route for submitting a user action for the current spot.
 * Interacts with: sessionHandlers.handleSubmit, Supabase sessionService for persistence.
 * Importance: Commits decisions and training/practice response behavior.
 *
 * Dual-path: authenticated users persist entries to Supabase; guests use in-memory store.
 */

import { NextResponse } from "next/server";
import { handleSubmit } from "../../../../lib/v2/api/sessionHandlers";
import { createClient } from "@/lib/supabase/server";
import { getTrainingSession, addSessionEntry, updateTrainingSession } from "@/lib/supabase/sessionService";

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

  // Business logic (unchanged) -- handles validation, grading, entry append
  const result = await handleSubmit(payload, userId);

  // Persist entry to Supabase for authenticated users
  if (user && result.status === 200 && "ok" in result.body && result.body.ok) {
    const body = payload as { sessionId?: string; seed?: string; spot?: { spotId?: string }; actionId?: string };
    if (body.sessionId && body.seed && body.spot?.spotId && body.actionId) {
      try {
        const dbSession = await getTrainingSession(supabase, body.sessionId, body.seed);
        if (dbSession) {
          // Save the entry
          await addSessionEntry(supabase, {
            session_id: dbSession.id,
            index: dbSession.decision_index,
            spot_id: body.spot.spotId,
            spot: body.spot,
            action_id: body.actionId,
            result: "result" in result.body ? (result.body as { result?: unknown }).result ?? null : null,
          });
        }
      } catch (err) {
        // Log but don't fail -- in-memory is source of truth during active play
        console.error("[session/submit] Supabase persist error:", err);
      }
    }
  }

  return NextResponse.json(result.body, { status: result.status });
}
