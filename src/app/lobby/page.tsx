'use client';

import { Suspense } from 'react';
import TrainerLobby from '@/components/config/TrainerLobby';

export default function LobbyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-stone-400">Loading...</p></div>}>
      <TrainerLobby />
    </Suspense>
  );
}
