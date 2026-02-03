import { beforeEach, describe, expect, it } from "vitest";
import {
  handleGetSession,
  handleNext,
  handleStart,
  handleSubmit,
  type ApiResult,
} from "./sessionHandlers";
import { advanceSession, clearSessionRegistry } from "../../runtime/v2SessionRegistry";
import { clearSessionStore } from "../sessionStore";
import { clearBundledPackCache } from "../packs/loadBundledPack";

function resetState() {
  clearSessionRegistry();
  clearSessionStore();
  clearBundledPackCache();
}

function expectSuccess<T>(result: ApiResult<T>): T {
  expect(result.status).toBe(200);
  if (result.status !== 200) {
    throw new Error(`expected success but got ${result.status}`);
  }
  return result.body as T;
}

describe("v2 session handlers", () => {
  beforeEach(() => {
    resetState();
  });

  it("starts training and practice sessions with spot payloads", () => {
    const training = expectSuccess(
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

    const practice = expectSuccess(
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
      const start = expectSuccess(
        handleStart({
          seed: "seed-a",
          mode: "TRAINING",
          packId: "ev-dev-pack-v1",
          filters: {},
        })
      );
      const next = expectSuccess(
        handleNext({
          seed: start.session.seed,
          sessionId: start.session.sessionId,
        })
      );
      return next.spot.spotId;
    };

    const first = run();
    const second = run();
    expect(first).toBe(second);
  });

  it("submit returns grading in training and recorded ack in practice", () => {
    const trainingStart = expectSuccess(
      handleStart({
        seed: "seed-a",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
      })
    );
    const trainingSubmit = expectSuccess(
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

    const practiceStart = expectSuccess(
      handleStart({
        seed: "seed-b",
        mode: "PRACTICE",
        packId: "ev-dev-pack-v1",
        filters: {},
      })
    );
    const practiceSubmit = expectSuccess(
      handleSubmit({
        seed: practiceStart.session.seed,
        sessionId: practiceStart.session.sessionId,
        spot: practiceStart.spot,
        actionId: "CHECK",
      })
    );
    expect("recorded" in practiceSubmit).toBe(true);
    expect("result" in practiceSubmit).toBe(false);
  });

  it("get session respects practice review gating", () => {
    const start = expectSuccess(
      handleStart({
        seed: "seed-a",
        mode: "PRACTICE",
        packId: "ev-dev-pack-v1",
        filters: {},
        decisionsPerSession: 1,
      })
    );

    expectSuccess(
      handleSubmit({
        seed: start.session.seed,
        sessionId: start.session.sessionId,
        spot: start.spot,
        actionId: "CHECK",
      })
    );

    const detail = expectSuccess(handleGetSession(start.session.sessionId, start.session.seed));
    expect(detail.reviewAvailable).toBe(false);
    expect(detail.entries).toBeUndefined();

    advanceSession(start.session.sessionId, start.session.seed);
    const complete = expectSuccess(
      handleGetSession(start.session.sessionId, start.session.seed)
    );
    expect(complete.reviewAvailable).toBe(true);
    expect(complete.entries?.length).toBeGreaterThan(0);
  });

  it("invalid input returns stable error schema", () => {
    const response = handleStart({ mode: "TRAINING" });
    expect(response.status).toBe(400);
    if (response.status !== 400) {
      throw new Error("expected invalid argument response");
    }
    if (!("error" in response.body)) {
      throw new Error("expected error response body");
    }
    expect(response.body.error.code).toBeTruthy();
    expect(response.body.error.message).toBeTruthy();
  });
});
