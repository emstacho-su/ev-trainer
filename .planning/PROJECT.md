# Poker Solver Training Platform (v3)

## What This Is

A GTO poker training application that teaches players optimal decision-making through real-time solver feedback. V3 evolves from a dev-grade EV trainer (bundled spots, localStorage) into a production platform with a custom CFR+ solver, preflop/postflop training modes, range visualization, user accounts, and persistent statistics.

## Core Value

Players can practice poker decisions and receive solver-accurate EV feedback that helps them identify and fix leaks in their game.

## Requirements

### Validated

<!-- Shipped and confirmed valuable in v2. -->

- ✓ Deterministic seed-driven sessions — v2
- ✓ Training mode with immediate EV grading — v2
- ✓ Practice mode with deferred review — v2
- ✓ Session lifecycle (start, submit, next, complete) — v2
- ✓ Summary aggregates (mean EV loss, best-action rate, volume, duration) — v2
- ✓ Review screens with per-decision drilldown — v2
- ✓ Spot filtering (street, position, stack bucket, pot type) — v2
- ✓ localStorage persistence with recovery — v2

### Active

<!-- v3 scope. Building toward these. -->

**Solver Core:**
- [ ] CFR+ algorithm implementation (TypeScript)
- [ ] Card abstraction layer
- [ ] Bet sizing abstraction
- [ ] Game tree builder
- [ ] Convergence within 0.1% EV of PioSolver
- [ ] Benchmark validation suite

**Preflop Training:**
- [ ] Preflop mode with opening/3bet/4bet scenarios
- [ ] 13x13 range grid visualization (GTO Nexus style)
- [ ] Color-coded action frequencies
- [ ] Hero/villain range comparison view

**Postflop Enhancements:**
- [ ] LRI (Last Raiser Indicator) token display
- [ ] Spot context labels ("3b IP Aggressor", "SRP OOP Caller")
- [ ] Non-trivial spot filtering toggle

**Backend Infrastructure:**
- [ ] Express + TypeScript API server
- [ ] PostgreSQL database (AWS RDS)
- [ ] Prisma ORM integration
- [ ] AWS deployment (EC2/S3/CloudFront)

**Authentication:**
- [ ] User accounts with email/password
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] OAuth (Google, GitHub)
- [ ] Session persistence across devices

**Statistics & Analytics:**
- [ ] Performance graphs (7D/30D/90D/All Time)
- [ ] Per-spot type analytics
- [ ] Session history with clickable entries
- [ ] Flagged hands for review
- [ ] Daily performance aggregates

**UI/UX Overhaul:**
- [ ] Dark theme (poker felt aesthetic)
- [ ] Card dealing animations
- [ ] Chip movement animations
- [ ] Action highlight animations
- [ ] EV reveal transitions
- [ ] Realistic card/chip designs
- [ ] Responsive layout (1920x1080 base)

**Desktop App:**
- [ ] Electron or Tauri wrapper
- [ ] Auto-update functionality

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real-time chat — High complexity, not core to training value
- Video content — Storage/bandwidth costs, defer to future
- Mobile app — Web-first, mobile later (keep component structure modular)
- Multi-table support — Single session focus for v3
- Multiplayer/social features — Solo training tool
- Subscription/payments — Defer until user base established
- Advanced leak detection AI — Future enhancement after stats foundation

## Context

**Brownfield migration:** V3 builds on v2 codebase (branch: `v3` from `v2`). The engine layer's determinism patterns, grading pipeline, and session abstractions carry forward. The v2 API/UI layers will be progressively replaced.

**Architecture evolution:**
- v2: Client-side only, bundled spot packs, localStorage, mock solver data
- v3: Full backend, real CFR+ solver, PostgreSQL, user accounts

**Technical foundation from v2:**
- Engine: `src/lib/engine/` — grading, RNG, validation (reusable)
- Runtime: `src/lib/runtime/` — session registry patterns (adapt for server)
- V2 handlers: `src/lib/v2/` — API patterns (migrate to Express)
- UI components: `src/components/` — rebuild with animations

**Solver research sources:**
- PioSolver documentation and whitepapers
- OpenCFR, PokerCFR open-source implementations
- Academic papers on CFR+ and game theory optimal poker

## Constraints

- **Tech stack**: Next.js frontend, Express backend, PostgreSQL, TypeScript throughout — Consistency and team familiarity
- **Solver accuracy**: Must converge within 0.1% EV of PioSolver — Training value depends on accuracy
- **Determinism**: All sessions must be reproducible given same seed — Core testing and debugging requirement
- **Non-copy**: No GTOWizard UI/text/assets/branding/datasets/solver outputs — Legal and originality requirement
- **Desktop packaging**: Electron or Tauri only — Cross-platform support needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build CFR+ from scratch (TypeScript) | Client-side solving, full control, learning opportunity | — Pending |
| Express backend (not Next.js API routes) | Clearer separation, easier testing, WebSocket support later | — Pending |
| PostgreSQL over other DBs | Relational model fits user/session/hand data, AWS RDS support | — Pending |
| Dark theme default | Poker aesthetic, reduced eye strain for long sessions | — Pending |
| Incremental migration from v2 | Preserve working patterns, reduce risk | — Pending |

---
*Last updated: 2026-02-03 after initialization*
