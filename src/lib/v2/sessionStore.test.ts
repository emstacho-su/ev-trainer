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

  async get(key: string): Promise<SessionRecord | undefined> {
    return Promise.resolve(this.values.get(key));
  }

  async set(key: string, value: SessionRecord): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  async clear(): Promise<void> {
    this.values.clear();
    return Promise.resolve();
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
  beforeEach(async () => {
    setSessionStoreBackend(new TestSessionStoreBackend());
    await clearSessionStore();
  });

  it("persists and reads records through configured backend", async () => {
    const created = await createSessionRecord({
      sessionId: "s1",
      seed: "seed-a",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: {},
      decisionIndex: 0,
      decisionsPerSession: 10,
    });
    created.currentSpot = buildSpot();

    const loaded = await getSessionRecord("s1", "seed-a");
    expect(loaded).not.toBeNull();
    expect(loaded?.sessionId).toBe("s1");
    expect(loaded?.currentSpot?.spotId).toBe("spot-1");
  });
});
