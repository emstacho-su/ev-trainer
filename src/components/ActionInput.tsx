/**
 * Overview: Action picker with submit and next controls for the session loop.
 * Interacts with: Session page callbacks/state flags.
 * Importance: Primary decision input control during play.
 */

import type { ActionId } from "../lib/engine/types";

const ACTION_OPTIONS: ActionId[] = ["CHECK", "FOLD", "CALL"];

interface ActionInputProps {
  selectedActionId: ActionId;
  onSelect: (actionId: ActionId) => void;
  onSubmit: () => Promise<void>;
  onNext: () => Promise<void>;
  canSubmit: boolean;
  canNext: boolean;
  isSubmitting: boolean;
  isLoadingNext: boolean;
}

export default function ActionInput({
  selectedActionId,
  onSelect,
  onSubmit,
  onNext,
  canSubmit,
  canNext,
  isSubmitting,
  isLoadingNext,
}: ActionInputProps) {
  return (
    <section className="rounded-lg border border-stone-300 bg-white p-4">
      <h2 className="text-lg font-semibold">Action</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {ACTION_OPTIONS.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onSelect(action)}
            disabled={isSubmitting || isLoadingNext}
            className={`rounded border px-3 py-1 text-sm ${
              selectedActionId === action
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-400"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {action}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            void onSubmit();
          }}
          disabled={!canSubmit}
          className="rounded bg-stone-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => {
            void onNext();
          }}
          disabled={!canNext}
          className="rounded border border-stone-400 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoadingNext ? "Loading..." : "Next decision"}
        </button>
      </div>
    </section>
  );
}
