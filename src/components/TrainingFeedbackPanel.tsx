/**
 * Overview: Training-only EV feedback panel (desktop + mobile modal).
 * Interacts with: Session page submit response state.
 * Importance: Immediate coaching surface for training decisions.
 */

import type { SubmitTrainingResponse } from "../lib/v2/api/sessionHandlers";

interface TrainingFeedbackPanelProps {
  response: SubmitTrainingResponse | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function TrainingFeedbackPanel({
  response,
  mobileOpen,
  onCloseMobile,
}: TrainingFeedbackPanelProps) {
  if (!response) return null;

  return (
    <>
      <aside className="hidden w-full max-w-sm rounded-lg border border-stone-300 bg-white p-4 md:block">
        <h2 className="text-lg font-semibold">Training Feedback</h2>
        <pre className="mt-3 overflow-auto rounded bg-stone-100 p-2 text-xs">
          {JSON.stringify(response.result, null, 2)}
        </pre>
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4 md:hidden">
          <div className="w-full rounded-lg bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Training Feedback</h2>
              <button
                type="button"
                onClick={onCloseMobile}
                className="rounded border border-stone-400 px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>
            <pre className="mt-3 max-h-64 overflow-auto rounded bg-stone-100 p-2 text-xs">
              {JSON.stringify(response.result, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </>
  );
}
