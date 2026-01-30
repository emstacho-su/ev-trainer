import { beforeEach, describe, expect, it } from "vitest";
import { handleGetSession, handleNext, handleStart, handleSubmit } from "./sessionHandlers";
import { advanceSession, clearSessionRegistry } from "../../runtime/v2SessionRegistry";
import { clearSessionStore } from "../sessionStore";
import { clearBundledPackCache } from "../packs/loadBundledPack";

function resetState() {
  clearSessionRegistry();
  clearSessionStore();
  clearBundledPackCache();
}

describe("v2 session handlers", () => {
  beforeEach(() => {
    resetState();
  });

  it("starts training and practice sessions with spot payloads", () => {
    const training = handleStart({
      seed: "seed-a",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: {},
    });
    expect(training.status).toBe(200);
    if (training.status === 200) {
      expect(training.body.ok).toBe(true);
      expect(training.body.session.mode).toBe("TRAINING");
      expect(training.body.session.seed).toBe("seed-a");
      expect(training.body.spot.spotId).toBeTruthy();
    }

    const practice = handleStart({
      seed: "seed-b",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
    });
    expect(practice.status).toBe(200);
    if (practice.status === 200) {
      expect(practice.body.session.mode).toBe("PRACTICE");
      expect(practice.body.spot.spotId).toBeTruthy();
    }
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
      if (start.status !== 200) throw new Error("start failed");
      const next = handleNext({
        seed: start.body.session.seed,
        sessionId: start.body.session.sessionId,
      });
      if (next.status !== 200) throw new Error("next failed");
      return next.body.spot.spotId;
    };
    const first = run();
    const second = run();
    expect(first).toBe(second);
  });

  it("submit returns grading in training and recorded ack in practice", () => {
    const trainingStart = handleStart({
      seed: "seed-a",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: {},
    });
    if (trainingStart.status !== 200) throw new Error("training start failed");
    const trainingSubmit = handleSubmit({
      seed: trainingStart.body.session.seed,
      sessionId: trainingStart.body.session.sessionId,
      spot: trainingStart.body.spot,
      actionId: "CHECK",
    });
    expect(trainingSubmit.status).toBe(200);
    if (trainingSubmit.status === 200) {
      expect("result" in trainingSubmit.body).toBe(true);
      expect((trainingSubmit.body as any).result.evLossVsBest).toBeDefined();
    }

    const practiceStart = handleStart({
      seed: "seed-b",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
    });
    if (practiceStart.status !== 200) throw new Error("practice start failed");
    const practiceSubmit = handleSubmit({
      seed: practiceStart.body.session.seed,
      sessionId: practiceStart.body.session.sessionId,
      spot: practiceStart.body.spot,
      actionId: "CHECK",
    });
    expect(practiceSubmit.status).toBe(200);
    if (practiceSubmit.status === 200) {
      expect((practiceSubmit.body as any).recorded).toBe(true);
      expect("result" in practiceSubmit.body).toBe(false);
    }
  });

  it("get session respects practice review gating", () => {
    const start = handleStart({
      seed: "seed-a",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
      decisionsPerSession: 1,
    });
    if (start.status !== 200) throw new Error("start failed");
    const submit = handleSubmit({
      seed: start.body.session.seed,
      sessionId: start.body.session.sessionId,
      spot: start.body.spot,
      actionId: "CHECK",
    });
    expect(submit.status).toBe(200);

    const detail = handleGetSession(start.body.session.sessionId, start.body.session.seed);
    expect(detail.status).toBe(200);
    if (detail.status === 200) {
      expect(detail.body.reviewAvailable).toBe(false);
      expect(detail.body.entries).toBeUndefined();
    }

    advanceSession(start.body.session.sessionId, start.body.session.seed);
    const complete = handleGetSession(start.body.session.sessionId, start.body.session.seed);
    expect(complete.status).toBe(200);
    if (complete.status === 200) {
      expect(complete.body.reviewAvailable).toBe(true);
      expect(complete.body.entries?.length).toBeGreaterThan(0);
    }
  });

  it("invalid input returns stable error schema", () => {
    const response = handleStart({ mode: "TRAINING" });
    expect(response.status).toBe(400);
    if (response.status === 400) {
      expect(response.body.error.code).toBeTruthy();
      expect(response.body.error.message).toBeTruthy();
    }
  });
});
