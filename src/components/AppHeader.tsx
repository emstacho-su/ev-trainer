'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/lobby', label: 'Lobby' },
  { href: '/stats', label: 'Stats' },
] as const;

export default function AppHeader() {
  const pathname = usePathname();

  // Hide header on session pages to avoid distraction during training
  if (pathname.startsWith('/session/')) return null;

  return (
    <header className="border-b border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/lobby"
          className="text-lg font-bold text-stone-900 dark:text-stone-100"
        >
          EV Trainer
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
