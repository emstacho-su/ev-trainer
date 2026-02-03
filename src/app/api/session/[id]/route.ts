import { NextResponse } from "next/server";
import { handleGetSession } from "../../../../lib/v2/api/sessionHandlers";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await context.params;
  const url = new URL(request.url);
  const seed = url.searchParams.get("seed");
  const result = handleGetSession(sessionId, seed);
  return NextResponse.json(result.body, { status: result.status });
}
