"use client";

/**
 * Overview: Stats dashboard layout with dark theme wrapper.
 * Interacts with: Stats page and all child components.
 * Importance: Provides consistent layout container for stats dashboard.
 */

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      {children}
    </div>
  );
}
