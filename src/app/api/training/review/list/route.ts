// src/app/api/training/review/list/route.ts

import { NextResponse } from "next/server";
import { handleReviewList } from "../../../../../lib/runtime/http/handlers";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const result = handleReviewList(body);
  return NextResponse.json(result.body, { status: result.status });
}
