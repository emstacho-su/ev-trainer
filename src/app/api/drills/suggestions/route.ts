/**
 * Overview: GET route for drill suggestions based on user's weakest spots.
 * Interacts with: verifyAccessToken for auth, computeDrillSuggestions for data.
 * Importance: Surfaces personalized drill recommendations in the lobby.
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../server/auth/token.service";
import { computeDrillSuggestions } from "../../../../lib/v2/api/drillSuggestions";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const payload = await verifyAccessToken(token);
    const suggestions = await computeDrillSuggestions(payload.sub);
    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
      { status: 401 }
    );
  }
}
