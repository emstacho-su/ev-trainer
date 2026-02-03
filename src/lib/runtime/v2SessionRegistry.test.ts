import { describe, expect, it, beforeEach } from "vitest";
import {
  advanceSession,
  clearSessionRegistry,
  createSession,
  getDefaultDecisionsPerSession,
  getSession,
  setV2SessionRegistryBackend,
  type V2SessionRegistryBackend,
} from "./v2SessionRegistry";

class TestRegistryBackend implements V2SessionRegistryBackend {
  private values = new Map<string, { state: { sessionId: string; seed: string; decisionIndex: number; decisionsPerSession: number } }>();

  get(key: string) {
    return this.values.get(key);
  }

  set(key: string, value: { state: { sessionId: string; seed: string; decisionIndex: number; decisionsPerSession: number } }) {
    this.values.set(key, value);
  }

  clear() {
    this.values.clear();
  }
}

describe("v2SessionRegistry", () => {
  beforeEach(() => {
    setV2SessionRegistryBackend(new TestRegistryBackend());
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
