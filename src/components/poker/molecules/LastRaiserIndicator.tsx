'use client';

interface LastRaiserIndicatorProps {
  /** Seat label of the last aggressor (e.g. "BTN", "BB") */
  seat: string;
  isVisible: boolean;
}

/**
 * Visual chip/badge positioned inline next to the aggressor's label.
 * Rendered by the parent layout alongside the seat info — not absolutely
 * positioned on the table, since the parent already knows where the seat is.
 */
export function LastRaiserIndicator({ seat, isVisible }: LastRaiserIndicatorProps) {
  if (!isVisible) return null;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/90 text-white text-xs font-bold shadow-md"
      title={`Last raiser: ${seat}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-3 h-3"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z"
          clipRule="evenodd"
        />
      </svg>
      LRI
    </span>
  );
}
