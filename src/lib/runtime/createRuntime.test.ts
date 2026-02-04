// src/lib/runtime/createRuntime.test.ts

import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CanonicalNode } from "../engine/nodeTypes";
import type { SolverNodeOutput } from "../engine/solverAdapter";
import { createRuntime } from "./createRuntime";

function makeNode(potBb: number): CanonicalNode {
  return {
    gameVersion: "test-game",
    abstractionVersion: "test-abstraction",
    solverVersion: "openspiel:1.0.0",
    publicState: {
      street: "FLOP",
      potBb,
      effectiveStackBb: 100,
      board: ["Ah", "Kd", "2c"],
      toAct: "BTN",
    },
    history: {
      actions: ["CHECK"],
    },
    toAct: "BTN",
    abstraction: {
      betSizesBb: [7.5],
      raiseSizesBb: [],
      maxRaisesPerStreet: 1,
    },
  };
}

describe("createRuntime", () => {
  it("uses openspiel provider by default when no custom solver is provided", () => {
    const runtime = createRuntime({
      seed: "seed:provider",
      sessionId: "session:provider",
    });

    const out = runtime.solve(makeNode(10));
    expect(out.nodeId?.startsWith("openspiel:")).toBe(true);
    expect(out.meta?.provider).toBe("openspiel");
    expect(out.meta?.source).toBe("live");
  });

  it("routes spot-quiz through openspiel runtime boundary without UI coupling", () => {
    const runtime = createRuntime({
      seed: "seed:runtime",
      sessionId: "session:runtime",
      now: () => "2026-02-04T00:00:00.000Z",
      openSpielTimeoutMs: 100,
      openSpielTransport: {
        solve: (request) => ({
          provider: "openspiel",
          nodeHash: request.nodeHash,
          actions: [
            { actionId: "CHECK", action: "check", frequency: 7, ev: 1.2 },
            { actionId: "BET_75PCT", action: "bet", sizeBb: 7.5, frequency: 3, ev: 0.4 },
          ],
          meta: {
            source: "live",
            solveMs: 4,
            solvedAt: "2026-02-04T00:00:00.000Z",
          },
        }),
      },
    });

    const result = runtime.trainingApi.spotQuiz({
      node: makeNode(10),
      userActionId: "CHECK",
    });

    expect(result.output.status).toBe("ok");
    expect(result.output.meta?.provider).toBe("openspiel");
    expect(result.output.meta?.source).toBe("live");
    expect(result.output.meta?.solveMs).toBe(4);
    expect(result.output.meta?.nodeHash).toBe(result.nodeHash);
  });

  it("uses persistent cache across runtime re-creation and invalidates on version change", () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "ev-trainer-p1t8-"));
    const cacheFile = join(cacheDir, "openspiel-cache.json");
    let calls = 0;
    const transport = {
      solve: (request: { nodeHash: string }) => {
        calls += 1;
        return {
          provider: "openspiel" as const,
          nodeHash: request.nodeHash,
          actions: [
            { actionId: "CHECK", action: "check" as const, frequency: 0.7, ev: 1.2 },
            { actionId: "BET_75PCT", action: "bet" as const, sizeBb: 7.5, frequency: 0.3, ev: 0.4 },
          ],
          meta: { source: "live" as const, solveMs: 3, solvedAt: "2026-02-04T00:00:00.000Z" },
        };
      },
    };

    try {
      const runtimeA = createRuntime({
        seed: "seed:persist-a",
        sessionId: "session:persist-a",
        openSpielTransport: transport,
        openSpielPersistentCachePath: cacheFile,
      });

      const aMiss = runtimeA.trainingApi.spotQuiz({
        node: makeNode(10),
        userActionId: "CHECK",
      });
      const aHit = runtimeA.trainingApi.spotQuiz({
        node: makeNode(10),
        userActionId: "CHECK",
      });
      expect(aMiss.output.meta?.source).toBe("live");
      expect(aHit.output.meta?.source).toBe("cache");

      const runtimeB = createRuntime({
        seed: "seed:persist-b",
        sessionId: "session:persist-b",
        openSpielTransport: transport,
        openSpielPersistentCachePath: cacheFile,
      });
      const bPersistentHit = runtimeB.trainingApi.spotQuiz({
        node: makeNode(10),
        userActionId: "CHECK",
      });
      expect(bPersistentHit.output.meta?.source).toBe("cache");

      const versionChangedNode: CanonicalNode = {
        ...makeNode(10),
        abstractionVersion: "test-abstraction-v2",
      };
      const bVersionMiss = runtimeB.trainingApi.spotQuiz({
        node: versionChangedNode,
        userActionId: "CHECK",
      });
      expect(bVersionMiss.output.meta?.source).toBe("live");
      expect(calls).toBe(2);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it("blocks runtime creation when legal approval is not granted", () => {
    expect(() =>
      createRuntime({
        seed: "seed:blocked",
        sessionId: "session:blocked",
        legalApproved: false,
      })
    ).toThrow("LICENSE_BLOCKED");
  });

  it("records deterministic snapshots and sorts review list by EV loss desc", () => {
    const timestamps = [
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:01.000Z",
    ];
    let tsIndex = 0;
    const now = () => timestamps[Math.min(tsIndex++, timestamps.length - 1)];

    const solve = (node: CanonicalNode): SolverNodeOutput => {
      if (node.publicState.potBb === 10) {
        return {
          status: "ok",
          units: "bb",
          actions: [
            { actionId: "CHECK", frequency: 0.7, ev: 1.0 },
            { actionId: "BET_75PCT", frequency: 0.3, ev: 0.2 },
          ],
        };
      }
      if (node.publicState.potBb === 20) {
        return {
          status: "ok",
          units: "bb",
          actions: [
            { actionId: "CHECK", frequency: 0.5, ev: 0.5 },
            { actionId: "BET_75PCT", frequency: 0.5, ev: -0.5 },
          ],
        };
      }
      throw new Error("unexpected node");
    };

    const runtime = createRuntime({
      seed: "seed:test",
      sessionId: "session:test",
      now,
      solve,
    });

    const first = runtime.trainingApi.spotQuiz({
      node: makeNode(10),
      userActionId: "BET_75PCT",
    });
    const second = runtime.trainingApi.spotQuiz({
      node: makeNode(20),
      userActionId: "BET_75PCT",
    });

    const review = runtime.trainingApi.reviewList({ sessionId: "session:test" });

    expect(review.items).toHaveLength(2);
    expect(review.items[0].grade.evLossVsMix).toBeCloseTo(0.56, 6);
    expect(review.items[1].grade.evLossVsMix).toBeCloseTo(0.5, 6);

    expect(first.record.recordId).toBeDefined();
    expect(first.record.createdSeq).toBe(1);
    expect(first.record.runtimeKey).toBe("seed:test::session:test");
    expect(first.record.request.mode).toBe("spot-quiz");
    expect(first.record.metrics.evLossVsMix).toBeCloseTo(first.record.grade.evLossVsMix, 6);
    expect(second.record.createdSeq).toBe(2);
  });

  it("breaks EV loss ties by createdSeq asc then recordId asc", () => {
    const runtime = createRuntime({
      seed: "seed:tie",
      sessionId: "session:tie",
      now: () => "2026-01-01T00:00:00.000Z",
      solve: () => ({
        status: "ok",
        units: "bb",
        actions: [
          { actionId: "CHECK", frequency: 0.5, ev: 1.0 },
          { actionId: "BET_75PCT", frequency: 0.5, ev: 1.0 },
        ],
      }),
    });

    const a = runtime.trainingApi.spotQuiz({
      node: makeNode(10),
      userActionId: "CHECK",
    });
    const b = runtime.trainingApi.spotQuiz({
      node: makeNode(10),
      userActionId: "BET_75PCT",
    });

    const review = runtime.trainingApi.reviewList({ sessionId: "session:tie" });
    expect(review.items.map((item) => item.recordId)).toEqual([a.record.recordId, b.record.recordId]);
  });
});
