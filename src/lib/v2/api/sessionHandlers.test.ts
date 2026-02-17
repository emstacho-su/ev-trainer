import { beforeEach, describe, expect, it } from "vitest";
import {
  handleGetSession,
  handleNext,
  handleStart,
  handleSubmit,
  type NextResponse,
  type SessionDetailResponse,
  type StartResponse,
  type SubmitPracticeResponse,
  type SubmitTrainingResponse,
} from "./sessionHandlers";
import { clearSessionRegistry } from "../../runtime/v2SessionRegistry";
import { clearSessionStore, getSessionRecord } from "../sessionStore";
import { clearBundledPackCache } from "../packs/loadBundledPack";

async function resetState() {
  clearSessionRegistry();
  await clearSessionStore();
  clearBundledPackCache();
}

/** Pick an action that the mock solver will accept for this spot. */
function getValidAction(spot: { board: string[]; history: string[] }): string {
  if (spot.board.length === 0) return "FOLD";
  const facesBet = spot.history.some(
    (a: string) => a.startsWith("BET_") || a.startsWith("RAISE_") || a === "CALL"
  );
  return facesBet ? "FOLD" : "CHECK";
}

function expectSuccess<T extends object>(result: {
  status: number;
  body: T | { error: unknown };
}): T {
  expect(result.status).toBe(200);
  if (typeof result.body === "object" && result.body !== null && "error" in result.body) {
    throw new Error("expected success response");
  }
  return result.body;
}

describe("v2 session handlers", () => {
  beforeEach(async () => {
    await resetState();
  });

  it("starts training and practice sessions with spot payloads", async () => {
    const training = expectSuccess<StartResponse>(
      await handleStart({
      seed: "seed-a",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: {},
    })
    );
    expect(training.ok).toBe(true);
    expect(training.session.mode).toBe("TRAINING");
    expect(training.session.seed).toBe("seed-a");
    expect(training.spot.spotId).toBeTruthy();

    const practice = expectSuccess<StartResponse>(
      await handleStart({
      seed: "seed-b",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
    })
    );
    expect(practice.session.mode).toBe("PRACTICE");
    expect(practice.spot.spotId).toBeTruthy();
  });

  it("next is deterministic for the same inputs across runs", async () => {
    const run = async () => {
      await resetState();
      const start = await handleStart({
        seed: "seed-a",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
      });
      const startBody = expectSuccess<StartResponse>(start);
      const submitBody = await handleSubmit({
        seed: startBody.session.seed,
        sessionId: startBody.session.sessionId,
        spot: startBody.spot,
        actionId: getValidAction(startBody.spot),
      });
      expect(submitBody.status).toBe(200);
      const nextBody = expectSuccess<NextResponse>(
        await handleNext({
          seed: startBody.session.seed,
          sessionId: startBody.session.sessionId,
        })
      );
      return nextBody.spot.spotId;
    };
    const first = await run();
    const second = await run();
    expect(first).toBe(second);
  });

  it("submit returns grading in training and recorded ack in practice", async () => {
    const trainingStart = expectSuccess<StartResponse>(await handleStart({
      seed: "seed-a",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: {},
    }));
    const trainingSubmit = expectSuccess<SubmitTrainingResponse | SubmitPracticeResponse>(
      await handleSubmit({
      seed: trainingStart.session.seed,
      sessionId: trainingStart.session.sessionId,
      spot: trainingStart.spot,
      actionId: getValidAction(trainingStart.spot),
    })
    );
    expect("result" in trainingSubmit).toBe(true);
    if ("result" in trainingSubmit) {
      expect(trainingSubmit.result.evLossVsBest).toBeDefined();
    }

    const practiceStart = expectSuccess<StartResponse>(await handleStart({
      seed: "seed-b",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
    }));
    const practiceSubmit = expectSuccess<SubmitTrainingResponse | SubmitPracticeResponse>(
      await handleSubmit({
      seed: practiceStart.session.seed,
      sessionId: practiceStart.session.sessionId,
      spot: practiceStart.spot,
      actionId: getValidAction(practiceStart.spot),
    })
    );
    expect("recorded" in practiceSubmit && practiceSubmit.recorded).toBe(true);
    expect("result" in practiceSubmit).toBe(false);
  });

  it("get session respects practice review gating", async () => {
    const start = expectSuccess<StartResponse>(await handleStart({
      seed: "seed-a",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
      decisionsPerSession: 1,
    }));
    const preCompleteDetail = expectSuccess<SessionDetailResponse>(
      await handleGetSession(start.session.sessionId, start.session.seed)
    );
    expect(preCompleteDetail.reviewAvailable).toBe(false);
    expect(preCompleteDetail.entries).toBeUndefined();

    const submit = expectSuccess<SubmitPracticeResponse | SubmitTrainingResponse>(await handleSubmit({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
      spot: start.spot,
      actionId: getValidAction(start.spot),
    }));
    expect("recorded" in submit && submit.recorded).toBe(true);

    const completionSignal = await handleNext({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
    });
    expect(completionSignal.status).toBe(409);
    const complete = expectSuccess<SessionDetailResponse>(
      await handleGetSession(start.session.sessionId, start.session.seed)
    );
    expect(complete.reviewAvailable).toBe(true);
      expect(complete.entries?.length).toBeGreaterThan(0);
  });

  it("blocks training review before completion and unlocks after completion", async () => {
    const start = expectSuccess<StartResponse>(
      await handleStart({
        seed: "seed-training",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
        decisionsPerSession: 1,
      })
    );

    const preCompleteDetail = expectSuccess<SessionDetailResponse>(
      await handleGetSession(start.session.sessionId, start.session.seed)
    );
    expect(preCompleteDetail.reviewAvailable).toBe(false);
    expect(preCompleteDetail.entries).toBeUndefined();

    const submit = expectSuccess<SubmitPracticeResponse | SubmitTrainingResponse>(
      await handleSubmit({
        seed: start.session.seed,
        sessionId: start.session.sessionId,
        spot: start.spot,
        actionId: getValidAction(start.spot),
      })
    );
    expect("result" in submit).toBe(true);

    const completionSignal = await handleNext({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
    });
    expect(completionSignal.status).toBe(409);

    const complete = expectSuccess<SessionDetailResponse>(
      await handleGetSession(start.session.sessionId, start.session.seed)
    );
    expect(complete.reviewAvailable).toBe(true);
    expect(complete.entries?.length).toBe(1);
  });

  it("submit is idempotent for same decision/action and rejects conflicting duplicates", async () => {
    const start = expectSuccess<StartResponse>(
      await handleStart({
        seed: "seed-idempotent",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
        decisionsPerSession: 1,
      })
    );

    const idempotentAction = getValidAction(start.spot);
    const first = expectSuccess<SubmitTrainingResponse | SubmitPracticeResponse>(
      await handleSubmit({
        seed: start.session.seed,
        sessionId: start.session.sessionId,
        spot: start.spot,
        actionId: idempotentAction,
      })
    );
    const second = expectSuccess<SubmitTrainingResponse | SubmitPracticeResponse>(
      await handleSubmit({
        seed: start.session.seed,
        sessionId: start.session.sessionId,
        spot: start.spot,
        actionId: idempotentAction,
      })
    );

    expect("result" in first && "result" in second).toBe(true);
    if ("result" in first && "result" in second) {
      expect(second.result).toEqual(first.result);
    }

    const record = await getSessionRecord(start.session.sessionId, start.session.seed);
    expect(record?.entries.length).toBe(1);

    const conflictingAction = idempotentAction === "FOLD" ? "CALL" : "FOLD";
    const conflicting = await handleSubmit({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
      spot: start.spot,
      actionId: conflictingAction,
    });
    expect(conflicting.status).toBe(409);
    if (conflicting.status === 409 && "error" in conflicting.body) {
      expect(conflicting.body.error.code).toBe("DUPLICATE_SUBMIT_CONFLICT");
    }
  });

  it("requires submit before next", async () => {
    const start = expectSuccess<StartResponse>(
      await handleStart({
        seed: "seed-next",
        mode: "PRACTICE",
        packId: "ev-dev-pack-v1",
        filters: {},
      })
    );

    const next = await handleNext({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
    });
    expect(next.status).toBe(409);
    if (next.status === 409 && "error" in next.body) {
      expect(next.body.error.code).toBe("SUBMIT_REQUIRED");
    }
  });

  it("requires seed for session reads", async () => {
    const start = expectSuccess<StartResponse>(
      await handleStart({
        seed: "seed-read",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
      })
    );

    const missingSeed = await handleGetSession(start.session.sessionId, null);
    expect(missingSeed.status).toBe(400);
    if (missingSeed.status === 400 && "error" in missingSeed.body) {
      expect(missingSeed.body.error.code).toBe("INVALID_ARGUMENT");
    }

    const wrongSeed = await handleGetSession(start.session.sessionId, "seed-other");
    expect(wrongSeed.status).toBe(404);
    if (wrongSeed.status === 404 && "error" in wrongSeed.body) {
      expect(wrongSeed.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("invalid input returns stable error schema", async () => {
    const response = await handleStart({ mode: "TRAINING" });
    expect(response.status).toBe(400);
    if (response.status === 400) {
      expect("error" in response.body).toBe(true);
      if ("error" in response.body) {
        expect(response.body.error.code).toBeTruthy();
        expect(response.body.error.message).toBeTruthy();
      }
    }
  });
});
