/**
 * Overview: GET route that computes global stats from encoded persisted records.
 * Interacts with: global aggregate calculator and header-based record transport.
 * Importance: Server boundary for normalized cross-session analytics.
 */

import { NextResponse, type NextRequest } from "next/server";
import { computeGlobalStats, createZeroGlobalStats } from "../../../lib/aggregates/globalStats";

const SESSIONS_HEADER = "x-ev-trainer-sessions";

interface StatsErrorResponse {
  error: string;
  totals: ReturnType<typeof createZeroGlobalStats>["totals"];
  breakdowns: ReturnType<typeof createZeroGlobalStats>["breakdowns"];
}

function errorResponse(status: number, message: string): NextResponse<StatsErrorResponse> {
  const zero = createZeroGlobalStats();
  return NextResponse.json(
    {
      error: message,
      totals: zero.totals,
      breakdowns: zero.breakdowns,
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function decodeRecordsHeader(value: string): unknown[] | null {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const encoded = request.headers.get(SESSIONS_HEADER);
  if (!encoded || encoded.trim().length === 0) {
    return errorResponse(400, `${SESSIONS_HEADER} header is required`);
  }

  const records = decodeRecordsHeader(encoded);
  if (records === null) {
    return errorResponse(400, `${SESSIONS_HEADER} must be base64-encoded JSON array`);
  }

  return NextResponse.json(computeGlobalStats(records), {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
