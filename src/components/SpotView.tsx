/**
 * Overview: Displays the current spot summary and raw payload.
 * Interacts with: Session page currentSpot state.
 * Importance: Gives the user the exact decision context being graded.
 */

import type { Spot } from "../lib/engine/spot";

interface SpotViewProps {
  spot: Spot | null;
}

export default function SpotView({ spot }: SpotViewProps) {
  if (!spot) {
    return (
      <section className="rounded-lg border border-stone-300 bg-white p-4">
        <h2 className="text-lg font-semibold">Current Spot</h2>
        <p className="mt-2 text-sm text-stone-600">No spot available.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-stone-300 bg-white p-4">
      <h2 className="text-lg font-semibold">Current Spot</h2>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="text-stone-500">spotId</dt>
          <dd className="font-mono text-xs">{spot.spotId}</dd>
        </div>
        <div>
          <dt className="text-stone-500">heroToAct</dt>
          <dd>{spot.heroToAct}</dd>
        </div>
        <div>
          <dt className="text-stone-500">board</dt>
          <dd>{spot.board.join(" ") || "-"}</dd>
        </div>
        <div>
          <dt className="text-stone-500">pot</dt>
          <dd>{spot.potBb} bb</dd>
        </div>
      </dl>
      <pre className="mt-4 max-h-64 overflow-auto rounded bg-stone-100 p-2 text-xs">
        {JSON.stringify(spot, null, 2)}
      </pre>
    </section>
  );
}
