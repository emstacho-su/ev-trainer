import { beforeEach, describe, expect, it } from "vitest";
import {
  handleNext,
  handleStart,
  handleSubmit,
  type StartResponse,
  type NextResponse,
  type SubmitTrainingResponse,
  type SubmitPracticeResponse,
  type ApiResult,
} from "../lib/v2/api/sessionHandlers";
import { clearBundledPackCache } from "../lib/v2/packs/loadBundledPack";
import {
  clearSessionStore,
  getSessionRecord,
} from "../lib/v2/sessionStore";
import { clearSessionRegistry } from "../lib/runtime/v2SessionRegistry";

async function resetState(): Promise<void> {
  clearSessionRegistry();
  await clearSessionStore();
  clearBundledPackCache();
}

function expectOk<T extends object>(result: ApiResult<T>): T {
  expect(result.status).toBe(200);
  if ("error" in result.body) {
    throw new Error(`expected success, got ${result.body.error.code}: ${result.body.error.message}`);
  }
  return result.body;
}

function getValidAction(spot: { board: string[]; history: string[] }): string {
  if (spot.board.length === 0) return "FOLD";
  const facesBet = spot.history.some(
    (a: string) => a.startsWith("BET_") || a.startsWith("RAISE_") || a === "CALL"
  );
  return facesBet ? "FOLD" : "CHECK";
}

describe("stats integration: session record and EV loss aggregation", () => {
  const SEED = "stats-integration-seed";
  const DECISIONS = 5;

  beforeEach(async () => {
    await resetState();
  });

  it("completes a session and validates session record entries match expected stats", async () => {
    // --- Complete a full session ---
    const startResult = expectOk<StartResponse>(
      await handleStart({
        seed: SEED,
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
        decisionsPerSession: DECISIONS,
      })
    );

    const sessionId = startResult.session.sessionId;
    let currentSpot = startResult.spot;
    const expectedEvLosses: number[] = [];

    for (let i = 0; i < DECISIONS; i++) {
      const actionId = getValidAction(currentSpot);

      const submitResult = expectOk<SubmitTrainingResponse | SubmitPracticeResponse>(
        await handleSubmit({
          seed: SEED,
          sessionId,
          spot: currentSpot,
          actionId,
        })
      ) as SubmitTrainingResponse;

      expectedEvLosses.push(submitResult.result.evLossVsBest);

      if (i < DECISIONS - 1) {
        const nextResult = expectOk<NextResponse>(
          await handleNext({ seed: SEED, sessionId })
        );
        currentSpot = nextResult.spot;
      }
    }

    // --- Retrieve session record from store ---
    const record = await getSessionRecord(sessionId, SEED);
    expect(record).not.toBeNull();
    expect(record!.entries.length).toBe(DECISIONS);
    expect(record!.mode).toBe("TRAINING");
    expect(record!.packId).toBe("ev-dev-pack-v1");
    expect(record!.sessionId).toBe(sessionId);
    expect(record!.seed).toBe(SEED);

    // --- Validate every entry has valid DecisionGrade fields ---
    for (let i = 0; i < record!.entries.length; i++) {
      const entry = record!.entries[i];
      expect(entry.index).toBe(i);
      expect(entry.spotId).toBeTruthy();
      expect(entry.actionId).toBeTruthy();
      expect(entry.result).toBeDefined();

      const grade = entry.result!;
      expect(typeof grade.evUser).toBe("number");
      expect(typeof grade.evMix).toBe("number");
      expect(typeof grade.evBest).toBe("number");
      expect(typeof grade.evLossVsMix).toBe("number");
      expect(typeof grade.evLossVsBest).toBe("number");
      expect(typeof grade.pureMistake).toBe("boolean");
      expect(typeof grade.isBestAction).toBe("boolean");
      expect(typeof grade.policyDivergence).toBe("number");

      // EV loss should be non-negative
      expect(grade.evLossVsBest).toBeGreaterThanOrEqual(0);
      expect(grade.evLossVsMix).toBeGreaterThanOrEqual(0);

      // evBest should be >= evUser (best action EV is at least as good)
      expect(grade.evBest).toBeGreaterThanOrEqual(grade.evUser - 0.001); // floating point tolerance
    }

    // --- Manually compute mean EV loss and compare ---
    const entryEvLosses = record!.entries.map((e) => e.result!.evLossVsBest);

    // Entries should match what we collected during submission
    expect(entryEvLosses).toEqual(expectedEvLosses);

    const meanEvLoss =
      entryEvLosses.reduce((sum, loss) => sum + loss, 0) / entryEvLosses.length;

    // Mean should be a finite non-negative number
    expect(Number.isFinite(meanEvLoss)).toBe(true);
    expect(meanEvLoss).toBeGreaterThanOrEqual(0);

    // Manually recompute to verify
    const recomputedMean =
      expectedEvLosses.reduce((sum, loss) => sum + loss, 0) / expectedEvLosses.length;
    expect(Math.abs(meanEvLoss - recomputedMean)).toBeLessThan(0.0001);
  });

  it("entries preserve spot data for each decision", async () => {
    const startResult = expectOk<StartResponse>(
      await handleStart({
        seed: "spot-data-seed",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
        decisionsPerSession: 2,
      })
    );

    const sessionId = startResult.session.sessionId;
    let currentSpot = startResult.spot;
    const spotIds: string[] = [currentSpot.spotId];

    // Submit first decision
    await handleSubmit({
      seed: "spot-data-seed",
      sessionId,
      spot: currentSpot,
      actionId: getValidAction(currentSpot),
    });

    // Get next spot
    const nextResult = expectOk<NextResponse>(
      await handleNext({ seed: "spot-data-seed", sessionId })
    );
    currentSpot = nextResult.spot;
    spotIds.push(currentSpot.spotId);

    // Submit second decision
    await handleSubmit({
      seed: "spot-data-seed",
      sessionId,
      spot: currentSpot,
      actionId: getValidAction(currentSpot),
    });

    // Verify session record preserves spot data
    const record = await getSessionRecord(sessionId, "spot-data-seed");
    expect(record).not.toBeNull();
    expect(record!.entries.length).toBe(2);

    for (let i = 0; i < record!.entries.length; i++) {
      const entry = record!.entries[i];
      expect(entry.spotId).toBe(spotIds[i]);
      expect(entry.spot).toBeDefined();
      expect(entry.spot.spotId).toBe(spotIds[i]);
      expect(typeof entry.spot.heroToAct).toBe("string");
    }
  });
});
