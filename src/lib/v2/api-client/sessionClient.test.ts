import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PracticeRecordedStatus from "../../../components/PracticeRecordedStatus";
import TrainingFeedbackPanel from "../../../components/TrainingFeedbackPanel";
import {
  handleGetSession,
  handleNext,
  handleStart,
  handleSubmit,
} from "../api/sessionHandlers";
import { clearBundledPackCache } from "../packs/loadBundledPack";
import { clearSessionStore } from "../sessionStore";
import {
  getSession,
  nextDecision,
  startSession,
  submitAction,
} from "./sessionClient";
import { clearSessionRegistry } from "../../runtime/v2SessionRegistry";

/** Pick an action that the mock solver will accept for this spot. */
function getValidAction(spot: { board: string[]; history: string[] }): string {
  if (spot.board.length === 0) return "FOLD";
  const facesBet = spot.history.some(
    (a: string) => a.startsWith("BET_") || a.startsWith("RAISE_") || a === "CALL"
  );
  return facesBet ? "FOLD" : "CHECK";
}

function toResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(async () => {
  clearSessionRegistry();
  await clearSessionStore();
  clearBundledPackCache();

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
      const payload =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

      if (path === "/api/session/start") {
        const result = await handleStart(payload);
        return toResponse(result.status, result.body);
      }
      if (path === "/api/session/submit") {
        const result = await handleSubmit(payload);
        return toResponse(result.status, result.body);
      }
      if (path === "/api/session/next") {
        const result = await handleNext(payload);
        return toResponse(result.status, result.body);
      }
      if (path.startsWith("/api/session/")) {
        const sessionId = path.split("/").pop() ?? "";
        const seed = url.searchParams.get("seed");
        const result = await handleGetSession(sessionId, seed);
        return toResponse(result.status, result.body);
      }

      return toResponse(404, {
        error: { code: "NOT_FOUND", message: "unknown endpoint" },
      });
    })
  );
});

describe("sessionClient UI smoke", () => {
  it("starts and submits in training, then exposes feedback UI", async () => {
    const started = await startSession({
      seed: "seed-a",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      filters: {},
    });

    const submitted = await submitAction({
      seed: started.session.seed,
      sessionId: started.session.sessionId,
      spot: started.spot,
      actionId: getValidAction(started.spot),
    });

    expect("result" in submitted).toBe(true);
    if (!("result" in submitted)) return;

    const markup = renderToStaticMarkup(
      createElement(TrainingFeedbackPanel, {
        response: submitted,
        mobileOpen: false,
        onCloseMobile: () => {},
      })
    );
    expect(markup).toContain("Training Feedback");

    const next = await nextDecision({
      seed: started.session.seed,
      sessionId: started.session.sessionId,
    });
    expect(next.session.decisionIndex).toBe(started.session.decisionIndex + 1);
    expect(next.spot.spotId).not.toBe(started.spot.spotId);
  });

  it("starts and submits in practice, then exposes recorded status only", async () => {
    const started = await startSession({
      seed: "seed-b",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
    });

    const submitted = await submitAction({
      seed: started.session.seed,
      sessionId: started.session.sessionId,
      spot: started.spot,
      actionId: getValidAction(started.spot),
    });

    expect("recorded" in submitted && submitted.recorded).toBe(true);
    const detail = await getSession(started.session.sessionId, started.session.seed);
    expect(detail.session.mode).toBe("PRACTICE");

    const markup = renderToStaticMarkup(
      createElement(PracticeRecordedStatus, { visible: true })
    );
    expect(markup).toContain("Recorded");
    expect(markup).not.toContain("Training Feedback");
  });
});
