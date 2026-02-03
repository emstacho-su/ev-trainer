import { describe, expect, it } from "vitest";
import { actionToId, idToAction, validateAction } from "./action";
import type { Action } from "./action";

describe("action", () => {
  it("round-trips sized actions through actionId", () => {
    const action: Action = { type: "BET", sizeBb: 2.5 };
    const id = actionToId(action);
    expect(id).toBe("BET_2.5BB");
    expect(idToAction(id)).toEqual(action);
  });

  it("round-trips non-sized actions through actionId", () => {
    const action: Action = { type: "CHECK" };
    const id = actionToId(action);
    expect(id).toBe("CHECK");
    expect(idToAction(id)).toEqual(action);
  });

  it("rejects invalid size for bet/raise", () => {
    expect(() => validateAction({ type: "BET", sizeBb: 0 })).toThrow();
    expect(() => validateAction({ type: "RAISE", sizeBb: -1 })).toThrow();
  });

  it("rejects size on non-sized actions", () => {
    expect(() => validateAction({ type: "CALL", sizeBb: 1 })).toThrow();
  });
});
