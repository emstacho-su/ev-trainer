"use client";

/**
 * Overview: Collects seed, filters, and decision count for session creation.
 * Interacts with: engine enums/constants and setup page async start handler.
 * Importance: Defines the deterministic session configuration contract from UI input.
 */

import { useMemo, useState } from "react";
import { Positions, Streets } from "../lib/engine/types";
import type { StartSessionRequest } from "../lib/v2/api-client/sessionClient";
import { EffectiveStackBuckets } from "../lib/v2/filters/spotFilters";
import { PotTypes } from "../lib/v2/packs/spotPack";
import type { SessionMode } from "../lib/v2/sessionStore";

interface SessionSetupFormProps {
  mode: SessionMode;
  onStart: (request: StartSessionRequest) => Promise<void>;
  isSubmitting: boolean;
  errorMessage: string | null;
}

export default function SessionSetupForm({
  mode,
  onStart,
  isSubmitting,
  errorMessage,
}: SessionSetupFormProps) {
  const [seed, setSeed] = useState("seed-a");
  const [decisionsPerSession, setDecisionsPerSession] = useState("10");
  const [street, setStreet] = useState("");
  const [heroPosition, setHeroPosition] = useState("");
  const [villainPosition, setVillainPosition] = useState("");
  const [potType, setPotType] = useState("");
  const [stackBucket, setStackBucket] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => !isSubmitting && seed.trim().length > 0,
    [isSubmitting, seed]
  );

  return (
    <form
      className="space-y-4 rounded-lg border border-stone-300 bg-white p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setValidationError(null);

        const parsedCount = Number(decisionsPerSession);
        if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
          setValidationError("Decisions per session must be a positive integer.");
          return;
        }

        await onStart({
          seed: seed.trim(),
          mode,
          packId: "ev-dev-pack-v1",
          decisionsPerSession: parsedCount,
          filters: {
            ...(street ? { street: street as (typeof Streets)[number] } : {}),
            ...(heroPosition
              ? { heroPosition: heroPosition as (typeof Positions)[number] }
              : {}),
            ...(villainPosition
              ? { villainPosition: villainPosition as (typeof Positions)[number] }
              : {}),
            ...(potType ? { potType: potType as "SRP" | "3BP" } : {}),
            ...(stackBucket
              ? {
                  effectiveStackBbBucket:
                    stackBucket as (typeof EffectiveStackBuckets)[number],
                }
              : {}),
          },
        });
      }}
    >
      <h1 className="text-2xl font-semibold">{mode} Setup</h1>
      <label className="block space-y-1 text-sm">
        <span>Mode</span>
        <input
          value={mode}
          readOnly
          className="w-full rounded border border-stone-300 bg-stone-100 p-2"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Pack</span>
        <select className="w-full rounded border border-stone-300 p-2" disabled>
          <option value="ev-dev-pack-v1">ev-dev-pack-v1</option>
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span>Seed</span>
        <input
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
          className="w-full rounded border border-stone-300 p-2"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Decisions per session</span>
        <input
          type="number"
          min={1}
          value={decisionsPerSession}
          onChange={(event) => setDecisionsPerSession(event.target.value)}
          className="w-full rounded border border-stone-300 p-2"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span>Street</span>
          <select
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            className="w-full rounded border border-stone-300 p-2"
          >
            <option value="">Any</option>
            {Streets.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Pot type</span>
          <select
            value={potType}
            onChange={(event) => setPotType(event.target.value)}
            className="w-full rounded border border-stone-300 p-2"
          >
            <option value="">Any</option>
            {PotTypes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Hero position</span>
          <select
            value={heroPosition}
            onChange={(event) => setHeroPosition(event.target.value)}
            className="w-full rounded border border-stone-300 p-2"
          >
            <option value="">Any</option>
            {Positions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Villain position</span>
          <select
            value={villainPosition}
            onChange={(event) => setVillainPosition(event.target.value)}
            className="w-full rounded border border-stone-300 p-2"
          >
            <option value="">Any</option>
            {Positions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm md:col-span-2">
          <span>Effective stack bucket</span>
          <select
            value={stackBucket}
            onChange={(event) => setStackBucket(event.target.value)}
            className="w-full rounded border border-stone-300 p-2"
          >
            <option value="">Any</option>
            {EffectiveStackBuckets.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {validationError ? (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {validationError}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded bg-stone-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Starting..." : "Start"}
      </button>
    </form>
  );
}
