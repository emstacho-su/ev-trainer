// src/lib/engine/solverTelemetry.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  recordSolverEvent,
  onSolverEvent,
  getSolverHistory,
  resetSolverTelemetry,
} from "./solverTelemetry";

describe("solverTelemetry", () => {
  beforeEach(() => {
    resetSolverTelemetry();
  });

  it("records events with a timestamp", () => {
    recordSolverEvent({ path: "wasm", street: "FLOP" });
    const history = getSolverHistory();
    expect(history).toHaveLength(1);
    expect(history[0].path).toBe("wasm");
    expect(history[0].street).toBe("FLOP");
    expect(typeof history[0].timestamp).toBe("number");
  });

  it("fires listeners with each event", () => {
    const seen: string[] = [];
    const unsub = onSolverEvent((event) => seen.push(event.path));

    recordSolverEvent({ path: "wasm", street: "TURN" });
    recordSolverEvent({ path: "mock-fallback-unavailable", street: "RIVER" });

    expect(seen).toEqual(["wasm", "mock-fallback-unavailable"]);
    unsub();
  });

  it("logs warning when WASM fallback fails (dev mode)", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      recordSolverEvent({
        path: "mock-fallback-failed",
        street: "FLOP",
        error: "boom",
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toContain("WASM solve failed");
      expect(spy.mock.calls[0][0]).toContain("boom");
    } finally {
      spy.mockRestore();
    }
  });

  it("throws when EV_TRAINER_STRICT_SOLVER=1", () => {
    const orig = process.env.EV_TRAINER_STRICT_SOLVER;
    process.env.EV_TRAINER_STRICT_SOLVER = "1";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(() =>
        recordSolverEvent({
          path: "mock-fallback-failed",
          street: "FLOP",
          error: "kaboom",
        }),
      ).toThrow(/WASM solve failed/);
    } finally {
      if (orig === undefined) delete process.env.EV_TRAINER_STRICT_SOLVER;
      else process.env.EV_TRAINER_STRICT_SOLVER = orig;
      spy.mockRestore();
    }
  });

  it("resets history between tests", () => {
    recordSolverEvent({ path: "wasm", street: "FLOP" });
    recordSolverEvent({ path: "wasm", street: "TURN" });
    expect(getSolverHistory()).toHaveLength(2);
    resetSolverTelemetry();
    expect(getSolverHistory()).toHaveLength(0);
  });

  it("bounds history to prevent unbounded growth", () => {
    for (let i = 0; i < 150; i++) {
      recordSolverEvent({ path: "wasm", street: "FLOP" });
    }
    expect(getSolverHistory().length).toBeLessThanOrEqual(100);
  });

  it("listener errors do not break recording", () => {
    const goodSeen: string[] = [];
    const unsub1 = onSolverEvent(() => {
      throw new Error("listener boom");
    });
    const unsub2 = onSolverEvent((event) => goodSeen.push(event.path));

    expect(() =>
      recordSolverEvent({ path: "wasm", street: "RIVER" }),
    ).not.toThrow();
    expect(goodSeen).toEqual(["wasm"]);

    unsub1();
    unsub2();
  });
});
