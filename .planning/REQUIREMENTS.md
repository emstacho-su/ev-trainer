# Requirements: Poker Solver Training Platform v3

**Defined:** 2026-02-03
**Core Value:** Players can practice poker decisions and receive solver-accurate EV feedback that helps them identify and fix leaks in their game.

## v3 Requirements

Requirements for v3 release. Each maps to roadmap phases.

### Solver Core

- [ ] **SOLV-01**: CFR+ algorithm implemented in TypeScript with regret matching and strategy averaging
- [ ] **SOLV-02**: Card abstraction layer with E[HS] bucketing for tractable game trees
- [ ] **SOLV-03**: Bet sizing abstraction with configurable size options (e.g., 33%, 50%, 75%, 100%, all-in)
- [ ] **SOLV-04**: Game tree builder supporting preflop and postflop decision nodes
- [ ] **SOLV-05**: Preflop range generation for all position matchups (6-max: UTG, HJ, CO, BTN, SB, BB)
- [ ] **SOLV-06**: Postflop subgame solving for flop/turn/river decision points
- [ ] **SOLV-07**: Benchmark validation suite comparing outputs to PioSolver within 0.1% EV
- [ ] **SOLV-08**: Solver convergence within configurable iteration count with progress tracking

### Training UI (GTO Nexus Style)

- [x] **TRUI-01**: Oval table layout with 6 position nodes (UTG, HJ, CO, BTN, SB, BB) around perimeter
- [x] **TRUI-02**: Hero cards displayed at hero position with realistic card design
- [x] **TRUI-03**: Villain cards shown as face-down (hatched pattern) until revealed
- [x] **TRUI-04**: Community cards displayed in center with street indicator
- [x] **TRUI-05**: Pot size and pot type label displayed (SRP, 3BP, 4BP)
- [x] **TRUI-06**: Stack sizes shown at each position, updating on actions
- [x] **TRUI-07**: Action buttons below table (Fold, Call, Raise with bet sizes)
- [x] **TRUI-08**: Pre-action buttons are neutral/gray; post-action shows green (correct) or red (incorrect)
- [x] **TRUI-09**: EV and GTO frequency displayed on action buttons after decision
- [x] **TRUI-10**: Control buttons: Start, Next, Restart, Stop
- [x] **TRUI-11**: View Ranges button (postflop) opens range comparison modal
- [x] **TRUI-12**: 9-max table support (UTG, UTG+1, MP, HJ, CO, BTN, SB, BB, UTG+2)

### View Ranges Modal

- [ ] **RANG-01**: Side-by-side 13x13 Hero Range and Villain Range grids
- [ ] **RANG-02**: Range cells color-coded by action frequency (green=call, blue=fold, etc.)
- [ ] **RANG-03**: Current board cards displayed between range grids
- [ ] **RANG-04**: Equity breakdown by hand category (Overpair, Top Pair, Draws, etc.) for both players
- [ ] **RANG-05**: Overall action frequency summary at bottom (e.g., Fold 78.1%, Call 21.9%)

### Trainer Configuration

- [ ] **CONF-01**: Training Spot toggle: Preflop / Flop (street selection)
- [ ] **CONF-02**: Game Selection: Cash / HU mode toggle
- [ ] **CONF-03**: Table Size: 6-max / 9-max toggle
- [ ] **CONF-04**: Stack Depth: 50bb / 100bb / 200bb selection
- [ ] **CONF-05**: Villain Always Raise toggle for aggressive practice scenarios
- [ ] **CONF-06**: Position filters: select which positions to train
- [ ] **CONF-07**: Pot type filters: SRP, 3BP, 4BP selection

### Targeted Drilling

- [ ] **DRIL-01**: Drill specific position matchups (e.g., BB vs SB, CO vs BTN)
- [ ] **DRIL-02**: Drill specific pot types (e.g., 3bet pots IP, SRP OOP)
- [ ] **DRIL-03**: Drill weak spots identified from statistics
- [ ] **DRIL-04**: Quick-drill button from stats breakdown to start targeted session

### Preflop Training Mode

- [x] **PREF-01**: Opening range scenarios (first to act)
- [x] **PREF-02**: Facing open scenarios (call, 3bet, fold)
- [x] **PREF-03**: 3bet pot scenarios (4bet, call, fold)
- [x] **PREF-04**: Blind defense scenarios (BB vs positions, SB vs BB)
- [x] **PREF-05**: Preflop action history displayed on table

### Postflop Training Mode

- [ ] **POST-01**: Flop decision points with bet sizing options
- [ ] **POST-02**: Turn decision points continuing from flop
- [ ] **POST-03**: River decision points with showdown logic
- [ ] **POST-04**: Multi-street hand progression (play through entire hand)
- [ ] **POST-05**: Spot context labels ("3b IP Aggressor", "SRP OOP Caller")
- [ ] **POST-06**: Last Raiser Indicator (LRI) token next to aggressor

### Backend Infrastructure

- [ ] **BACK-01**: Express.js API server with TypeScript
- [ ] **BACK-02**: PostgreSQL database with Prisma ORM
- [ ] **BACK-03**: User table with email, password hash, OAuth provider, subscription tier
- [ ] **BACK-04**: Training session table with user reference, mode, config, timestamps
- [ ] **BACK-05**: Hands table with session reference, scenario, actions, EV metrics
- [ ] **BACK-06**: Spot stats table for per-spot performance aggregates
- [ ] **BACK-07**: Daily performance table for graphing trends
- [ ] **BACK-08**: AWS deployment (EC2 for API, RDS for PostgreSQL)

### Authentication

- [x] **AUTH-01**: User registration with email and password
- [x] **AUTH-02**: Email verification flow after registration
- [x] **AUTH-03**: Password reset via email link
- [x] **AUTH-04**: OAuth login with Google
- [x] **AUTH-05**: OAuth login with GitHub
- [x] **AUTH-06**: Session persistence across browser refresh
- [x] **AUTH-07**: Cross-device session sync via server

### Statistics & Analytics

- [ ] **STAT-01**: Performance graph with time filters (7D, 30D, 90D, All Time)
- [ ] **STAT-02**: EV accuracy trend line over time
- [ ] **STAT-03**: Per-spot type breakdown (position, pot type, street)
- [ ] **STAT-04**: Session history list with clickable entries
- [ ] **STAT-05**: Session detail view with all hands and grades
- [ ] **STAT-06**: Flagged hands feature to mark difficult spots
- [ ] **STAT-07**: Flagged hands review list
- [ ] **STAT-08**: Weakness detection highlighting consistently bad spots

### UI Visual Design

- [x] **VISU-01**: Dark theme with poker felt aesthetic (dark blue/green)
- [x] **VISU-02**: Realistic card designs with suit colors
- [x] **VISU-03**: Chip stack visualization with denominations
- [x] **VISU-04**: Position labels clearly readable
- [x] **VISU-05**: Responsive layout (1920x1080 base, scales to 1280x720)

### Animations

- [ ] **ANIM-01**: Card dealing animation (smooth flip)
- [ ] **ANIM-02**: Card slide animation (dealing to positions)
- [ ] **ANIM-03**: Chip movement animation (slide to pot on bets)
- [ ] **ANIM-04**: Action highlight animation (pulse on selection)
- [ ] **ANIM-05**: EV reveal animation (fade in after decision)
- [ ] **ANIM-06**: Smooth transitions between streets
- [ ] **ANIM-07**: Animation skip option for fast training

## v4 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Desktop App

- **DESK-01**: Electron or Tauri wrapper for desktop distribution
- **DESK-02**: Auto-update functionality
- **DESK-03**: Offline mode with local solver

### Advanced Features

- **ADVF-01**: Leak detection AI ("Folds too much to 3bets", "Misses thin value")
- **ADVF-02**: Custom range editor
- **ADVF-03**: Hand history import from poker sites
- **ADVF-04**: Tournament mode with ICM adjustments
- **ADVF-05**: Multi-way pot support (3+ players)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-money integration | Regulatory complexity, not core to training |
| Multiplayer/social features | Solo training tool focus |
| Mobile app | Web-first, desktop later, mobile deferred |
| Subscription/payments | Defer until user base established |
| Hand history import | Complex parsing, defer to v4 |
| Real-time chat | Not core to training value |
| Video content | Storage/bandwidth costs |
| GTOWizard data/assets | Legal constraint, must be original |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SOLV-01 | Phase 1 | Pending |
| SOLV-02 | Phase 1 | Pending |
| SOLV-03 | Phase 1 | Pending |
| SOLV-04 | Phase 1 | Pending |
| SOLV-05 | Phase 1 | Pending |
| SOLV-06 | Phase 1 | Pending |
| SOLV-07 | Phase 1 | Pending |
| SOLV-08 | Phase 1 | Pending |
| TRUI-01 | Phase 4 | Complete |
| TRUI-02 | Phase 4 | Complete |
| TRUI-03 | Phase 4 | Complete |
| TRUI-04 | Phase 4 | Complete |
| TRUI-05 | Phase 4 | Complete |
| TRUI-06 | Phase 4 | Complete |
| TRUI-07 | Phase 4 | Complete |
| TRUI-08 | Phase 4 | Complete |
| TRUI-09 | Phase 4 | Complete |
| TRUI-10 | Phase 4 | Complete |
| TRUI-11 | Phase 4 | Complete |
| TRUI-12 | Phase 4 | Complete |
| RANG-01 | Phase 7 | Pending |
| RANG-02 | Phase 7 | Pending |
| RANG-03 | Phase 7 | Pending |
| RANG-04 | Phase 7 | Pending |
| RANG-05 | Phase 7 | Pending |
| CONF-01 | Phase 6 | Pending |
| CONF-02 | Phase 6 | Pending |
| CONF-03 | Phase 6 | Pending |
| CONF-04 | Phase 6 | Pending |
| CONF-05 | Phase 6 | Pending |
| CONF-06 | Phase 6 | Pending |
| CONF-07 | Phase 6 | Pending |
| DRIL-01 | Phase 6 | Pending |
| DRIL-02 | Phase 6 | Pending |
| DRIL-03 | Phase 6 | Pending |
| DRIL-04 | Phase 6 | Pending |
| PREF-01 | Phase 5 | Complete |
| PREF-02 | Phase 5 | Complete |
| PREF-03 | Phase 5 | Complete |
| PREF-04 | Phase 5 | Complete |
| PREF-05 | Phase 5 | Complete |
| POST-01 | Phase 10 | Pending |
| POST-02 | Phase 10 | Pending |
| POST-03 | Phase 10 | Pending |
| POST-04 | Phase 10 | Pending |
| POST-05 | Phase 10 | Pending |
| POST-06 | Phase 10 | Pending |
| BACK-01 | Phase 2 | Pending |
| BACK-02 | Phase 2 | Pending |
| BACK-03 | Phase 2 | Pending |
| BACK-04 | Phase 2 | Pending |
| BACK-05 | Phase 2 | Pending |
| BACK-06 | Phase 2 | Pending |
| BACK-07 | Phase 2 | Pending |
| BACK-08 | Phase 2 | Pending |
| AUTH-01 | Phase 3 | Complete |
| AUTH-02 | Phase 3 | Complete |
| AUTH-03 | Phase 3 | Complete |
| AUTH-04 | Phase 3 | Complete |
| AUTH-05 | Phase 3 | Complete |
| AUTH-06 | Phase 3 | Complete |
| AUTH-07 | Phase 3 | Complete |
| STAT-01 | Phase 8 | Pending |
| STAT-02 | Phase 8 | Pending |
| STAT-03 | Phase 8 | Pending |
| STAT-04 | Phase 8 | Pending |
| STAT-05 | Phase 8 | Pending |
| STAT-06 | Phase 8 | Pending |
| STAT-07 | Phase 8 | Pending |
| STAT-08 | Phase 8 | Pending |
| VISU-01 | Phase 4 | Complete |
| VISU-02 | Phase 4 | Complete |
| VISU-03 | Phase 4 | Complete |
| VISU-04 | Phase 4 | Complete |
| VISU-05 | Phase 4 | Complete |
| ANIM-01 | Phase 9 | Pending |
| ANIM-02 | Phase 9 | Pending |
| ANIM-03 | Phase 9 | Pending |
| ANIM-04 | Phase 9 | Pending |
| ANIM-05 | Phase 9 | Pending |
| ANIM-06 | Phase 9 | Pending |
| ANIM-07 | Phase 9 | Pending |

**Coverage:**
- v3 requirements: 74 total
- Mapped to phases: 74
- Unmapped: 0

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after roadmap creation*
