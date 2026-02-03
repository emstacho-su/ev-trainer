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
    <section className="rounded-lg border border-stone-300 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Recent Sessions</h2>
        <button
          type="button"
          onClick={onClearAll}
          disabled={sessions.length === 0}
          className="rounded border border-stone-400 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear all
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="mt-3 text-sm text-stone-600">No saved sessions yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sessions.map((session) => (
            <li
              key={session.sessionId}
              className="rounded border border-stone-200 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p>
                    <strong>{session.mode}</strong> · {session.sessionId}
                  </p>
                  <p className="text-stone-600">
                    pack: {session.packId} · {session.decisionIndex}/
                    {session.decisionsPerSession}
                  </p>
                  {session.lastUpdated ? (
                    <p className="text-stone-600">updated: {session.lastUpdated}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {session.isComplete && session.seed ? (
                    <Link
                      href={`/summary/${session.sessionId}?seed=${encodeURIComponent(session.seed)}`}
                      className="rounded bg-stone-900 px-3 py-1 text-white"
                    >
                      Summary
                    </Link>
                  ) : !session.isComplete && session.seed ? (
                    <Link
                      href={`/session/${session.sessionId}?seed=${encodeURIComponent(session.seed)}`}
                      className="rounded bg-stone-900 px-3 py-1 text-white"
                    >
                      Resume
                    </Link>
                  ) : (
                    <span className="text-xs text-stone-500">
                      {session.isComplete ? "Complete" : "Missing seed"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(session.sessionId)}
                    className="rounded border border-stone-400 px-3 py-1"
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
