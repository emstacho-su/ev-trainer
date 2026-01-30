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
