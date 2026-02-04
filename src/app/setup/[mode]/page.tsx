"use client";

/**
 * Overview: Mode-specific session setup and session bootstrapping.
 * Interacts with: setup form UI, session start API client, local session persistence.
 * Importance: Creates canonical session context (seed/mode/filters) before the core loop.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import SessionSetupForm from "../../../components/SessionSetupForm";
import { SessionApiError, startSession } from "../../../lib/v2/api-client/sessionClient";
import type { SessionMode } from "../../../lib/v2/sessionStore";
import { writeSessionRecord } from "../../../lib/v2/storage/sessionStorage";

function parseMode(value: string | string[] | undefined): SessionMode | null {
  if (value === "TRAINING" || value === "PRACTICE") return value;
  return null;
}

export default function SetupModePage() {
  const router = useRouter();
  const params = useParams<{ mode?: string | string[] }>();
  const mode = useMemo(() => parseMode(params.mode), [params.mode]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!mode) {
    return (
      <main className="app-page mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Setup</h1>
        <p className="alert-error text-sm">
          Invalid mode.
        </p>
        <Link href="/" className="link-subtle text-sm">
          Back home
        </Link>
      </main>
    );
  }

  return (
    <main className="app-page mx-auto max-w-3xl space-y-4 p-6">
      <Link href="/" className="link-subtle text-sm">
        Back home
      </Link>
      <SessionSetupForm
        mode={mode}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onStart={async (request) => {
          setIsSubmitting(true);
          setErrorMessage(null);
          try {
            const response = await startSession(request);
            writeSessionRecord({
              session: response.session,
              currentSpot: response.spot,
              reviewAvailable: response.session.mode === "TRAINING",
              startedAt: new Date().toISOString(),
            });
            router.push(
              `/session/${response.session.sessionId}?seed=${encodeURIComponent(
                response.session.seed
              )}`
            );
          } catch (error) {
            if (error instanceof SessionApiError) {
              setErrorMessage(`${error.code}: ${error.message}`);
            } else {
              setErrorMessage("Failed to start session.");
            }
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
    </main>
  );
}
