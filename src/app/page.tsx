'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ConfigCard from '@/components/config/ConfigCard';
import DrillSuggestions from '@/components/config/DrillSuggestions';
import type { TrainerConfig } from '@/lib/v2/config/types';

/**
 * Dashboard home page.
 * Replaces the redirect-to-lobby pattern with a proper landing page.
 * Shows a training card linking to /training and drill suggestions.
 */
export default function DashboardPage() {
  const router = useRouter();

  const handleSelectDrill = (drill: Partial<TrainerConfig>) => {
    const params = new URLSearchParams();
    if (drill.positions && drill.positions.length > 0) {
      params.set('heroPosition', drill.positions[0]);
    }
    if (drill.potTypes && drill.potTypes.length > 0) {
      params.set('potType', drill.potTypes[0]);
    }
    const query = params.toString();
    router.push(`/training${query ? `?${query}` : ''}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
          EV Trainer
        </h1>
        <p className="text-stone-400">Dashboard</p>
      </div>

      {/* Training Card */}
      <ConfigCard title="Start Training" subtitle="Practice preflop decisions with solver feedback">
        <div className="mt-2">
          <Link
            href="/training"
            className="inline-block rounded bg-stone-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
          >
            Start Training
          </Link>
        </div>
      </ConfigCard>

      {/* Drill Suggestions */}
      <ConfigCard title="Drill Suggestions" subtitle="Your weakest spots">
        <DrillSuggestions onSelectDrill={handleSelectDrill} />
      </ConfigCard>
    </div>
  );
}
