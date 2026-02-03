import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as getSessionRoute } from "../app/api/session/[id]/route";
import { POST as nextRoute } from "../app/api/session/next/route";
import { POST as startRoute } from "../app/api/session/start/route";
import { POST as submitRoute } from "../app/api/session/submit/route";
import { clearBundledPackCache } from "../lib/v2/packs/loadBundledPack";
import { clearSessionStore } from "../lib/v2/sessionStore";
import { clearSessionRegistry } from "../lib/runtime/v2SessionRegistry";

function resetState(): void {
  clearSessionRegistry();
  clearSessionStore();
  clearBundledPackCache();
}

function jsonPost(url: string, payload: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function invalidJsonPost(url: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
}

function sessionContext(sessionId: string): Parameters<typeof getSessionRoute>[1] {
  return {
    params: Promise.resolve({ id: sessionId }),
  } as Parameters<typeof getSessionRoute>[1];
}

function nextGet(url: string): NextRequest {
  return new NextRequest(url);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("session API route contracts", () => {
  beforeEach(() => {
    resetState();
  });

  it("POST /api/session/start returns stable JSON shape and deterministic seeded output", async () => {
    const payload = {
      seed: "contract-seed",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: { street: "FLOP" },
    };

    const first = await startRoute(
      jsonPost("http://localhost/api/session/start", payload)
    );
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toContain("application/json");
    const firstBody = await readJson(first);
    expect(firstBody.ok).toBe(true);
    expect(firstBody.session).toMatchObject({
      seed: payload.seed,
      mode: payload.mode,
      packId: payload.packId,
      decisionIndex: 0,
      isComplete: false,
    });
    expect(firstBody.spot).toMatchObject({
      spotId: expect.any(String),
      heroToAct: expect.any(String),
    });

    const second = await startRoute(
      jsonPost("http://localhost/api/session/start", payload)
    );
    const secondBody = await readJson(second);
    expect(secondBody.session).toMatchObject({
      sessionId: (firstBody.session as { sessionId: string }).sessionId,
      seed: payload.seed,
    });
    expect(secondBody.spot).toMatchObject({
      spotId: (firstBody.spot as { spotId: string }).spotId,
    });
  });

  it("POST /api/session/start validates malformed JSON and missing fields", async () => {
    const malformed = await startRoute(
      invalidJsonPost("http://localhost/api/session/start")
    );
    expect(malformed.status).toBe(400);
    expect((await readJson(malformed)).error).toMatchObject({
      code: "INVALID_ARGUMENT",
    });

    const missingSeed = await startRoute(
      jsonPost("http://localhost/api/session/start", { mode: "TRAINING" })
    );
    expect(missingSeed.status).toBe(400);
    expect((await readJson(missingSeed)).error).toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("POST /api/session/submit returns grading contract and NOT_FOUND for invalid ids", async () => {
    const started = await startRoute(
      jsonPost("http://localhost/api/session/start", {
        seed: "submit-seed",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
      })
    );
    const startedBody = await readJson(started);

    const ok = await submitRoute(
      jsonPost("http://localhost/api/session/submit", {
        seed: (startedBody.session as { seed: string }).seed,
        sessionId: (startedBody.session as { sessionId: string }).sessionId,
        spot: startedBody.spot,
        actionId: "CHECK",
      })
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("application/json");
    expect((await readJson(ok)).result).toMatchObject({
      evLossVsBest: expect.any(Number),
      evLossVsMix: expect.any(Number),
    });

    const invalidId = await submitRoute(
      jsonPost("http://localhost/api/session/submit", {
        seed: "submit-seed",
        sessionId: "does-not-exist",
        spot: startedBody.spot,
        actionId: "CHECK",
      })
    );
    expect(invalidId.status).toBe(404);
    expect((await readJson(invalidId)).error).toMatchObject({ code: "NOT_FOUND" });
  });

  it("POST /api/session/next returns next-session contract and validates required fields", async () => {
    const started = await startRoute(
      jsonPost("http://localhost/api/session/start", {
        seed: "next-seed",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        filters: {},
      })
    );
    const startedBody = await readJson(started);
    const seed = (startedBody.session as { seed: string }).seed;
    const sessionId = (startedBody.session as { sessionId: string }).sessionId;

    await submitRoute(
      jsonPost("http://localhost/api/session/submit", {
        seed,
        sessionId,
        spot: startedBody.spot,
        actionId: "CHECK",
      })
    );

    const ok = await nextRoute(
      jsonPost("http://localhost/api/session/next", { seed, sessionId })
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("application/json");
    const okBody = await readJson(ok);
    expect(okBody.session).toMatchObject({
      sessionId,
      seed,
      decisionIndex: 1,
    });
    expect(okBody.spot).toMatchObject({ spotId: expect.any(String) });

    const missingSessionId = await nextRoute(
      jsonPost("http://localhost/api/session/next", { seed })
    );
    expect(missingSessionId.status).toBe(400);
    expect((await readJson(missingSessionId)).error).toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("GET /api/session/[id] returns detail shape and validates seed/id errors", async () => {
    const started = await startRoute(
      jsonPost("http://localhost/api/session/start", {
        seed: "detail-seed",
        mode: "PRACTICE",
        packId: "ev-dev-pack-v1",
        filters: {},
      })
    );
    const startedBody = await readJson(started);
    const sessionId = (startedBody.session as { sessionId: string }).sessionId;
    const seed = (startedBody.session as { seed: string }).seed;

    const ok = await getSessionRoute(
      nextGet(`http://localhost/api/session/${sessionId}?seed=${seed}`),
      sessionContext(sessionId)
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("application/json");
    expect((await readJson(ok))).toMatchObject({
      ok: true,
      session: {
        sessionId,
        seed,
        mode: "PRACTICE",
      },
      reviewAvailable: false,
    });

    const missingSeed = await getSessionRoute(
      nextGet(`http://localhost/api/session/${sessionId}`),
      sessionContext(sessionId)
    );
    expect(missingSeed.status).toBe(400);
    expect((await readJson(missingSeed)).error).toMatchObject({
      code: "INVALID_ARGUMENT",
    });

    const invalidId = await getSessionRoute(
      nextGet(`http://localhost/api/session/not-found?seed=${seed}`),
      sessionContext("not-found")
    );
    expect(invalidId.status).toBe(404);
    expect((await readJson(invalidId)).error).toMatchObject({ code: "NOT_FOUND" });
  });
});
