'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/training', label: 'Training' },
  { href: '/stats', label: 'Stats' },
] as const;

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  // Hide header on session and training pages to avoid distraction during training
  if (pathname.startsWith('/session/') || pathname.startsWith('/training')) return null;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  const displayName =
    user?.user_metadata?.display_name ??
    user?.email ??
    'User';

  // Truncate display name for compact display
  const truncatedName =
    displayName.length > 20
      ? displayName.slice(0, 18) + '...'
      : displayName;

  return (
    <header className="border-b border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg font-bold text-stone-900 dark:text-stone-100"
        >
          EV Trainer
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = href === '/'
                ? pathname === '/'
                : pathname === href || pathname.startsWith(href + '/');
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

          <div className="ml-2 h-5 w-px bg-stone-300 dark:bg-stone-600" />

          {loading ? (
            /* Skeleton placeholder while auth state loads */
            <div className="ml-2 flex items-center gap-2">
              <div className="h-4 w-20 animate-pulse rounded bg-stone-300 dark:bg-stone-700" />
            </div>
          ) : user ? (
            /* Logged in: show user info + logout */
            <div className="ml-2 flex items-center gap-2">
              <span
                className="hidden text-sm text-stone-600 dark:text-stone-300 sm:inline"
                title={displayName}
              >
                {truncatedName}
              </span>
              <button
                onClick={handleLogout}
                className="rounded px-3 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              >
                Log Out
              </button>
            </div>
          ) : (
            /* Not logged in: show login + signup */
            <div className="ml-2 flex items-center gap-1">
              <Link
                href="/login"
                className="rounded px-3 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-500"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
