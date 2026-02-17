'use client';

interface HamburgerButtonProps {
  onClick: () => void;
}

export default function HamburgerButton({ onClick }: HamburgerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed top-4 left-4 z-40 rounded bg-stone-900 p-2 text-white hover:bg-stone-700"
      aria-label="Open settings"
    >
      <div className="flex h-5 w-5 flex-col justify-between">
        <span className="block h-0.5 w-full bg-current" />
        <span className="block h-0.5 w-full bg-current" />
        <span className="block h-0.5 w-full bg-current" />
      </div>
    </button>
  );
}
