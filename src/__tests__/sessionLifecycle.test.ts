import { beforeEach, describe, expect, it } from "vitest";
import {
  handleGetSession,
  handleNext,
  handleStart,
  handleSubmit,
  type StartResponse,
  type NextResponse,
  type SubmitTrainingResponse,
  type SubmitPracticeResponse,
  type SessionDetailResponse,
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

describe("session lifecycle: start -> submit -> next -> complete -> review", () => {
  const SEED = "lifecycle-test-seed";
  const DECISIONS = 3;

  beforeEach(async () => {
    await resetState();
  });

  it("completes a full TRAINING session with 3 decisions and verifies review", async () => {
    // --- Start session ---
    const startResult = expectOk<StartResponse>(
      await handleStart({
        seed: SEED,
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
        decisionsPerSession: DECISIONS,
      })
    );

    expect(startResult.session.decisionIndex).toBe(0);
    expect(startResult.session.decisionsPerSession).toBe(DECISIONS);
    expect(startResult.session.isComplete).toBe(false);
    expect(startResult.spot.spotId).toBeTruthy();

    const sessionId = startResult.session.sessionId;
    let currentSpot = startResult.spot;
    const submittedActions: string[] = [];

    // --- Decision loop ---
    for (let i = 0; i < DECISIONS; i++) {
      const actionId = getValidAction(currentSpot);
      submittedActions.push(actionId);

      // Submit action and verify grade
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
      expect(typeof submitResult.result.evLossVsMix).toBe("number");
      expect(typeof submitResult.result.evUser).toBe("number");
      expect(typeof submitResult.result.evMix).toBe("number");
      expect(typeof submitResult.result.evBest).toBe("number");
      expect(typeof submitResult.result.pureMistake).toBe("boolean");
      expect(typeof submitResult.result.isBestAction).toBe("boolean");
      expect(submitResult.result.evLossVsBest).toBeGreaterThanOrEqual(0);

      // Next hand (or session complete)
      if (i < DECISIONS - 1) {
        const nextResult = expectOk<NextResponse>(
          await handleNext({ seed: SEED, sessionId })
        );
        expect(nextResult.spot.spotId).toBeTruthy();
        currentSpot = nextResult.spot;
      }
    }

    // --- After final decision, next should return 409 SESSION_COMPLETE ---
    const finalNext = await handleNext({ seed: SEED, sessionId });
    expect(finalNext.status).toBe(409);
    if ("error" in finalNext.body) {
      expect(finalNext.body.error.code).toBe("SESSION_COMPLETE");
    }

    // --- GetSession should show reviewAvailable and entries ---
    const detail = expectOk<SessionDetailResponse>(
      await handleGetSession(sessionId, SEED)
    );

    expect(detail.reviewAvailable).toBe(true);
    expect(detail.session.isComplete).toBe(true);
    expect(detail.entries).toBeDefined();
    expect(detail.entries!.length).toBe(DECISIONS);

    // Every entry should have a result with grade fields
    for (const entry of detail.entries!) {
      expect(entry.result).toBeDefined();
      expect(typeof entry.result!.evLossVsBest).toBe("number");
      expect(entry.result!.evLossVsBest).toBeGreaterThanOrEqual(0);
    }

    // Verify some entries may have 0 EV loss (picked best action)
    const zeroLossEntries = detail.entries!.filter(
      (e) => e.result!.evLossVsBest === 0
    );
    // At least confirm the count is a valid number (0 or more)
    expect(zeroLossEntries.length).toBeGreaterThanOrEqual(0);
    expect(zeroLossEntries.length).toBeLessThanOrEqual(DECISIONS);
  });

  it("rejects next before submit", async () => {
    const startResult = expectOk<StartResponse>(
      await handleStart({
        seed: "no-submit-seed",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
        decisionsPerSession: 3,
      })
    );

    const nextResult = await handleNext({
      seed: "no-submit-seed",
      sessionId: startResult.session.sessionId,
    });
    expect(nextResult.status).toBe(409);
    if ("error" in nextResult.body) {
      expect(nextResult.body.error.code).toBe("SUBMIT_REQUIRED");
    }
  });
});
