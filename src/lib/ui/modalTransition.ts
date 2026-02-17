import { ANIM, EASE } from './animationTiming';

/** Motion props for modal backdrop (fade in/out) */
export const modalOverlayProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: ANIM.MODAL_OPEN, ease: EASE.OUT },
} as const;

/** Motion props for modal content panel (fade + scale from 95% to 100%) */
export const modalContentProps = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: {
    duration: ANIM.MODAL_OPEN,
    ease: EASE.OUT,
    exit: { duration: ANIM.MODAL_CLOSE },
  },
} as const;
