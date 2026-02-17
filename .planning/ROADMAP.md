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
- [x] **Phase 5: Preflop Training** - Opening/3bet/4bet scenarios with immediate EV grading (2 minor issues deferred)
- [x] **Phase 6: Trainer Configuration** - Mode toggles, filters, targeted drilling from stats
- [x] **Phase 7: Range Visualization** - 13x13 range grid modal with action frequencies and equity breakdown
- [x] **Phase 8: Statistics & Analytics** - Performance graphs, session history, weakness detection
- [ ] **Phase 9: Animations** - Card dealing, chip movement, EV reveal, action highlights
- [ ] **Phase 10: Postflop Training** - Flop/turn/river decision points with multi-street progression
- [ ] **Phase 11: Supabase Database Integration** - Supabase setup, user accounts, practice spot DB, data layer rewrite
- [ ] **Phase 12: Dashboard & Training Config Popout** - Dashboard home page, training config as centered popout over poker table, navigation restructure

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
**Plans**: 7 plans
**Known issues deferred:** Keyboard shortcuts (Tests 11, 12), info bar metrics (Test 13)

Plans:
- [x] 05-01-PLAN.md — Scenario classification and filter extension
- [x] 05-02-PLAN.md — Table and ActionButton UI extensions
- [x] 05-03-PLAN.md — Training session orchestrator and guest limiting
- [x] 05-04-PLAN.md — Human verification checkpoint (UAT)
- [x] 05-05-PLAN.md — Gap closure: villain seat display fix
- [x] 05-06-PLAN.md — Gap closure: keyboard shortcuts fix (still failing)
- [x] 05-07-PLAN.md — Gap closure: info bar metrics fix (still failing)

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
**Plans**: 6 plans

Plans:
- [x] 06-01-PLAN.md — Config types, validation, localStorage persistence, database sync
- [x] 06-02-PLAN.md — Filter components (PositionFilters, PotTypeFilters, ModeToggle, GameSetup, ConfigCard)
- [x] 06-03-PLAN.md — Lobby screen with config cards and Start Training
- [x] 06-04-PLAN.md — Session sidebar drawer with mid-session filters and toast notifications
- [x] 06-05-PLAN.md — Drill suggestions and session summary screen
- [x] 06-06-PLAN.md — Visual verification checkpoint

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
**Plans**: 5 plans

Plans:
- [x] 07-01-PLAN.md — Range types, helpers, color scheme, and dependencies
- [x] 07-02-PLAN.md — RangeGridCell and RangeGridView components with stacked bars
- [x] 07-03-PLAN.md — ActionLegend and EquityBreakdown with tabbed views
- [x] 07-04-PLAN.md — RangeGridModal integration with PokerTable View Ranges button
- [x] 07-05-PLAN.md — Gap closure: wire heroRange/villainRange from session page to PokerTable

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
  6. User can flag difficult hands during review for later practice
**Plans**: 9 plans

Plans:
- [x] 08-01-PLAN.md — Stats API with Prisma aggregation (server-side data processing)
- [x] 08-02-PLAN.md — Dashboard layout with hero metrics and filter bar
- [x] 08-03-PLAN.md — Performance chart with Recharts and metric toggle (integrated into Performance tab)
- [x] 08-04-PLAN.md — Position heatmap and weakness breakdown with drill buttons (integrated into Positions tab)
- [x] 08-05-PLAN.md — Session history with pagination, sorting, and deletion (integrated into Sessions tab)
- [x] 08-06-PLAN.md — Human verification checkpoint
- [x] 08-07-PLAN.md — Flagged hands feature with flag/unflag API and review list
- [x] 08-08-PLAN.md — Gap closure: position, scenario, and street filter controls + auth token fix
- [x] 08-09-PLAN.md — Gap closure: session replay mode with hand-by-hand review cards

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
**Plans**: 7 plans

Plans:
- [ ] 09-01-PLAN.md — Foundation: install Motion, animationTiming constants, useAnimationPreferences hook, MotionConfig at root layout
- [ ] 09-02-PLAN.md — Card flip 3D animation (AnimatedCard component) + folded card muck in PlayerSeat
- [ ] 09-03-PLAN.md — EV reveal animations: ActionButton pulse on selection, EV slide-up, background color transition
- [ ] 09-04-PLAN.md — Audio infrastructure: AudioManager, sound name constants, useAudio hook
- [ ] 09-05-PLAN.md — Card deal entry animation + chip bet slide-in/collect-out in PokerTable
- [ ] 09-06-PLAN.md — Dealer button layoutId slide + modal transition utility for Phase 7
- [ ] 09-07-PLAN.md — Animation/audio settings toggles + human verification checkpoint

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
**Plans**: 7 plans

Plans:
- [ ] 10-01-PLAN.md — PostflopSpot types, board texture classification (TDD)
- [ ] 10-02-PLAN.md — Postflop solver bridge + mock solver + /api/postflop/solve route
- [ ] 10-03-PLAN.md — Multi-street state machine with off-solver-line tracking (TDD)
- [ ] 10-04-PLAN.md — Street action UI: bet size buttons, off-solver-line badge, context label, LRI token
- [ ] 10-05-PLAN.md — PostflopTrainingSession main component + postflop API client
- [ ] 10-06-PLAN.md — Hand summary screen + /postflop-training page with training loop
- [ ] 10-07-PLAN.md — Human verification checkpoint (POST-01 through POST-06)

### Phase 11: Supabase Database Integration
**Goal**: Migrate from Express/PostgreSQL/Prisma backend to Supabase with user accounts, practice spot hand database, and fully rewritten data layer
**Depends on**: Phase 2 (replaces backend foundation), Phase 3 (replaces auth)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. Supabase project configured with database schema for users, sessions, hands, and stats
  2. User account creation and authentication via Supabase Auth (replaces custom JWT/Argon2)
  3. Practice spot hand database stores and retrieves solver-generated training hands
  4. All existing data layer (SessionStore, Prisma queries, Express API routes) migrated to Supabase client
  5. Data layer rewrite provides same functionality with Supabase as backend
**Plans**: 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 11 to break down)

### Phase 12: Dashboard & Training Config Popout
**Goal**: Transform the lobby into a dashboard hub and the training config into a GTO-Wizard-style centered popout overlaying the poker table
**Depends on**: Phase 6 (trainer configuration), Phase 5 (preflop training)
**Requirements**: None (new user-defined scope)
**Success Criteria** (what must be TRUE):
  1. Dashboard at `/` shows training card and drill suggestions as the app's home page
  2. Clicking training card navigates to `/training` with config popout auto-opened over the poker table
  3. Config popout is a centered dialog with semi-transparent backdrop (table visible but dimmed behind)
  4. Starting training closes the popout and begins the session on the same page (no route change)
  5. Config popout can be reopened mid-session with locked session-level fields
  6. All existing `/lobby` links updated to point to `/` or `/training` as appropriate
  7. `/lobby` route remains functional for backward compatibility
**Plans**: 4 plans

Plans:
- [ ] 12-01-PLAN.md — Dashboard page at / + TrainingConfigDialog component
- [ ] 12-02-PLAN.md — Training page at /training with embedded training loop and config dialog overlay
- [ ] 12-03-PLAN.md — Update all /lobby references + AppHeader navigation restructure
- [ ] 12-04-PLAN.md — Human verification checkpoint (all 7 success criteria)
