'use client';

// src/components/poker/molecules/HandSummaryModal.tsx
// Post-hand summary modal showing per-street decisions with solver match status.
// Uses native <dialog> element following Phase 7 pattern (RangeGridModal).

import { useRef, useEffect, useCallback } from 'react';
import type { HandSummaryData, Street } from '@/lib/postflop/types';
import type { SolverActionOutput } from '@/lib/engine/solverAdapter';
import { Card } from '@/components/poker/atoms/Card';

interface HandSummaryModalProps {
  summary: HandSummaryData;
  onNextHand: () => void;
  onReplay: () => void;
}

/** Street display order. */
const STREETS: Street[] = ['FLOP', 'TURN', 'RIVER'];

/** Street ordering for deviation comparison. */
const STREET_ORDER: Record<Street, number> = { FLOP: 0, TURN: 1, RIVER: 2 };

/** Map actionId to human-readable label. Mirrors StreetActionPanel logic. */
function formatAction(actionId: string, potBb: number): string {
  const upper = actionId.toUpperCase();

  if (upper === 'CHECK') return 'Check';
  if (upper === 'FOLD') return 'Fold';
  if (upper === 'CALL') return 'Call';
  if (upper === 'ALL_IN') return 'All-in';

  const betMatch = upper.match(/^BET_(\d+)$/);
  if (betMatch) {
    const pct = parseInt(betMatch[1], 10);
    const bbAmount = ((pct / 100) * potBb).toFixed(1);
    return `Bet ${pct}% (${bbAmount}bb)`;
  }

  const raiseMatch = upper.match(/^RAISE_([\d.]+)$/);
  if (raiseMatch) {
    return `Raise ${raiseMatch[1]}x`;
  }

  return actionId.charAt(0).toUpperCase() + actionId.slice(1).toLowerCase();
}

/** Parse a Card string like "Ah" into Card component props. */
function parseCard(card: string): { rank: string; suit: 'h' | 'd' | 'c' | 's' } {
  return {
    rank: card.slice(0, -1),
    suit: card.slice(-1) as 'h' | 'd' | 'c' | 's',
  };
}

export function HandSummaryModal({ summary, onNextHand, onReplay }: HandSummaryModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open modal imperatively when mounted
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  // Handle native dialog close event (ESC key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onDialogClose = () => {
      onNextHand();
    };

    dialog.addEventListener('close', onDialogClose);
    return () => dialog.removeEventListener('close', onDialogClose);
  }, [onNextHand]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onNextHand();
      }
    },
    [onNextHand],
  );

  const { spot, decisions, deviatedStreet } = summary;
  const potBb = spot.potBb;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="w-[90vw] max-w-lg max-h-[85vh] overflow-y-auto rounded-xl bg-gray-900 border border-gray-700 text-white p-0 backdrop:bg-black/60"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-100">Hand Complete</h2>
          <button
            type="button"
            onClick={onNextHand}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="Close and go to next hand"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Board cards */}
        <div className="flex items-center gap-1 mb-6 justify-center">
          {spot.board.map((card, i) => {
            const parsed = parseCard(card);
            return (
              <Card key={`board-${i}`} rank={parsed.rank} suit={parsed.suit} size="sm" />
            );
          })}
        </div>

        {/* Per-street sections */}
        <div className="space-y-4 mb-6">
          {STREETS.map((street) => {
            const decision = decisions[street];
            const isAfterDeviation =
              deviatedStreet !== null && STREET_ORDER[street] > STREET_ORDER[deviatedStreet];
            const isDeviationStreet = deviatedStreet === street;

            return (
              <div
                key={street}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700"
              >
                {/* Street header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold uppercase tracking-wider text-gray-300">
                    {street}
                  </span>
                  {isDeviationStreet && (
                    <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                      Off solver line
                    </span>
                  )}
                </div>

                {/* Street content */}
                {isAfterDeviation ? (
                  <p className="text-sm text-gray-500 italic">
                    N/A (deviation carried from {deviatedStreet!.toLowerCase()})
                  </p>
                ) : decision ? (
                  <div>
                    {/* Hero action + solver match */}
                    <div className="flex items-center gap-2 mb-2">
                      {decision.isOnSolverLine ? (
                        <span className="text-green-400" title="On solver line">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm3.78 5.22a.75.75 0 00-1.06 0L7 8.94 5.28 7.22a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25a.75.75 0 000-1.06z" />
                          </svg>
                        </span>
                      ) : (
                        <span className="text-orange-400" title="Off solver line">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM7 4v5a1 1 0 002 0V4a1 1 0 00-2 0zm1 8.5a1 1 0 100-2 1 1 0 000 2z" />
                          </svg>
                        </span>
                      )}
                      <span className="text-sm text-white">
                        You: <span className="font-semibold">{formatAction(decision.actionId, potBb)}</span>
                      </span>
                    </div>

                    {/* Solver actions (show when not on solver line) */}
                    {!decision.isOnSolverLine && decision.solverOutput && (
                      <div className="mt-2 pl-6">
                        <p className="text-xs text-gray-400 mb-1">Solver strategy:</p>
                        <div className="space-y-0.5">
                          {decision.solverOutput.actions
                            .filter((a: SolverActionOutput) => a.frequency > 0.01)
                            .sort((a: SolverActionOutput, b: SolverActionOutput) => b.frequency - a.frequency)
                            .map((action: SolverActionOutput) => (
                              <div key={action.actionId} className="flex items-center gap-2 text-xs">
                                <span className="text-gray-300 w-28 truncate">
                                  {formatAction(action.actionId, potBb)}
                                </span>
                                <span className="text-gray-500 w-12 text-right">
                                  {(action.frequency * 100).toFixed(0)}%
                                </span>
                                <span className="text-blue-400 w-16 text-right">
                                  {action.ev >= 0 ? '+' : ''}{action.ev.toFixed(2)} bb
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No decision recorded</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onReplay}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            Replay
          </button>
          <button
            type="button"
            onClick={onNextHand}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            Next Hand
          </button>
        </div>
      </div>
    </dialog>
  );
}
