"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { getSession } from "../../../lib/v2/api-client/sessionClient";

export default function SummaryPlaceholderPage() {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const sessionId = useMemo(
    () => (typeof params.id === "string" ? params.id : ""),
    [params.id]
  );
  const [mode, setMode] = useState(searchParams.get("mode") ?? "UNKNOWN");
  const [reviewAvailable, setReviewAvailable] = useState(
    searchParams.get("reviewAvailable") === "1"
  );

  useEffect(() => {
    const seed = searchParams.get("seed");
    if (!seed || !sessionId) return;
    void getSession(sessionId, seed)
      .then((detail) => {
        setMode(detail.session.mode);
        setReviewAvailable(detail.reviewAvailable);
      })
      .catch(() => {
        // Keep query-derived fallback values in the placeholder.
      });
  }, [searchParams, sessionId]);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Summary (T6)</h1>
      <p className="text-sm text-stone-600">
        sessionId: <span className="font-mono">{sessionId || "unknown"}</span>
      </p>
      <p className="text-sm text-stone-600">mode: {mode}</p>
      <p className="text-sm text-stone-600">
        review available: {reviewAvailable ? "yes" : "no"}
      </p>
      <Link href="/" className="text-sm underline">
        Back home
      </Link>
    </main>
  );
}
