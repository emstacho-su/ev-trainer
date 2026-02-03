import { NextResponse } from "next/server";
import { handleNext } from "../../../../lib/v2/api/sessionHandlers";

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

  const result = handleNext(payload);
  return NextResponse.json(result.body, { status: result.status });
}
