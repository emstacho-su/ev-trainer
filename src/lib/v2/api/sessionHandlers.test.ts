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

function resetState() {
  clearSessionRegistry();
  clearSessionStore();
  clearBundledPackCache();
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
  beforeEach(() => {
    resetState();
  });

  it("starts training and practice sessions with spot payloads", () => {
    const training = expectSuccess<StartResponse>(
      handleStart({
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
      handleStart({
      seed: "seed-b",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
    })
    );
    expect(practice.session.mode).toBe("PRACTICE");
    expect(practice.spot.spotId).toBeTruthy();
  });

  it("next is deterministic for the same inputs across runs", () => {
    const run = () => {
      resetState();
      const start = handleStart({
        seed: "seed-a",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
      });
      const startBody = expectSuccess<StartResponse>(start);
      const submitBody = handleSubmit({
        seed: startBody.session.seed,
        sessionId: startBody.session.sessionId,
        spot: startBody.spot,
        actionId: "CHECK",
      });
      expect(submitBody.status).toBe(200);
      const nextBody = expectSuccess<NextResponse>(
        handleNext({
          seed: startBody.session.seed,
          sessionId: startBody.session.sessionId,
        })
      );
      return nextBody.spot.spotId;
    };
    const first = run();
    const second = run();
    expect(first).toBe(second);
  });

  it("submit returns grading in training and recorded ack in practice", () => {
    const trainingStart = expectSuccess<StartResponse>(handleStart({
      seed: "seed-a",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: {},
    }));
    const trainingSubmit = expectSuccess<SubmitTrainingResponse | SubmitPracticeResponse>(
      handleSubmit({
      seed: trainingStart.session.seed,
      sessionId: trainingStart.session.sessionId,
      spot: trainingStart.spot,
      actionId: "CHECK",
    })
    );
    expect("result" in trainingSubmit).toBe(true);
    if ("result" in trainingSubmit) {
      expect(trainingSubmit.result.evLossVsBest).toBeDefined();
    }

    const practiceStart = expectSuccess<StartResponse>(handleStart({
      seed: "seed-b",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
    }));
    const practiceSubmit = expectSuccess<SubmitTrainingResponse | SubmitPracticeResponse>(
      handleSubmit({
      seed: practiceStart.session.seed,
      sessionId: practiceStart.session.sessionId,
      spot: practiceStart.spot,
      actionId: "CHECK",
    })
    );
    expect("recorded" in practiceSubmit && practiceSubmit.recorded).toBe(true);
    expect("result" in practiceSubmit).toBe(false);
  });

  it("get session respects practice review gating", () => {
    const start = expectSuccess<StartResponse>(handleStart({
      seed: "seed-a",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
      decisionsPerSession: 1,
    }));
    const preCompleteDetail = expectSuccess<SessionDetailResponse>(
      handleGetSession(start.session.sessionId, start.session.seed)
    );
    expect(preCompleteDetail.reviewAvailable).toBe(false);
    expect(preCompleteDetail.entries).toBeUndefined();

    const submit = expectSuccess<SubmitPracticeResponse | SubmitTrainingResponse>(handleSubmit({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
      spot: start.spot,
      actionId: "CHECK",
    }));
    expect("recorded" in submit && submit.recorded).toBe(true);

    const completionSignal = handleNext({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
    });
    expect(completionSignal.status).toBe(409);
    const complete = expectSuccess<SessionDetailResponse>(
      handleGetSession(start.session.sessionId, start.session.seed)
    );
    expect(complete.reviewAvailable).toBe(true);
      expect(complete.entries?.length).toBeGreaterThan(0);
  });

  it("blocks training review before completion and unlocks after completion", () => {
    const start = expectSuccess<StartResponse>(
      handleStart({
        seed: "seed-training",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
        decisionsPerSession: 1,
      })
    );

    const preCompleteDetail = expectSuccess<SessionDetailResponse>(
      handleGetSession(start.session.sessionId, start.session.seed)
    );
    expect(preCompleteDetail.reviewAvailable).toBe(false);
    expect(preCompleteDetail.entries).toBeUndefined();

    const submit = expectSuccess<SubmitPracticeResponse | SubmitTrainingResponse>(
      handleSubmit({
        seed: start.session.seed,
        sessionId: start.session.sessionId,
        spot: start.spot,
        actionId: "CHECK",
      })
    );
    expect("result" in submit).toBe(true);

    const completionSignal = handleNext({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
    });
    expect(completionSignal.status).toBe(409);

    const complete = expectSuccess<SessionDetailResponse>(
      handleGetSession(start.session.sessionId, start.session.seed)
    );
    expect(complete.reviewAvailable).toBe(true);
    expect(complete.entries?.length).toBe(1);
  });

  it("submit is idempotent for same decision/action and rejects conflicting duplicates", () => {
    const start = expectSuccess<StartResponse>(
      handleStart({
        seed: "seed-idempotent",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
        decisionsPerSession: 1,
      })
    );

    const first = expectSuccess<SubmitTrainingResponse | SubmitPracticeResponse>(
      handleSubmit({
        seed: start.session.seed,
        sessionId: start.session.sessionId,
        spot: start.spot,
        actionId: "CHECK",
      })
    );
    const second = expectSuccess<SubmitTrainingResponse | SubmitPracticeResponse>(
      handleSubmit({
        seed: start.session.seed,
        sessionId: start.session.sessionId,
        spot: start.spot,
        actionId: "CHECK",
      })
    );

    expect("result" in first && "result" in second).toBe(true);
    if ("result" in first && "result" in second) {
      expect(second.result).toEqual(first.result);
    }

    const record = getSessionRecord(start.session.sessionId, start.session.seed);
    expect(record?.entries.length).toBe(1);

    const conflicting = handleSubmit({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
      spot: start.spot,
      actionId: "FOLD",
    });
    expect(conflicting.status).toBe(409);
    if (conflicting.status === 409 && "error" in conflicting.body) {
      expect(conflicting.body.error.code).toBe("DUPLICATE_SUBMIT_CONFLICT");
    }
  });

  it("requires submit before next", () => {
    const start = expectSuccess<StartResponse>(
      handleStart({
        seed: "seed-next",
        mode: "PRACTICE",
        packId: "ev-dev-pack-v1",
        filters: {},
      })
    );

    const next = handleNext({
      seed: start.session.seed,
      sessionId: start.session.sessionId,
    });
    expect(next.status).toBe(409);
    if (next.status === 409 && "error" in next.body) {
      expect(next.body.error.code).toBe("SUBMIT_REQUIRED");
    }
  });

  it("requires seed for session reads", () => {
    const start = expectSuccess<StartResponse>(
      handleStart({
        seed: "seed-read",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
      })
    );

    const missingSeed = handleGetSession(start.session.sessionId, null);
    expect(missingSeed.status).toBe(400);
    if (missingSeed.status === 400 && "error" in missingSeed.body) {
      expect(missingSeed.body.error.code).toBe("INVALID_ARGUMENT");
    }

    const wrongSeed = handleGetSession(start.session.sessionId, "seed-other");
    expect(wrongSeed.status).toBe(404);
    if (wrongSeed.status === 404 && "error" in wrongSeed.body) {
      expect(wrongSeed.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("invalid input returns stable error schema", () => {
    const response = handleStart({ mode: "TRAINING" });
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
