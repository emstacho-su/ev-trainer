// src/lib/ui/trainingUi.ts

import type { DecisionRecord } from "../engine/trainingOrchestrator";
import type { SolverActionOutput } from "../engine/solverAdapter";

export interface SpotQuizUiState {
  prompt: string;
  actions: SolverActionOutput[];
  selectedActionId?: string;
  evLossVsMix?: number;
  evLossVsBest?: number;
}

export interface HandPlayStepLog {
  step: number;
  actor: "user" | "opponent";
  actionId: string;
}

export interface HandPlayUiState {
  prompt: string;
  actions: SolverActionOutput[];
  selectedActionId?: string;
  step: number;
  log: HandPlayStepLog[];
}

export interface TargetedDrillUiState {
  prompt: string;
  streets: string[];
  boardBuckets: string[];
  maxRaisesPerStreet?: number;
  betSizesBb?: number[];
  raiseSizesBb?: number[];
  verbosity: "compact" | "detailed";
}

export interface ReviewUiState {
  title: string;
  items: DecisionRecord[];
  selectedId?: string;
}

export interface TrainingUiState {
  activeMode: "spot-quiz" | "hand-play" | "targeted-drill" | "review";
  spotQuiz: SpotQuizUiState;
  handPlay: HandPlayUiState;
  targetedDrill: TargetedDrillUiState;
  review: ReviewUiState;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatEv(value: number | undefined): string {
  if (value === undefined) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} bb`;
}

function renderStyle(): string {
  return `
  <style>
    :root {
      --bg: #0f171f;
      --bg-alt: #131f2a;
      --accent: #f59e0b;
      --accent-2: #06b6d4;
      --text: #f3f4f6;
      --muted: #94a3b8;
      --danger: #f87171;
      --good: #34d399;
      --card: #0b1118;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Space Grotesk", "Trebuchet MS", sans-serif; color: var(--text); background: radial-gradient(circle at top left, #233146, #0f171f 45%, #0a0f14); }
    .shell { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .brand { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .brand h1 { margin: 0; font-size: 28px; letter-spacing: 0.5px; }
    .tagline { color: var(--muted); font-size: 14px; }
    .mode-tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 20px; }
    .mode-tab { background: var(--bg-alt); border: 1px solid #1f2a37; padding: 12px 14px; border-radius: 12px; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; color: var(--muted); }
    .mode-tab.active { border-color: var(--accent); color: var(--text); background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(15,23,32,0.8)); }
    .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 18px; }
    .card { background: var(--card); border: 1px solid #1f2a37; border-radius: 16px; padding: 18px; box-shadow: 0 12px 30px rgba(0,0,0,0.35); }
    .card h2 { margin: 0 0 10px 0; font-size: 18px; }
    .actions { display: grid; gap: 10px; }
    .action { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 10px; border: 1px solid #273244; background: #101923; }
    .action.selected { border-color: var(--accent); }
    .action small { color: var(--muted); }
    .pill { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 12px; background: rgba(6, 182, 212, 0.15); color: var(--accent-2); }
    .metric { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; background: #0f1720; margin-top: 8px; }
    .metric strong { font-size: 14px; }
    .metric.good { border-left: 3px solid var(--good); }
    .metric.warn { border-left: 3px solid var(--danger); }
    .log { display: grid; gap: 8px; margin-top: 12px; max-height: 220px; overflow: auto; }
    .log-item { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); }
    .filters { display: grid; gap: 10px; }
    .filter { display: flex; flex-direction: column; gap: 6px; }
    .filter label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px; }
    .filter .value { padding: 8px 10px; background: #101923; border-radius: 8px; border: 1px solid #263246; }
    .review-list { display: grid; gap: 10px; }
    .review-item { display: flex; justify-content: space-between; padding: 10px 12px; border-radius: 10px; border: 1px solid #1f2a37; }
    .review-item.selected { border-color: var(--accent-2); background: rgba(6,182,212,0.12); }
    .ev-loss { font-weight: 600; }
    @media (max-width: 720px) {
      .shell { padding: 16px; }
      .brand { flex-direction: column; align-items: flex-start; }
    }
  </style>
  `;
}

function renderActions(actions: SolverActionOutput[], selected?: string): string {
  return `
    <div class="actions">
      ${actions
        .map((action) => {
          const isSelected = action.actionId === selected;
          return `
          <div class="action ${isSelected ? "selected" : ""}">
            <div>
              <strong>${escapeHtml(action.actionId)}</strong>
              <small>freq ${(action.frequency * 100).toFixed(0)}%</small>
            </div>
            <div class="pill">${formatEv(action.ev)}</div>
          </div>`;
        })
        .join("")}
    </div>
  `;
}

export function renderSpotQuizView(state: SpotQuizUiState): string {
  const lossMix = state.evLossVsMix ?? 0;
  const lossBest = state.evLossVsBest ?? 0;
  return `
    <section class="card">
      <h2>Spot Quiz</h2>
      <p class="tagline">${escapeHtml(state.prompt)}</p>
      ${renderActions(state.actions, state.selectedActionId)}
      <div class="metric ${lossMix <= 0.25 ? "good" : "warn"}">
        <strong>EV Loss vs Mix</strong>
        <span>${formatEv(state.evLossVsMix)}</span>
      </div>
      <div class="metric ${lossBest <= 0.5 ? "good" : "warn"}">
        <strong>EV Loss vs Best</strong>
        <span>${formatEv(state.evLossVsBest)}</span>
      </div>
    </section>
  `;
}

export function renderHandPlayView(state: HandPlayUiState): string {
  return `
    <section class="card">
      <h2>Hand Play</h2>
      <p class="tagline">${escapeHtml(state.prompt)}</p>
      <div class="pill">Step ${state.step}</div>
      ${renderActions(state.actions, state.selectedActionId)}
      <div class="log">
        ${state.log
          .map(
            (item) => `
          <div class="log-item">
            <span>Step ${item.step} • ${escapeHtml(item.actor)}</span>
            <span>${escapeHtml(item.actionId)}</span>
          </div>`
          )
          .join("")}
      </div>
    </section>
  `;
}

export function renderTargetedDrillView(state: TargetedDrillUiState): string {
  return `
    <section class="card">
      <h2>Targeted Drill</h2>
      <p class="tagline">${escapeHtml(state.prompt)}</p>
      <div class="filters">
        <div class="filter">
          <label>Streets</label>
          <div class="value">${state.streets.join(", ") || "Any"}</div>
        </div>
        <div class="filter">
          <label>Board buckets</label>
          <div class="value">${state.boardBuckets.join(", ") || "Any"}</div>
        </div>
        <div class="filter">
          <label>Tree restrictions</label>
          <div class="value">
            Max raises: ${state.maxRaisesPerStreet ?? "Any"} |
            Bets: ${state.betSizesBb?.join(", ") ?? "Any"} |
            Raises: ${state.raiseSizesBb?.join(", ") ?? "Any"}
          </div>
        </div>
        <div class="filter">
          <label>Verbosity</label>
          <div class="value">${state.verbosity}</div>
        </div>
      </div>
    </section>
  `;
}

function orderReviewItems(items: DecisionRecord[]): DecisionRecord[] {
  return [...items].sort((a, b) => {
    const diff = b.metrics.evLossVsMix - a.metrics.evLossVsMix;
    if (diff !== 0) return diff;
    if (a.createdSeq !== b.createdSeq) return a.createdSeq - b.createdSeq;
    return a.recordId.localeCompare(b.recordId);
  });
}

export function renderReviewView(state: ReviewUiState): string {
  const ordered = orderReviewItems(state.items);
  return `
    <section class="card">
      <h2>${escapeHtml(state.title)}</h2>
      <p class="tagline">Sorted by EV loss to surface the highest impact leaks.</p>
      <div class="review-list">
        ${ordered
          .map((item) => {
            const isSelected = item.id === state.selectedId;
            return `
            <div class="review-item ${isSelected ? "selected" : ""}">
              <div>
                <strong>${escapeHtml(item.mode)}</strong>
                <div class="tagline">${escapeHtml(item.nodeHash.slice(0, 10))}</div>
              </div>
              <div class="ev-loss">${formatEv(item.grade.evLossVsMix)}</div>
            </div>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

export function renderTrainingShell(state: TrainingUiState): string {
  const tab = (mode: TrainingUiState["activeMode"], label: string) => `
    <div class="mode-tab ${state.activeMode === mode ? "active" : ""}">
      ${label}
    </div>
  `;
  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      ${renderStyle()}
    </head>
    <body>
      <div class="shell">
        <div class="brand">
          <div>
            <h1>EV Drift Lab</h1>
            <div class="tagline">Train for impact, not volume. Track every leak in EV.</div>
          </div>
          <div class="pill">Session focus: EV loss</div>
        </div>
        <div class="mode-tabs">
          ${tab("spot-quiz", "Spot Quiz")}
          ${tab("hand-play", "Hand Play")}
          ${tab("targeted-drill", "Targeted Drill")}
          ${tab("review", "Review")}
        </div>
        <div class="grid">
          ${renderSpotQuizView(state.spotQuiz)}
          ${renderHandPlayView(state.handPlay)}
          ${renderTargetedDrillView(state.targetedDrill)}
          ${renderReviewView(state.review)}
        </div>
      </div>
    </body>
  </html>
  `;
}
