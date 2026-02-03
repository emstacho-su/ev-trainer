import { describe, expect, it, beforeEach } from "vitest";
import {
  advanceSession,
  clearSessionRegistry,
  createSession,
  getDefaultDecisionsPerSession,
  getSession,
} from "./v2SessionRegistry";

describe("v2SessionRegistry", () => {
  beforeEach(() => {
    clearSessionRegistry();
  });

  it("creates and retrieves sessions by seed + sessionId", () => {
    const created = createSession({ sessionId: "s1", seed: "seed-a" });
    expect(created.decisionIndex).toBe(0);
    expect(created.decisionsPerSession).toBe(getDefaultDecisionsPerSession());

    const loaded = getSession("s1", "seed-a");
    expect(loaded).not.toBeNull();
    expect(loaded?.sessionId).toBe("s1");
  });

  it("treats same sessionId with different seed as distinct", () => {
    createSession({ sessionId: "s1", seed: "seed-a" });
    createSession({ sessionId: "s1", seed: "seed-b", decisionsPerSession: 5 });
    const a = getSession("s1", "seed-a");
    const b = getSession("s1", "seed-b");
    expect(a?.decisionsPerSession).toBe(getDefaultDecisionsPerSession());
    expect(b?.decisionsPerSession).toBe(5);
  });

  it("advances decisionIndex and enforces end condition", () => {
    createSession({ sessionId: "s1", seed: "seed-a", decisionsPerSession: 2 });
    const first = advanceSession("s1", "seed-a");
    expect(first.decisionIndex).toBe(1);
    expect(first.isComplete).toBe(false);

    const second = advanceSession("s1", "seed-a");
    expect(second.decisionIndex).toBe(2);
    expect(second.isComplete).toBe(true);

    expect(() => advanceSession("s1", "seed-a")).toThrow(/complete/i);
  });
});
