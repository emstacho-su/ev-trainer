/**
 * Overview: Selectable list of reviewed decisions ordered externally.
 * Interacts with: reviewEntry EV helpers and selected-entry state.
 * Importance: Fast triage of high-impact mistakes.
 */

import type { SessionEntryView } from "../lib/v2/api/sessionHandlers";
import { isBestActionFromEvLoss, readEvLossVsBest } from "../lib/v2/reviewEntry";

interface ReviewDecisionListProps {
  entries: SessionEntryView[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function ReviewDecisionList({
  entries,
  selectedIndex,
  onSelect,
}: ReviewDecisionListProps) {
  return (
    <section className="rounded-lg border border-stone-300 bg-white p-4">
      <h2 className="text-lg font-semibold">Decisions</h2>
      <ul className="mt-3 space-y-2">
        {entries.map((entry, index) => {
          const loss = readEvLossVsBest(entry);
          const isBest = isBestActionFromEvLoss(loss);
          return (
            <li key={`${entry.index}-${entry.spotId}`}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                className={`w-full rounded border p-3 text-left text-sm ${
                  index === selectedIndex ? "border-stone-900" : "border-stone-200"
                }`}
              >
                <p>
                  #{entry.index + 1} · {entry.actionId}
                </p>
                <p className="text-stone-600">
                  evLossVsBest: {loss.toFixed(3)} · best: {isBest ? "yes" : "no"}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
