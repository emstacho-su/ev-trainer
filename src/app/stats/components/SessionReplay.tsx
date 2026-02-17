"use client";

/**
 * Overview: Hand-by-hand replay component for reviewing session entries as simplified cards.
 * Interacts with: SessionHistory (parent), SessionEntryDetail (data type).
 * Importance: Allows users to step through each hand in a completed session with review cards.
 */

import { useCallback, useEffect, useState } from "react";
import type { SessionEntryDetail } from "../../../lib/stats/types";

export interface SessionReplayProps {
  entries: SessionEntryDetail[];
  onClose: () => void;
}

export default function SessionReplay({ entries, onClose }: SessionReplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(entries.length - 1, i + 1));
  }, [entries.length]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "p") {
        goPrev();
      } else if (e.key === "ArrowRight" || e.key === "n") {
        goNext();
      } else if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext, onClose]);

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        No hands to replay.
      </div>
    );
  }

  const entry = entries[currentIndex];
  const grade = entry.result?.grade ?? "PENDING";
  const isCorrect = grade === "CORRECT" || grade === "OPTIMAL";
  const evDiff = entry.result?.evDiff ?? 0;
  const allActions = entry.result?.allActions ?? [];

  // Sort by EV descending for optimal strategy display
  const topActions = [...allActions].sort((a, b) => b.ev - a.ev).slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Review card */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        {/* Hand counter */}
        <p className="mb-4 text-sm text-slate-400">
          Hand {currentIndex + 1} of {entries.length}
        </p>

        {/* Info grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Spot */}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Spot</p>
            <p className="mt-1 font-mono text-slate-200">
              {entry.spotId.slice(0, 12)}
            </p>
          </div>

          {/* Your Action */}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Your Action
            </p>
            <span
              className={`mt-1 inline-block rounded px-2 py-0.5 text-sm font-medium ${
                isCorrect
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {entry.actionId}
            </span>
          </div>

          {/* Result */}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Result</p>
            <p
              className={`mt-1 text-sm font-medium ${
                isCorrect ? "text-green-400" : "text-red-400"
              }`}
            >
              {grade}
            </p>
          </div>

          {/* EV Difference */}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              EV Difference
            </p>
            <p className="mt-1 font-mono text-slate-200">
              {evDiff === 0
                ? "-"
                : `${evDiff < 0 ? "-" : ""}${Math.abs(evDiff).toFixed(3)} BB`}
            </p>
          </div>
        </div>

        {/* Optimal Strategy */}
        {topActions.length > 0 && (
          <div className="mt-4 border-t border-slate-700 pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
              Optimal Strategy
            </p>
            <div className="space-y-1">
              {topActions.map((a) => (
                <p key={a.actionId} className="text-sm text-slate-400">
                  {a.actionId} ({(a.frequency * 100).toFixed(0)}%) —{" "}
                  {a.ev.toFixed(3)} BB
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <button
          className="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={currentIndex === 0}
          onClick={goPrev}
        >
          Prev
        </button>

        <span className="text-sm text-slate-400">
          {currentIndex + 1} / {entries.length}
        </span>

        <div className="flex items-center gap-3">
          <button
            className="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={currentIndex === entries.length - 1}
            onClick={goNext}
          >
            Next
          </button>
          <button
            className="text-sm text-slate-400 underline transition-colors hover:text-slate-200"
            onClick={onClose}
          >
            Exit Replay
          </button>
        </div>
      </div>
    </div>
  );
}
