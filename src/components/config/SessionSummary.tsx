'use client';

/**
 * Overview: Session summary screen displayed after training session completes.
 * Interacts with: Parent component for navigation callbacks.
 * Importance: Provides post-session stats review with Play Again and Back to Lobby actions.
 */

interface SessionSummaryProps {
  handsPlayed: number;
  accuracy: number;
  avgEvLoss: number;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export default function SessionSummary({
  handsPlayed,
  accuracy,
  avgEvLoss,
  onPlayAgain,
  onBackToLobby,
}: SessionSummaryProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center space-y-6 p-6">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
        Session Complete
      </h1>

      {/* Stats grid */}
      <div className="grid w-full grid-cols-3 gap-4">
        <div className="rounded border border-stone-200 p-4 text-center dark:border-stone-700">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Hands Played
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {handsPlayed}
          </p>
        </div>

        <div className="rounded border border-stone-200 p-4 text-center dark:border-stone-700">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Accuracy
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {accuracy.toFixed(1)}%
          </p>
        </div>

        <div className="rounded border border-stone-200 p-4 text-center dark:border-stone-700">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Avg EV Loss
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {avgEvLoss.toFixed(2)} BB/hand
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onPlayAgain}
          className="rounded bg-stone-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
        >
          Play Again
        </button>
        <button
          type="button"
          onClick={onBackToLobby}
          className="rounded border border-stone-300 px-6 py-3 font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
