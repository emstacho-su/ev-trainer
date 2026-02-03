import type { PersistedSessionAggregates } from "../lib/v2/storage/sessionStorage";

interface SummaryStatsCardsProps {
  aggregates: PersistedSessionAggregates;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function SummaryStatsCards({ aggregates }: SummaryStatsCardsProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <article className="rounded-lg border border-stone-300 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-stone-500">Volume</p>
        <p className="mt-2 text-2xl font-semibold">{aggregates.volume}</p>
      </article>
      <article className="rounded-lg border border-stone-300 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-stone-500">Mean EV Loss</p>
        <p className="mt-2 text-2xl font-semibold">{aggregates.meanEvLoss.toFixed(3)}</p>
      </article>
      <article className="rounded-lg border border-stone-300 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-stone-500">Best-Action Rate</p>
        <p className="mt-2 text-2xl font-semibold">
          {(aggregates.bestActionRate * 100).toFixed(1)}%
        </p>
      </article>
      <article className="rounded-lg border border-stone-300 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-stone-500">Duration</p>
        <p className="mt-2 text-2xl font-semibold">{formatDuration(aggregates.durationMs)}</p>
      </article>
    </section>
  );
}
