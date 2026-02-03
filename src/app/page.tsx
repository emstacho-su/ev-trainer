"use client";

import { useEffect, useState } from "react";
import ModeEntryCard from "../components/ModeEntryCard";
import RecentSessionsList from "../components/RecentSessionsList";
import type { PersistedSessionIndexItem } from "../lib/v2/storage/sessionStorage";
import {
  clearAllSessionRecords,
  deleteSessionRecord,
  readSessionIndex,
} from "../lib/v2/storage/sessionStorage";

export default function Home() {
  const [sessions, setSessions] = useState<PersistedSessionIndexItem[]>([]);

  useEffect(() => {
    setSessions(readSessionIndex());
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
          setSessions(readSessionIndex());
        }}
        onClearAll={() => {
          clearAllSessionRecords();
          setSessions(readSessionIndex());
        }}
      />
    </main>
  );
}
