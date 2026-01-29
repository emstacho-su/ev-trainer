// src/app/api/training/spot-quiz/route.ts

import { NextResponse } from "next/server";
import { handleSpotQuiz } from "../../../../lib/runtime/http/handlers";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const result = handleSpotQuiz(body);
  return NextResponse.json(result.body, { status: result.status });
}
