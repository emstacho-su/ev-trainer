import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "./nodeTypes";
import type { SessionRecord } from "./sessionRecord";
import {
  deserializeSession,
  replayEntry,
  serializeSession,
  SessionRecordSchemaVersion,
} from "./sessionRecord";
import { gradeDecision } from "./grading";
import { mockSolve } from "./mockSolver";

function buildNode(potBb: number, toAct: "BTN" | "BB" = "BTN"): CanonicalNode {
  return {
    gameVersion: "g1",
    abstractionVersion: "a1",
    solverVersion: "s1",
    publicState: {
      street: "FLOP",
      potBb,
      effectiveStackBb: 100,
      board: ["Ah", "Kd", "7c"],
      toAct,
    },
    history: {
      actions: ["CHECK"],
    },
    toAct,
    abstraction: {
      betSizesBb: [0.5],
      raiseSizesBb: [1],
      maxRaisesPerStreet: 1,
    },
  };
}

describe("sessionRecord", () => {
  it("serializes and deserializes with schema validation", () => {
    const node = buildNode(6);
    const output = mockSolve(node);
    const grade = gradeDecision(output, "CHECK");
    const record: SessionRecord = {
      schemaVersion: SessionRecordSchemaVersion,
      sessionId: "session-1",
      seed: "seed-1",
      mode: "spot-quiz",
      startedAt: "2026-01-28T00:00:00.000Z",
      entries: [
        {
          recordId: "rec-1",
          node,
          userActionId: "CHECK",
          grade,
          metrics: {
            evUser: grade.evUser,
            evMix: grade.evMix,
            evBest: grade.evBest,
            evLossVsMix: grade.evLossVsMix,
            evLossVsBest: grade.evLossVsBest,
          },
        },
      ],
    };

    const raw = serializeSession(record);
    const parsed = deserializeSession(raw);
    expect(parsed).toEqual(record);
  });

  it("rejects unsupported schema versions", () => {
    const raw = JSON.stringify({
      schemaVersion: "0",
      sessionId: "s",
      seed: "seed",
      mode: "spot-quiz",
      startedAt: "2026-01-28T00:00:00.000Z",
      entries: [],
    });
    expect(() => deserializeSession(raw)).toThrow();
  });

  it("replays an entry deterministically", () => {
    const node = buildNode(12);
    const output = mockSolve(node);
    const grade = gradeDecision(output, "CHECK");
    const replayed = replayEntry(
      {
        recordId: "rec-2",
        node,
        userActionId: "CHECK",
        grade,
        metrics: {
          evUser: grade.evUser,
          evMix: grade.evMix,
          evBest: grade.evBest,
          evLossVsMix: grade.evLossVsMix,
          evLossVsBest: grade.evLossVsBest,
        },
      },
      { solve: mockSolve, gradeDecision }
    );

    expect(replayed).toEqual(grade);
  });
});
