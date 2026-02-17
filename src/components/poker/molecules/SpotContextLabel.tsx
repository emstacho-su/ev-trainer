'use client';

import type { Street } from '@/lib/postflop/types';

interface SpotContextLabelProps {
  heroPosition: 'IP' | 'OOP';
  potType: '3BP' | 'SRP' | '4BP';
  heroRole: 'Aggressor' | 'Caller';
  street: Street;
}

/** Display pot type abbreviation in human-readable form. */
function formatPotType(potType: '3BP' | 'SRP' | '4BP'): string {
  switch (potType) {
    case '3BP': return '3b';
    case '4BP': return '4b';
    case 'SRP': return 'SRP';
  }
}

export function SpotContextLabel({
  heroPosition,
  potType,
  heroRole,
  street: _street,
}: SpotContextLabelProps) {
  const label = `${formatPotType(potType)} ${heroPosition} ${heroRole}`;

  return (
    <span className="text-xs text-gray-400 uppercase tracking-wider">
      {label}
    </span>
  );
}
