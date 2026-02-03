import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SpotView from "../components/SpotView";
import TrainingFeedbackPanel from "../components/TrainingFeedbackPanel";
import {
  handleGetSession,
  handleNext,
  handleStart,
  handleSubmit,
} from "../lib/v2/api/sessionHandlers";
import {
  nextDecision,
  startSession,
  submitAction,
} from "../lib/v2/api-client/sessionClient";
import { clearBundledPackCache } from "../lib/v2/packs/loadBundledPack";
import { clearSessionStore } from "../lib/v2/sessionStore";
import { clearSessionRegistry } from "../lib/runtime/v2SessionRegistry";

function resetState(): void {
  clearSessionRegistry();
  clearSessionStore();
  clearBundledPackCache();
}

function toResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  resetState();

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const url = new URL(rawUrl, "http://localhost");
      const path = url.pathname;
      const payload = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

      if (path === "/api/session/start") {
        const result = handleStart(payload);
        return toResponse(result.status, result.body);
      }
      if (path === "/api/session/submit") {
        const result = handleSubmit(payload);
        return toResponse(result.status, result.body);
      }
      if (path === "/api/session/next") {
        const result = handleNext(payload);
        return toResponse(result.status, result.body);
      }
      if (path.startsWith("/api/session/")) {
        const sessionId = path.split("/").pop() ?? "";
        const seed = url.searchParams.get("seed");
        const result = handleGetSession(sessionId, seed);
        return toResponse(result.status, result.body);
      }

      return toResponse(404, {
        error: { code: "NOT_FOUND", message: "unknown endpoint" },
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI smoke: core loop", () => {
  it("starts a session, renders first decision, submits, and advances safely", async () => {
    const started = await startSession({
      seed: "ui-smoke-seed",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: {},
      decisionsPerSession: 2,
    });

    const firstDecisionMarkup = renderToStaticMarkup(
      createElement(SpotView, { spot: started.spot })
    );
    expect(firstDecisionMarkup).toContain("Current Spot");
    expect(firstDecisionMarkup).toContain(started.spot.spotId);

    const submitResponse = await submitAction({
      seed: started.session.seed,
      sessionId: started.session.sessionId,
      spot: started.spot,
      actionId: "CHECK",
    });
    expect("result" in submitResponse).toBe(true);
    if (!("result" in submitResponse)) return;

    const feedbackMarkup = renderToStaticMarkup(
      createElement(TrainingFeedbackPanel, {
        response: submitResponse,
        mobileOpen: false,
        onCloseMobile: () => {},
      })
    );
    expect(feedbackMarkup).toContain("Training Feedback");

    const next = await nextDecision({
      seed: started.session.seed,
      sessionId: started.session.sessionId,
    });
    expect(next.session.decisionIndex).toBe(started.session.decisionIndex + 1);

    const nextDecisionMarkup = renderToStaticMarkup(
      createElement(SpotView, { spot: next.spot })
    );
    expect(nextDecisionMarkup).toContain("Current Spot");
    expect(nextDecisionMarkup).toContain(next.spot.spotId);
  });
});
