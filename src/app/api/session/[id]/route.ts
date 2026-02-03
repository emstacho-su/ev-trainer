import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleGetSession } from "../../../../lib/v2/api/sessionHandlers";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/session/[id]">
) {
  const { id: sessionId } = await context.params;
  const url = new URL(request.url);
  const seed = url.searchParams.get("seed") ?? undefined;
  const result = handleGetSession(sessionId, seed);
  return NextResponse.json(result.body, { status: result.status });
}
