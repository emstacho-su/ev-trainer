/**
 * Overview: POST route for submitting a user action for the current spot.
 * Interacts with: sessionHandlers.handleSubmit and JSON error normalization.
 * Importance: Commits decisions and training/practice response behavior.
 */

import { NextResponse } from "next/server";
import { handleSubmit } from "../../../../lib/v2/api/sessionHandlers";

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

  const result = handleSubmit(payload);
  return NextResponse.json(result.body, { status: result.status });
}
