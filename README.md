# EV Trainer

A full-stack poker training platform that grades every decision by Expected Value (EV) loss against game theory optimal (GTO) solver baselines. Built to help players — from casual learners to advanced grinders — understand and internalize GTO strategy by quantifying the exact cost of every mistake.

## Motivation

Most poker training tools teach hand rankings or basic heuristics. They don't answer the question that actually matters: **how much did that decision cost me?**

EV Trainer bridges that gap. Every action you take is graded against a solver's mixed strategy, showing you not just whether you were "right" or "wrong," but exactly how many big blinds each decision costs you over time. The goal is to make GTO concepts accessible to casual players while giving advanced players the precision they need.

## Features

### Training Modes
- **Spot Quiz** — Single decision points with immediate EV feedback
- **Hand Play** — Play through full hands, graded at every street
- **Review Mode** — Resurface your worst decisions, sorted by EV loss
- **Targeted Drill** — Filter and practice your weakest spots by position, pot type, or street

### Configurable Filters
- **Positions:** UTG, HJ, CO, BTN, SB, BB (6-max)
- **Pot Types:** Single-raised pots (SRP), 3-bet pots (3BP)
- **Stack Depths:** 50bb, 100bb, 200bb
- **Streets:** Preflop, Flop, Turn, River
- **Board Texture:** Paired, connected, coordinated (postflop)

### Analytics Dashboard
- EV loss trend over time
- Position-by-position performance heatmap
- Weakness identification across positions, pot types, and streets
- Session history with replay capability
- Flagged hands for critical mistakes

### Authentication
- OAuth via Google and GitHub (Supabase Auth)
- Guest mode with localStorage persistence
- Authenticated users sync to PostgreSQL

## Architecture

```
┌─────────────────────────────────────────────┐
│              Next.js Frontend               │
│   Poker Table UI, Action Panel, Analytics   │
└──────────────────┬──────────────────────────┘
                   │
        Next.js API Routes
                   │
┌──────────────────┴──────────────────────────┐
│            Core Engine Layer                 │
│                                             │
│  Training Orchestrator                      │
│    ├── Spot Source (bundled JSON packs)      │
│    ├── Filters (position, pot, street)      │
│    ├── Grading (EV loss vs solver mixed)    │
│    └── Seeded RNG (deterministic)           │
│                                             │
│  Solver Adapter ─── Mock (MVP)              │
│                 └── Real solver (planned)    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│           Persistence Layer                 │
│  Supabase (auth users) │ localStorage (guest)│
└─────────────────────────────────────────────┘
```

### Key Design Decisions

**Deterministic Seeded RNG** — The entire engine is deterministic: the same `(seed, sessionId, decisionIndex)` tuple always produces the same spot, hero cards, and opponent action. This was a deliberate architectural choice that decoupled feature development from engine complexity. By making every game state reproducible, I could build, test, and iterate on the UI, grading system, analytics, and session management without dealing with solver integration or randomness-related bugs. It also enables a powerful user feature — players can replay the exact same hands to study their decision-making under identical conditions.

**Solver Adapter Contract** — The engine defines a formal interface for solver integration (`CanonicalNode → SolverNodeOutput`). The MVP uses a mock solver that generates deterministic outputs based on node hashing, but the contract is designed so a real solver (C++, Rust, or WASM) can be plugged in without touching any application code.

**Dual-Path Persistence** — Authenticated users persist to Supabase (PostgreSQL); guests use localStorage with an in-memory session registry. Both paths share the same engine and grading logic, so the training experience is identical regardless of auth state.

**Spot Packs** — Poker spots are schema-validated JSON bundles (`SpotPack`), loadable from Supabase or from bundled fallback files. This keeps the engine portable and testable without database dependencies.

### EV Grading System

Every user action is graded against the solver's mixed strategy:

```
EV_mix  = Σ(action.frequency × action.ev)    // Solver's mixed strategy EV
EV_best = max(action.ev)                      // Best single action EV
EV_loss = EV_mix - user_action_ev             // Primary metric (vs mix)
```

The grading result includes all available actions with their frequencies and EVs, so the UI can show exactly what the solver recommends and how each alternative compares.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router) | SSR, API routes, scalable full-stack architecture |
| UI | React 19, TypeScript (strict) | Type-safe component development |
| Styling | Tailwind CSS 4, dark mode | Fast styling, optimized for long study sessions |
| Animation | Framer Motion | Smooth card reveals, transitions, UI polish |
| Charts | Recharts | React-native charting for analytics dashboard |
| Validation | Zod | Runtime schema validation for spot packs and API payloads |
| Database | Supabase (PostgreSQL) | Managed PostgreSQL with auth, realtime, and row-level security |
| Auth | Supabase Auth (OAuth) | Google + GitHub login, session management |
| Testing | Vitest | Fast unit testing with coverage |
| Poker | poker-evaluator-ts | Hand strength evaluation |

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User preferences, subscription data |
| `training_sessions` | Session records with seed, mode, filters |
| `session_entries` | Individual decisions with grading results (JSONB) |
| `spots` | Practice spot library |
| `daily_stats` | Pre-aggregated daily performance metrics |
| `spot_stats` | Per-spot performance tracking |

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account (or local Supabase instance)

### Development

```bash
npm install
npm run dev
```

Visit the local URL printed by Next.js and navigate to `/train`.

### Testing

```bash
npm test              # Run full suite
npm run test:watch    # Watch mode
npm run test:cov      # Coverage report
```

### Database

```bash
npx supabase db push  # Apply migrations
npm run gen:types     # Generate TypeScript types from schema
```

## Project Structure

```
src/
├── app/
│   ├── training/              # Preflop training page
│   ├── postflop-training/     # Postflop training page
│   ├── stats/                 # Analytics dashboard
│   ├── login/                 # OAuth login
│   ├── api/                   # API routes (session, drills, stats)
│   ├── providers/             # Auth, Theme, Animation contexts
│   └── components/
│       ├── poker/             # PokerTable, ActionPanel, PlayerSeat, Cards
│       ├── range/             # 13x13 hand matrix, equity visualization
│       └── config/            # Training config dialogs, filter bars
│
├── lib/
│   ├── engine/                # Core poker engine (grading, RNG, sessions)
│   ├── v2/                    # V2 API handlers, spot packs, storage
│   ├── supabase/              # Database services (sessions, stats, spots)
│   ├── runtime/               # Runtime grading, session registry
│   ├── postflop/              # Board texture, postflop solver, state machine
│   ├── range/                 # Hand range grid layout and visualization
│   └── aggregates/            # Stats aggregation (global, per-session)
│
└── __tests__/                 # Session lifecycle, determinism, stats, UI smoke
```

## Roadmap

- [ ] Real solver integration (C++/Rust/WASM via adapter contract)
- [ ] Public deployment
- [ ] Postflop training completion
- [ ] Leaderboards and competitive rankings
- [ ] Hand history import and custom range editing
- [ ] PLO support
- [ ] Exploit-based opponent modeling (beyond GTO)

## Status

Actively in development (~40-50% complete). Core engine, grading system, training modes, analytics, and authentication are functional. Working toward public launch with real solver integration.
