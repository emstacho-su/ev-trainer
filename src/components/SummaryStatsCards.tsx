/**
 * Overview: Summary metric cards for volume, EV loss, best-action rate, and duration.
 * Interacts with: persisted session aggregates.
 * Importance: Compact EV-centric readout at session completion.
 */

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
      <article className="surface-card p-4">
        <p className="text-muted text-xs uppercase tracking-wide">Volume</p>
        <p className="mt-2 text-2xl font-semibold">{aggregates.volume}</p>
      </article>
      <article className="surface-card p-4">
        <p className="text-muted text-xs uppercase tracking-wide">Mean EV Loss</p>
        <p className="ev-neutral mt-2 text-2xl font-semibold">{aggregates.meanEvLoss.toFixed(3)}</p>
      </article>
      <article className="surface-card p-4">
        <p className="text-muted text-xs uppercase tracking-wide">Best-Action Rate</p>
        <p className="mt-2 text-2xl font-semibold">
          {(aggregates.bestActionRate * 100).toFixed(1)}%
        </p>
      </article>
      <article className="surface-card p-4">
        <p className="text-muted text-xs uppercase tracking-wide">Duration</p>
        <p className="mt-2 text-2xl font-semibold">{formatDuration(aggregates.durationMs)}</p>
      </article>
    </section>
  );
}
