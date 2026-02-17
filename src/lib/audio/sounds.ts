export type SoundName =
  | 'card-deal'
  | 'card-flip'
  | 'chip-slide'
  | 'chip-collect'
  | 'ev-correct'
  | 'ev-incorrect';

export const SOUNDS: Record<SoundName, string> = {
  'card-deal': '/audio/card-deal.mp3',
  'card-flip': '/audio/card-flip.mp3',
  'chip-slide': '/audio/chip-slide.mp3',
  'chip-collect': '/audio/chip-collect.mp3',
  'ev-correct': '/audio/ev-correct.mp3',
  'ev-incorrect': '/audio/ev-incorrect.mp3',
};
