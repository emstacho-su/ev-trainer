"use client";

/**
 * Overview: Home entry screen for Training/Practice.
 * Interacts with: mode cards, recent-session list, localStorage session index helpers.
 * Importance: Primary navigation hub and session resume/delete/clear controls.
 */

import { useEffect, useState } from "react";
import ModeEntryCard from "../components/ModeEntryCard";
import RecentSessionsList from "../components/RecentSessionsList";
import type { PersistedSessionIndexItem } from "../lib/v2/storage/sessionStorage";
import {
  consumeStorageWarning,
  clearAllSessionRecords,
  deleteSessionRecord,
  readSessionIndex,
} from "../lib/v2/storage/sessionStorage";

export default function Home() {
  const [sessions, setSessions] = useState<PersistedSessionIndexItem[]>([]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const refreshSessions = () => {
    setSessions(readSessionIndex());
    setStorageWarning(consumeStorageWarning());
  };

  useEffect(() => {
    refreshSessions();
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">EV Trainer v2</h1>
        <p className="text-stone-600">Choose a mode, then run a focused session.</p>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <ModeEntryCard
          href="/setup/TRAINING"
          title="Training"
          description="Submit actions and see feedback after each decision."
        />
        <ModeEntryCard
          href="/setup/PRACTICE"
          title="Practice"
          description="Submit actions without mid-session EV feedback."
        />
      </section>
      <RecentSessionsList
        sessions={sessions}
        onDelete={(sessionId) => {
          deleteSessionRecord(sessionId);
          refreshSessions();
        }}
        onClearAll={() => {
          clearAllSessionRecords();
          refreshSessions();
        }}
      />
      {storageWarning ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {storageWarning}
        </p>
      ) : null}
    </main>
  );
}
