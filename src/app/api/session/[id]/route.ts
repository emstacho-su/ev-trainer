/**
 * Overview: GET route for reading a session snapshot and gated review entries.
 *           DELETE route for removing a session.
 * Interacts with: sessionHandlers.handleGetSession, Supabase sessionService.
 * Importance: Source of truth for session restore, summary, and review pages.
 *
 * Dual-path: authenticated users can also fetch from Supabase for cross-device access.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleGetSession } from "../../../../lib/v2/api/sessionHandlers";
import { createClient } from "@/lib/supabase/server";
import { getSessionWithEntries, deleteTrainingSession } from "@/lib/supabase/sessionService";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/session/[id]">
) {
  const { id: sessionId } = await context.params;
  const url = new URL(request.url);
  const seed = url.searchParams.get("seed") ?? undefined;

  // Determine auth state
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? undefined;

  // Try in-memory first (active session)
  const result = await handleGetSession(sessionId, seed, userId);

  // If in-memory has it, return that
  if (result.status === 200) {
    return NextResponse.json(result.body, { status: result.status });
  }

  // If not found in-memory but user is authenticated, try Supabase for historical sessions
  if (user && seed && result.status === 404) {
    try {
      const dbSession = await getSessionWithEntries(supabase, sessionId, seed);
      if (dbSession) {
        // Verify ownership
        if (dbSession.user_id && dbSession.user_id !== user.id) {
          return NextResponse.json(
            { error: { code: "FORBIDDEN", message: "Cannot access another user's session" } },
            { status: 403 }
          );
        }

        const isComplete = dbSession.is_complete;
        const reviewAvailable = isComplete;

        const sessionSnapshot = {
          sessionId: dbSession.session_id,
          seed: dbSession.seed,
          mode: dbSession.mode,
          packId: "ev-dev-pack-v1", // Pack ID not stored in DB; use default
          decisionIndex: dbSession.decision_index,
          decisionsPerSession: dbSession.decisions_per_session,
          isComplete,
          filters: dbSession.filters as Record<string, unknown>,
        };

        if (!reviewAvailable) {
          return NextResponse.json({
            ok: true,
            session: sessionSnapshot,
            reviewAvailable: false,
          });
        }

        return NextResponse.json({
          ok: true,
          session: sessionSnapshot,
          reviewAvailable: true,
          entries: dbSession.session_entries.map((entry) => ({
            index: entry.index,
            spotId: entry.spot_id,
            spot: entry.spot,
            actionId: entry.action_id,
            result: entry.result,
          })),
        });
      }
    } catch (err) {
      console.error("[session/[id]] Supabase fetch error:", err);
    }
  }

  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/session/[id]">
) {
  const { id: sessionId } = await context.params;
  const url = new URL(request.url);
  const seed = url.searchParams.get("seed");

  if (!seed) {
    return NextResponse.json(
      { error: { code: "INVALID_ARGUMENT", message: "seed query param is required" } },
      { status: 400 }
    );
  }

  // Determine auth state
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required to delete sessions" } },
      { status: 401 }
    );
  }

  try {
    const { data: dbSession } = await supabase
      .from('training_sessions')
      .select('id, user_id')
      .eq('session_id', sessionId)
      .eq('seed', seed)
      .maybeSingle();

    if (!dbSession) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "session not found" } },
        { status: 404 }
      );
    }

    // Verify ownership
    if (dbSession.user_id && dbSession.user_id !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Cannot delete another user's session" } },
        { status: 403 }
      );
    }

    await deleteTrainingSession(supabase, dbSession.id);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    console.error("[session/[id]] Supabase delete error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to delete session" } },
      { status: 500 }
    );
  }
}
