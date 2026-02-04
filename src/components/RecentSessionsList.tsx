/**
 * Overview: Renders persisted session index with resume/summary/delete controls.
 * Interacts with: Home page callbacks and storage-backed session metadata.
 * Importance: Core persistence UX for restoring and managing local sessions.
 */

import Link from "next/link";
import type { PersistedSessionIndexItem } from "../lib/v2/storage/sessionStorage";

interface RecentSessionsListProps {
  sessions: PersistedSessionIndexItem[];
  onDelete: (sessionId: string) => void;
  onClearAll: () => void;
}

export default function RecentSessionsList({
  sessions,
  onDelete,
  onClearAll,
}: RecentSessionsListProps) {
  return (
    <section className="surface-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Recent Sessions</h2>
        <button
          type="button"
          onClick={onClearAll}
          disabled={sessions.length === 0}
          className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear all
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="text-muted mt-3 text-sm">No saved sessions yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sessions.map((session) => (
            <li
              key={session.sessionId}
              className="rounded-md border border-borderSubtle bg-surfaceMuted p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p>
                    <strong>{session.mode}</strong> - {session.sessionId}
                  </p>
                  <p className="text-muted">
                    pack: {session.packId} - {session.decisionIndex}/{session.decisionsPerSession}
                  </p>
                  {session.lastUpdated ? (
                    <p className="text-muted">updated: {session.lastUpdated}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {session.isComplete && session.seed ? (
                    <Link
                      href={`/summary/${session.sessionId}?seed=${encodeURIComponent(session.seed)}`}
                      className="btn-primary"
                    >
                      Summary
                    </Link>
                  ) : !session.isComplete && session.seed ? (
                    <Link
                      href={`/session/${session.sessionId}?seed=${encodeURIComponent(session.seed)}`}
                      className="btn-primary"
                    >
                      Resume
                    </Link>
                  ) : (
                    <span className="text-muted text-xs">
                      {session.isComplete ? "Complete" : "Missing seed"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(session.sessionId)}
                    className="btn-secondary"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

