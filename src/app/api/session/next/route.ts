/**
 * Overview: POST route for advancing to the next decision in a session.
 * Interacts with: sessionHandlers.handleNext, Supabase sessionService for persistence.
 * Importance: Moves deterministic progression through the session lifecycle.
 *
 * Dual-path: authenticated users sync state to Supabase; guests use in-memory store.
 */

import { NextResponse } from "next/server";
import { handleNext } from "../../../../lib/v2/api/sessionHandlers";
import { createClient } from "@/lib/supabase/server";
import { getTrainingSession, updateTrainingSession } from "@/lib/supabase/sessionService";

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

  // Business logic (unchanged) -- handles validation, advance, spot selection
  const result = await handleNext(payload, userId);

  // Sync state to Supabase for authenticated users
  if (user && result.status === 200 && "ok" in result.body && result.body.ok) {
    const body = result.body as { ok: true; session: { sessionId: string; seed: string; decisionIndex: number; isComplete: boolean }; spot: unknown };
    const reqBody = payload as { sessionId?: string; seed?: string };
    if (reqBody.sessionId && reqBody.seed) {
      try {
        const dbSession = await getTrainingSession(supabase, reqBody.sessionId, reqBody.seed);
        if (dbSession) {
          await updateTrainingSession(supabase, dbSession.id, {
            decision_index: body.session.decisionIndex,
            current_spot: body.spot,
            is_complete: body.session.isComplete,
          });
        }
      } catch (err) {
        // Log but don't fail -- in-memory is source of truth during active play
        console.error("[session/next] Supabase persist error:", err);
      }
    }
  }

  // Handle SESSION_COMPLETE: mark complete in Supabase
  if (user && result.status === 409) {
    const errorBody = result.body as { error?: { code?: string } };
    if (errorBody.error?.code === "SESSION_COMPLETE") {
      const reqBody = payload as { sessionId?: string; seed?: string };
      if (reqBody.sessionId && reqBody.seed) {
        try {
          const dbSession = await getTrainingSession(supabase, reqBody.sessionId, reqBody.seed);
          if (dbSession && !dbSession.is_complete) {
            await updateTrainingSession(supabase, dbSession.id, {
              is_complete: true,
            });
          }
        } catch (err) {
          console.error("[session/next] Supabase complete-mark error:", err);
        }
      }
    }
  }

  return NextResponse.json(result.body, { status: result.status });
}
