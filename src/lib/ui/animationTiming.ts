/**
 * Shared animation duration constants (milliseconds -> seconds for Motion).
 * All Phase 9 animations reference these to stay consistent.
 */
export const ANIM = {
  /** Card flying from center to seat during deal: 150ms */
  CARD_DEAL: 0.15,
  /** Stagger delay between each player's card deal: 100ms */
  CARD_STAGGER: 0.1,
  /** 3D Y-axis card flip (face-down -> face-up): 300ms */
  CARD_FLIP: 0.3,
  /** Chip sliding from stack area to bet position: 250ms */
  CHIP_SLIDE: 0.25,
  /** All bets sliding to center pot at end of street: 300ms */
  CHIP_COLLECT: 0.3,
  /** Table reset between hands (cards/chips dissolve): 250ms */
  TABLE_RESET: 0.25,
  /** ActionButton pulse ring on selection: 300ms */
  BUTTON_PULSE: 0.3,
  /** ActionButton background color transition on reveal: 300ms */
  BUTTON_COLOR: 0.3,
  /** EV value slide-up + fade-in on reveal: 200ms */
  EV_REVEAL: 0.2,
  /** Modal fade + scale on open: 250ms */
  MODAL_OPEN: 0.25,
  /** Modal fade + scale on close: 200ms */
  MODAL_CLOSE: 0.2,
  /** Dealer button slide between seats: 400ms */
  DEALER_SLIDE: 0.4,
} as const;

/**
 * Standard easing curves.
 * Philosophy: ease-out dominates -- fast start, gentle deceleration.
 */
export const EASE = {
  /** Standard UI motion: fast start, gentle stop */
  OUT: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number],
  /** Snappy action feedback: quick in and out */
  IN_OUT: [0.4, 0.0, 0.2, 1.0] as [number, number, number, number],
  /** Linear for opacity-only transitions */
  LINEAR: 'linear' as const,
} as const;
