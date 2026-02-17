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
    <section className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <h2 className="text-lg font-semibold text-gray-100">Decisions</h2>
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
                  index === selectedIndex
                    ? "border-blue-500 bg-gray-700"
                    : "border-gray-600 hover:bg-gray-700/50"
                }`}
              >
                <p className="text-gray-200">
                  #{entry.index + 1} · {entry.actionId}
                </p>
                <p className="text-gray-400">
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
