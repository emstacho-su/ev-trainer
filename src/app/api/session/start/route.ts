/**
 * Overview: POST route to start or resume a seeded session.
 * Interacts with: sessionHandlers.handleStart and stable JSON error responses.
 * Importance: API entry point for creating deterministic session state.
 */

import { NextResponse } from "next/server";
import { handleStart } from "../../../../lib/v2/api/sessionHandlers";

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

  const result = handleStart(payload);
  return NextResponse.json(result.body, { status: result.status });
}
