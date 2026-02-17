/**
 * Overview: Shows full spot and grading payload for one reviewed decision.
 * Interacts with: SessionEntryView data from review page.
 * Importance: Deep inspection layer for understanding EV loss causes.
 */

import type { SessionEntryView } from "../lib/v2/api/sessionHandlers";

interface ReviewDecisionDetailProps {
  entry: SessionEntryView | null;
}

export default function ReviewDecisionDetail({ entry }: ReviewDecisionDetailProps) {
  if (!entry) {
    return (
      <section className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <h2 className="text-lg font-semibold text-gray-100">Decision Detail</h2>
        <p className="mt-2 text-sm text-gray-400">Select a decision to inspect it.</p>
      </section>
    );
  }

  const entryAsRecord = entry as unknown as Record<string, unknown>;
  const gradeFromEntry = "grade" in entryAsRecord ? entryAsRecord.grade : null;
  const combinedGrading = {
    grade: gradeFromEntry ?? null,
    result: entry.result ?? null,
  };

  return (
    <section className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <h2 className="text-lg font-semibold text-gray-100">Decision Detail</h2>
      <p className="mt-2 text-sm text-gray-400">
        index #{entry.index + 1} · action {entry.actionId}
      </p>
      <h3 className="mt-4 text-sm font-semibold text-gray-200">Spot</h3>
      <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-300">
        {JSON.stringify(entry.spot, null, 2)}
      </pre>
      <h3 className="mt-4 text-sm font-semibold text-gray-200">Grading</h3>
      <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-300">
        {JSON.stringify(combinedGrading, null, 2)}
      </pre>
    </section>
  );
}
