# Requirements — ev-runtime-preview

## Current state (SRS ground truth as of Jan 28, 2026)
- Repo implements a deterministic engine plus HTML renderers.
- No runtime app exists (no Next.js wiring / no API routes / no UI entrypoint).
- Grading is injected; production grading is not implemented.

## What we are adding
- Determinism: seeds are explicit; time/IDs must be reproducible when injected; avoid nondeterministic sources unless explicitly provided.
- A minimal Next.js App Router runtime for local E2E wiring.
- Thin API routes for training modes and review:
  - Spot Quiz
  - Hand Play
  - Targeted Drill
  - Review list + detail
- A minimal manual preview UI to drive flows end-to-end.
- A production `gradeDecision` implementation (EV-first, minimal, validated).
- A deterministic demo solver option (or deterministic mock solver reuse).

## Constraints and principles
- EV is the primary metric and ordering key (EV loss vs mix).
- Deterministic behavior via explicit seeds and stable IDs.
- Original UX/copy; no GTOWizard UI/text/assets/branding.
- Keep diffs minimal; prefer small modules under `src/lib` (and under `src/lib/engine` when possible).
- No persistence beyond in-memory stores; no auth; no real solver integration.
- Use existing open-source solver contract patterns; keep adapter solver-agnostic.

## Non-goals
- No database or external persistence.
- No authentication/authorization.
- No payments/analytics/telemetry.
- No production solver integration or licensing work.
- No UI/UX cloning of GTOWizard.
