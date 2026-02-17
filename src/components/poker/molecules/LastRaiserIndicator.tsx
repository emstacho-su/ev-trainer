'use client';

interface LastRaiserIndicatorProps {
  position: string;
  isVisible: boolean;
}

export function LastRaiserIndicator({ position: _position, isVisible }: LastRaiserIndicatorProps) {
  if (!isVisible) return null;

  return (
    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">
      LRI
    </span>
  );
}
