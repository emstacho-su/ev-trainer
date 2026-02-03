import { beforeEach, describe, expect, it } from "vitest";
import {
  handleNext,
  handleStart,
  handleSubmit,
  type ApiResult,
  type NextResponse,
  type StartResponse,
  type SubmitPracticeResponse,
  type SubmitTrainingResponse,
} from "../lib/v2/api/sessionHandlers";
import type { SpotFilterInput } from "../lib/v2/filters/spotFilters";
import { clearBundledPackCache } from "../lib/v2/packs/loadBundledPack";
import { clearSessionStore } from "../lib/v2/sessionStore";
import { clearSessionRegistry } from "../lib/runtime/v2SessionRegistry";

function resetState(): void {
  clearSessionRegistry();
  clearSessionStore();
  clearBundledPackCache();
}

function expectOk<T extends object>(result: ApiResult<T>): T {
  expect(result.status).toBe(200);
  if ("error" in result.body) {
    throw new Error(`expected success response, got ${result.body.error.code}`);
  }
  return result.body;
}

function collectDecisionSequence(input: {
  mode: "TRAINING" | "PRACTICE";
  seed: string;
  filters: SpotFilterInput;
  limit: number;
}): string[] {
  const start = expectOk<StartResponse>(
    handleStart({
      seed: input.seed,
      mode: input.mode,
      packId: "ev-dev-pack-v1",
      filters: input.filters,
      decisionsPerSession: input.limit,
    })
  );

  const signatures: string[] = [start.spot.spotId];
  let currentSpot = start.spot;

  for (let step = 1; step < input.limit; step += 1) {
    const submit = handleSubmit({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
      spot: currentSpot,
      actionId: "CHECK",
    });
    expect(submit.status).toBe(200);

    const next = handleNext({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
    });

    if (next.status !== 200) {
      expect(next.status).toBe(409);
      if ("error" in next.body) {
        expect(next.body.error.code).toBe("SESSION_COMPLETE");
      }
      break;
    }

    const nextBody = next.body as NextResponse;
    currentSpot = nextBody.spot;
    signatures.push(currentSpot.spotId);
  }

  return signatures;
}

describe("determinism replay (training vs practice)", () => {
  beforeEach(() => {
    resetState();
  });

  it("replays identical decision signatures for training and practice with matching seed/pack/filters", () => {
    const runInput = {
      seed: "replay-seed",
      filters: { street: "FLOP" } satisfies SpotFilterInput,
      limit: 10,
    };

    const training = collectDecisionSequence({
      ...runInput,
      mode: "TRAINING",
    });
    resetState();
    const practice = collectDecisionSequence({
      ...runInput,
      mode: "PRACTICE",
    });

    expect(training.length).toBeGreaterThan(1);
    expect(practice).toEqual(training);
  });

  it("changes sequence when seed changes (negative control)", () => {
    const base = collectDecisionSequence({
      mode: "TRAINING",
      seed: "seed-one",
      filters: {},
      limit: 8,
    });

    resetState();

    const differentSeed = collectDecisionSequence({
      mode: "TRAINING",
      seed: "seed-two",
      filters: {},
      limit: 8,
    });

    expect(differentSeed).not.toEqual(base);
  });
});
