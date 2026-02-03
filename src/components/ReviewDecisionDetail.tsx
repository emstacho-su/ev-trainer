import type { SessionEntryView } from "../lib/v2/api/sessionHandlers";

interface ReviewDecisionDetailProps {
  entry: SessionEntryView | null;
}

export default function ReviewDecisionDetail({ entry }: ReviewDecisionDetailProps) {
  if (!entry) {
    return (
      <section className="rounded-lg border border-stone-300 bg-white p-4">
        <h2 className="text-lg font-semibold">Decision Detail</h2>
        <p className="mt-2 text-sm text-stone-600">Select a decision to inspect it.</p>
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
    <section className="rounded-lg border border-stone-300 bg-white p-4">
      <h2 className="text-lg font-semibold">Decision Detail</h2>
      <p className="mt-2 text-sm text-stone-600">
        index #{entry.index + 1} · action {entry.actionId}
      </p>
      <h3 className="mt-4 text-sm font-semibold">Spot</h3>
      <pre className="mt-2 max-h-64 overflow-auto rounded bg-stone-100 p-2 text-xs">
        {JSON.stringify(entry.spot, null, 2)}
      </pre>
      <h3 className="mt-4 text-sm font-semibold">Grading</h3>
      <pre className="mt-2 max-h-64 overflow-auto rounded bg-stone-100 p-2 text-xs">
        {JSON.stringify(combinedGrading, null, 2)}
      </pre>
    </section>
  );
}
