'use client';

// src/app/postflop-training/page.tsx
// Postflop training page with full training loop.
// Renders PostflopTrainingSession (which wraps its own PostflopSessionProvider).

import Link from 'next/link';
import { PostflopTrainingSession } from '@/components/poker/organisms/PostflopTrainingSession';

export default function PostflopTrainingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top navigation bar */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <Link
          href="/"
          className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label="Back to home"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 10H5M5 10l5-5M5 10l5 5" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold">Postflop Training</h1>
      </header>

      {/* Training session content */}
      <main className="flex-1 flex flex-col">
        <PostflopTrainingSession />
      </main>
    </div>
  );
}
