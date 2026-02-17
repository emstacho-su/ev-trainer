# Roadmap: Poker Solver Training Platform v3

## Overview

V3 transforms the EV Trainer from a dev-grade prototype (bundled spots, localStorage, mock solver) into a production platform with a custom CFR+ solver, real backend infrastructure, user accounts, and an animated GTO Nexus-style training UI. The roadmap prioritizes solver core first (all training value depends on accurate GTO), then backend infrastructure (persistence unlocks multi-device), then progressive UI layers from foundation through preflop to postflop training.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Solver Core** - CFR+ algorithm with card/bet abstraction for preflop range generation
- [x] **Phase 2: Backend Foundation** - Express API, PostgreSQL schema, Prisma ORM (AWS deployment deferred)
- [x] **Phase 3: Authentication** - User accounts, email verification, OAuth, session persistence
- [x] **Phase 4: Table UI Foundation** - Oval table layout, card/chip visuals, dark theme, responsive design
- [ ] **Phase 5: Preflop Training** - Opening/3bet/4bet scenarios with immediate EV grading
- [ ] **Phase 6: Trainer Configuration** - Mode toggles, filters, targeted drilling from stats
- [ ] **Phase 7: Range Visualization** - 13x13 range grid modal with action frequencies and equity breakdown
- [ ] **Phase 8: Statistics & Analytics** - Performance graphs, session history, weakness detection
- [ ] **Phase 9: Animations** - Card dealing, chip movement, EV reveal, action highlights
- [ ] **Phase 10: Postflop Training** - Flop/turn/river decision points with multi-street progression

## Phase Details

### Phase 1: Solver Core
**Goal**: CFR+ solver produces accurate preflop strategies within 0.1% EV of PioSolver
**Depends on**: Nothing (first phase)
**Requirements**: SOLV-01, SOLV-02, SOLV-03, SOLV-04, SOLV-05, SOLV-06, SOLV-07, SOLV-08
**Success Criteria** (what must be TRUE):
  1. CFR+ algorithm converges on preflop scenarios with exploitability tracking
  2. Card abstraction reduces 1326 hands to 169 canonical preflop clusters
  3. Bet sizing abstraction supports configurable discrete sizes (33%, 50%, 75%, 100%, all-in)
  4. Preflop ranges generated for all 6-max position matchups (UTG, HJ, CO, BTN, SB, BB)
  5. Benchmark suite validates solver output against PioSolver within 0.1% EV
**Plans**: 7 plans

Plans:
- [x] 01-01: Preflop card abstraction (169 canonical hands)
- [x] 01-02: Bet size abstraction
- [x] 01-03: InfoSet storage + CFR+ core
- [x] 01-04: Game tree builder (lazy generation)
- [x] 01-05: Preflop solver (CFR+ iteration loop)
- [x] 01-06: Postflop solver (E[HS] abstraction)
- [x] 01-07: Benchmark validation suite

### Phase 2: Backend Foundation
**Goal**: Express API server with PostgreSQL persistence replaces localStorage-only architecture
**Depends on**: Phase 1 (solver interface informs data models)
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, BACK-05, BACK-06, BACK-07, BACK-08
**Success Criteria** (what must be TRUE):
  1. Express API server handles session lifecycle (start, submit, next, complete)
  2. PostgreSQL database persists users, sessions, hands, and daily stats
  3. Prisma ORM provides type-safe queries across all models
  4. AWS deployment (EC2 + RDS) serves production traffic
  5. V2 session handlers migrated to Express controllers without breaking determinism
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Prisma schema with PostgreSQL database and connection pooling (+ Docker Compose)
- [x] 02-02-PLAN.md — Express server with middleware, health checks, and async session routes
- [x] 02-03-PLAN.md — Migrate SessionStore backend to async Prisma-backed PostgreSQL persistence
- [x] 02-04-PLAN.md — AWS deployment files created (deployment deferred until product ready)

### Phase 3: Authentication
**Goal**: Users can create accounts and access training history across devices
**Depends on**: Phase 2 (requires backend infrastructure)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. User can register with email/password and verify email
  2. User can log in and stay logged in across browser sessions
  3. User can reset forgotten password via email link
  4. User can log in with Google or GitHub OAuth
  5. User's training history syncs across devices via server
**Plans**: 5 plans

Plans:
- [x] 03-01-PLAN.md — Schema updates (RefreshToken, VerificationToken) + auth service foundation (Argon2, JWT)
- [x] 03-02-PLAN.md — Email/password registration, login, logout, refresh endpoints
- [x] 03-03-PLAN.md — Email verification and password reset flows with Resend
- [x] 03-04-PLAN.md — OAuth login with Google and GitHub
- [x] 03-05-PLAN.md — Session route integration with auth middleware

### Phase 4: Table UI Foundation
**Goal**: GTO Nexus-style oval table with realistic poker visuals replaces prototype UI
**Depends on**: Phase 2 (API integration required)
**Requirements**: TRUI-01, TRUI-02, TRUI-03, TRUI-04, TRUI-05, TRUI-06, TRUI-07, TRUI-08, TRUI-09, TRUI-10, TRUI-11, TRUI-12, VISU-01, VISU-02, VISU-03, VISU-04, VISU-05
**Success Criteria** (what must be TRUE):
  1. Oval table displays 6 position nodes with hero cards and villain face-down cards
  2. Community cards, pot size, pot type label, and stack sizes displayed correctly
  3. Action buttons (Fold, Call, Raise) show EV and frequency after decision
  4. Dark theme with realistic card/chip designs renders at 1920x1080 and scales to 1280x720
  5. Control buttons (Start, Next, Restart, Stop, View Ranges) function correctly
**Plans**: 6 plans

Plans:
- [x] 04-01-PLAN.md — Theme infrastructure with next-themes, CSS variables, and utility helpers
- [x] 04-02-PLAN.md — Atomic components (Card, CardBack, Chip, DealerButton)
- [x] 04-03-PLAN.md — Player seat molecules (PlayerSeat, CommunityCards, PotDisplay)
- [x] 04-04-PLAN.md — Action button molecule with EV feedback and frequency bar
- [x] 04-05-PLAN.md — Table organism with oval layout, action panel, session controls, info bar
- [x] 04-06-PLAN.md — Visual verification checkpoint (human confirms UI at multiple viewports)

### Phase 5: Preflop Training
**Goal**: Users can practice preflop decisions (RFI, 3bet, 4bet, blind defense) with solver grading
**Depends on**: Phase 1 (solver), Phase 4 (table UI)
**Requirements**: PREF-01, PREF-02, PREF-03, PREF-04, PREF-05
**Success Criteria** (what must be TRUE):
  1. User can train opening range scenarios (first to act)
  2. User can train facing open scenarios (call, 3bet, fold)
  3. User can train 3bet pot scenarios (4bet, call, fold)
  4. User can train blind defense scenarios (BB vs positions, SB vs BB)
  5. Preflop action history displays correctly on table
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Trainer Configuration
**Goal**: Users can customize training mode, filters, and drill specific weak spots
**Depends on**: Phase 5 (preflop training must exist to configure)
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, CONF-07, DRIL-01, DRIL-02, DRIL-03, DRIL-04
**Success Criteria** (what must be TRUE):
  1. User can toggle between Preflop/Flop training spots
  2. User can select game type (Cash/HU), table size (6max/9max), stack depth (50bb/100bb/200bb)
  3. User can filter by position and pot type (SRP, 3BP, 4BP)
  4. User can drill specific position matchups (e.g., BB vs SB, CO vs BTN)
  5. User can quick-drill weak spots identified from statistics
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Range Visualization
**Goal**: Users can view detailed range analysis with hero/villain comparison during training
**Depends on**: Phase 5 (preflop training provides context)
**Requirements**: RANG-01, RANG-02, RANG-03, RANG-04, RANG-05
**Success Criteria** (what must be TRUE):
  1. View Ranges button opens modal with side-by-side 13x13 hero and villain range grids
  2. Range cells color-coded by action frequency (green=call, blue=fold, etc.)
  3. Current board cards displayed between range grids
  4. Equity breakdown shows hand category percentages for both players
  5. Overall action frequency summary displayed at bottom
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

### Phase 8: Statistics & Analytics
**Goal**: Users can track performance trends and identify weaknesses over time
**Depends on**: Phase 2 (backend persistence), Phase 5 (training data)
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04, STAT-05, STAT-06, STAT-07, STAT-08
**Success Criteria** (what must be TRUE):
  1. User can view daily performance graphs (decisions, accuracy, avg EV loss)
  2. User can filter statistics by date range, position, pot type, street
  3. User can see spot-level breakdown showing weakest areas
  4. User can view session history with replay option
  5. Heatmap visualization shows positional strengths and weaknesses
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Animations
**Goal**: GTO Nexus-style smooth animations enhance training experience
**Depends on**: Phase 4 (table UI foundation)
**Requirements**: ANIM-01, ANIM-02, ANIM-03, ANIM-04, ANIM-05
**Success Criteria** (what must be TRUE):
  1. Cards deal smoothly from deck to positions with stagger timing
  2. Chips slide from position to pot on bet/raise actions
  3. EV reveal animates with slide-up and color transition
  4. Action highlights pulse on selected button
  5. Range grid modal opens/closes with smooth fade and scale
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

### Phase 10: Postflop Training
**Goal**: Users can practice flop/turn/river decisions with multi-street progression
**Depends on**: Phase 1 (postflop solver), Phase 4 (table UI)
**Requirements**: POST-01, POST-02, POST-03, POST-04, POST-05, POST-06
**Success Criteria** (what must be TRUE):
  1. User can train flop c-bet scenarios (IP and OOP)
  2. User can train turn barrel/check-back/call scenarios
  3. User can train river value-bet/bluff/check decisions
  4. Multi-street training progresses from flop -> turn -> river
  5. Postflop action history shows bet sizes and ranges
**Plans**: TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD
