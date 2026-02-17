"use client";

// src/components/range/RangeGridModal.tsx

import { useRef, useState, useCallback, useEffect } from "react";
import { RangeContext } from "@/lib/range/context";
import type {
  RangeData,
  RangeActionType,
  EquityCategory,
} from "@/lib/range/types";
import { RangeGridView } from "./RangeGridView";
import { ActionLegend } from "./ActionLegend";
import { EquityBreakdown } from "./EquityBreakdown";
import { Card } from "@/components/poker/atoms/Card";

interface RangeGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  heroRange: RangeData;
  villainRange: RangeData;
  currentBoard: string[];
  currentHand?: string;
}

/**
 * Parse a card string like "Ah" into { rank, suit } for the Card component.
 */
function parseCardString(card: string): {
  rank: string;
  suit: "h" | "d" | "c" | "s";
} | null {
  if (card.length < 2) return null;
  const rank = card.slice(0, -1);
  const suit = card.slice(-1) as "h" | "d" | "c" | "s";
  if (!["h", "d", "c", "s"].includes(suit)) return null;
  return { rank, suit };
}

/**
 * Range visualization modal using native HTML <dialog> element.
 *
 * WCAG 2.1 compliant: built-in focus management, ESC key close,
 * backdrop click close, focus trapping -- all provided natively by <dialog>.
 *
 * Wraps content in RangeContext.Provider to share filter state across
 * grids, legends, and equity breakdown.
 */
export function RangeGridModal({
  isOpen,
  onClose,
  heroRange,
  villainRange,
  currentBoard,
  currentHand,
}: RangeGridModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [selectedAction, setSelectedAction] = useState<RangeActionType | null>(
    null,
  );
  const [selectedEquityCategory, setSelectedEquityCategory] =
    useState<EquityCategory | null>(null);

  const handleClose = useCallback(() => {
    setSelectedAction(null);
    setSelectedEquityCategory(null);
    onClose();
  }, [onClose]);

  // Sync dialog open/close state with isOpen prop
  useEffect(() => {
    if (isOpen && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    } else if (!isOpen && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [isOpen]);

  // Handle native dialog close event (ESC key, form submission)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onDialogClose = () => {
      handleClose();
    };

    dialog.addEventListener("close", onDialogClose);
    return () => dialog.removeEventListener("close", onDialogClose);
  }, [handleClose]);

  // Handle backdrop click (clicking outside dialog content)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        handleClose();
      }
    },
    [handleClose],
  );

  const boardCards = currentBoard
    .map(parseCardString)
    .filter(
      (c): c is { rank: string; suit: "h" | "d" | "c" | "s" } => c !== null,
    );

  const contextValue = {
    selectedAction,
    setSelectedAction,
    selectedEquityCategory,
    setSelectedEquityCategory,
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="w-[95vw] max-w-7xl max-h-[90vh] overflow-y-auto rounded-xl bg-gray-900 text-white p-0 backdrop:bg-black/60"
    >
      <RangeContext.Provider value={contextValue}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-100">
              Range Visualization
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              aria-label="Close range visualization"
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

          {/* Grid section: hero / board / villain */}
          <div className="flex flex-col lg:flex-row items-start gap-6">
            {/* Hero range */}
            <div className="flex-1 min-w-0 space-y-3">
              <RangeGridView
                range={heroRange}
                title="Hero"
                currentHand={currentHand}
              />
              <ActionLegend range={heroRange} title="Hero Actions" />
            </div>

            {/* Board cards (center) */}
            <div className="flex flex-col items-center justify-center gap-2 py-4 lg:py-8 shrink-0">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Board
              </span>
              {boardCards.length > 0 ? (
                <div className="flex gap-1">
                  {boardCards.map((card, i) => (
                    <Card
                      key={`board-${i}`}
                      rank={card.rank}
                      suit={card.suit}
                      size="sm"
                    />
                  ))}
                </div>
              ) : (
                <span className="text-sm text-gray-500 italic">Preflop</span>
              )}
            </div>

            {/* Villain range */}
            <div className="flex-1 min-w-0 space-y-3">
              <RangeGridView
                range={villainRange}
                title="Villain"
                currentHand={currentHand}
              />
              <ActionLegend range={villainRange} title="Villain Actions" />
            </div>
          </div>

          {/* Equity breakdown */}
          <div className="mt-6 border-t border-gray-700 pt-6">
            <EquityBreakdown hero={heroRange} villain={villainRange} />
          </div>
        </div>
      </RangeContext.Provider>
    </dialog>
  );
}
