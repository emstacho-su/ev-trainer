import { beforeEach, describe, expect, it } from "vitest";
import type { Spot } from "../engine/spot";
import { SpotSchemaVersion } from "../engine/spot";
import {
  clearSessionStore,
  createSessionRecord,
  getSessionRecord,
  setSessionStoreBackend,
  type SessionRecord,
  type SessionStoreBackend,
} from "./sessionStore";

class TestSessionStoreBackend implements SessionStoreBackend {
  private values = new Map<string, SessionRecord>();

  get(key: string): SessionRecord | undefined {
    return this.values.get(key);
  }

  set(key: string, value: SessionRecord): void {
    this.values.set(key, value);
  }

  clear(): void {
    this.values.clear();
  }
}

function buildSpot(): Spot {
  return {
    schemaVersion: SpotSchemaVersion,
    spotId: "spot-1",
    gameType: "NLHE",
    blinds: { sb: 0.5, bb: 1, ante: 0 },
    positions: ["BTN", "BB", "SB"],
    stacksBb: { BTN: 100, BB: 100, SB: 100 } as Spot["stacksBb"],
    potBb: 3,
    board: [],
    history: [],
    heroToAct: "BTN",
  };
}

describe("sessionStore backend seam", () => {
  beforeEach(() => {
    setSessionStoreBackend(new TestSessionStoreBackend());
    clearSessionStore();
  });

  it("persists and reads records through configured backend", () => {
    const created = createSessionRecord({
      sessionId: "s1",
      seed: "seed-a",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: {},
      decisionIndex: 0,
      decisionsPerSession: 10,
    });
    created.currentSpot = buildSpot();

    const loaded = getSessionRecord("s1", "seed-a");
    expect(loaded).not.toBeNull();
    expect(loaded?.sessionId).toBe("s1");
    expect(loaded?.currentSpot?.spotId).toBe("spot-1");
  });
});
