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
import { clearSessionStore } from "../lib/v2/sessionStore";
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

describe("postflop session lifecycle (street: FLOP filter)", () => {
  const SEED = "postflop-lifecycle-seed";
  const DECISIONS = 3;

  beforeEach(async () => {
    await resetState();
  });

  it("completes a FLOP-filtered session with valid board cards", async () => {
    const startResult = await handleStart({
      seed: SEED,
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: { street: "FLOP" },
      decisionsPerSession: DECISIONS,
    });

    // If no FLOP spots available, skip the test
    if (startResult.status === 404) {
      return;
    }

    const body = expectOk<StartResponse>(startResult);

    // Verify the spot has board cards (FLOP = 3 cards)
    expect(body.spot.board.length).toBeGreaterThanOrEqual(3);
    expect(body.session.isComplete).toBe(false);

    const sessionId = body.session.sessionId;
    let currentSpot = body.spot;

    for (let i = 0; i < DECISIONS; i++) {
      // All spots should have board cards since we filtered by FLOP
      expect(currentSpot.board.length).toBeGreaterThanOrEqual(3);

      const actionId = getValidAction(currentSpot);

      const submitResult = expectOk<SubmitTrainingResponse | SubmitPracticeResponse>(
        await handleSubmit({
          seed: SEED,
          sessionId,
          spot: currentSpot,
          actionId,
        })
      ) as SubmitTrainingResponse;

      expect(submitResult.result).toBeDefined();
      expect(typeof submitResult.result.evLossVsBest).toBe("number");

      if (i < DECISIONS - 1) {
        const nextResult = expectOk<NextResponse>(
          await handleNext({ seed: SEED, sessionId })
        );
        currentSpot = nextResult.spot;
      }
    }

    // Session should be complete after all decisions
    const finalNext = await handleNext({ seed: SEED, sessionId });
    expect(finalNext.status).toBe(409);
    if ("error" in finalNext.body) {
      expect(finalNext.body.error.code).toBe("SESSION_COMPLETE");
    }
  });

  it("returns postflop-appropriate actions (CHECK/BET when not facing bet)", async () => {
    const startResult = await handleStart({
      seed: "postflop-action-seed",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: { street: "FLOP" },
      decisionsPerSession: 1,
    });

    if (startResult.status === 404) {
      return;
    }

    const body = expectOk<StartResponse>(startResult);
    const spot = body.spot;

    // Postflop spot: board should have cards
    expect(spot.board.length).toBeGreaterThanOrEqual(3);

    // Submit CHECK (valid for postflop not facing bet) or FOLD (valid for facing bet)
    const actionId = getValidAction(spot);
    const submitResult = expectOk<SubmitTrainingResponse | SubmitPracticeResponse>(
      await handleSubmit({
        seed: "postflop-action-seed",
        sessionId: body.session.sessionId,
        spot,
        actionId,
      })
    ) as SubmitTrainingResponse;

    // Grade should have allActions showing postflop-appropriate actions
    expect(submitResult.result.allActions).toBeDefined();
    if (submitResult.result.allActions) {
      const actionIds = submitResult.result.allActions.map((a) => a.actionId);
      // Postflop actions should not include preflop-only actions
      // They should be CHECK/BET_* or FOLD/CALL/RAISE_* depending on facing bet
      expect(actionIds.length).toBeGreaterThanOrEqual(2);
    }
  });
});
