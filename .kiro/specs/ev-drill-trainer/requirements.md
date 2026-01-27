# ev-drill-trainer — Requirements

Created: 2026-01-27T21:50:26Z
Updated: 2026-01-27T21:54:00Z

## Project Description
Build a web app (Next.js + TypeScript) that drills poker decision points (spots) and grades every user action by EV loss vs a solver strategy baseline. Opponents act by sampling from solver mixed frequencies. Must integrate an open-source solver via an adapter (service/WASM/hybrid to be decided), cache solver outputs by canonical node hash, and use deterministic RNG seeding. Must not copy GTOWizard UI/text/assets/branding/datasets. Modes: Spot Quiz, Hand Play, Review/Mistakes by EV loss, Targeted Drill. Toggles: preflop/postflop, streets, positions, stack depth presets, board buckets, tree restrictions, feedback verbosity.

## 0. MVP Scope (Keep Tractable)
### 0.1 Game Family (MVP)
- Format: Heads-up NLHE cash.
- Positions: BTN/SB vs BB only.
- Effective stacks: 100bb fixed (MVP); future: presets.
- Antes: none (MVP).
- Rake: ignored for MVP EV computations (explicitly document if added later).

### 0.2 Spot Definition (MVP)
- A “spot” is a single decision node in a solved game tree (public state + action history + whose turn).
- Spot presentation sources nodes from solver outputs (from cache or freshly solved), subject to active filters.

### 0.3 Action Abstraction / Tree Definition (MVP)
- Streets supported: flop/turn/river (preflop toggle exists; preflop training may be deferred).
- Allowed actions per node are discrete and come from the tree definition:
  - Check / Call / Fold where legal
  - Bet sizes (when betting is legal): 33% pot, 75% pot
  - Raise sizes (when raising is legal): 2.5x raise, all-in
- Raise cap: max 2 raises per street (MVP).
- If user selects a sizing not in the abstraction, the system must map it deterministically to the nearest allowed size (mapping rule defined in design; deterministic + tested).

### 0.4 Non-goals (MVP)
- No multiway, no 6-max, no PLO.
- No custom range editor or hand history import.
- No exploitative/learned opponents (only solver-based with optional transforms).
- No attempt to replicate GTOWizard UI/text/branding; all content is original.

## 1. Training Modes
- Spot Quiz: present a single decision point; user chooses one action; grade immediately.
- Hand Play: present sequential decisions for a hand until terminal state.
- Review/Mistakes: resurface prior decisions ordered by EV loss (EV-first).
- Targeted Drill: generate spots that match current toggle constraints.
- Mode switching preserves toggles unless changed by user.

## 2. EV-first Decision Grading (Primary Metric)
### 2.1 Required solver outputs for a node
For node N with legal actions A = {a1..ak}, solver provides:
- Frequencies p(ai) for each ai (mixed strategy), with Σ p(ai) = 1
- Action EVs EV(ai) in consistent units (chips or bb; must be explicit)

### 2.2 EV baselines and EV loss definitions
Compute:
- EV_best(N) = max_i EV(ai)
- EV_mix(N) = Σ_i p(ai) * EV(ai)

When user chooses action a_user:
- EV_user = EV(a_user)
- EV_loss_vs_mix = EV_mix(N) - EV_user   (PRIMARY grading metric)
- EV_loss_vs_best = EV_best(N) - EV_user (SECONDARY, optional display)

### 2.3 Mixed strategies handling
- If solver mixes, EV_mix is the baseline for “play like the solver overall”.
- EV_loss_vs_best indicates regret vs the single best action at that node.
- The system must store both values (at least for MVP internal records), and ranking/review ordering uses EV_loss_vs_mix.

### 2.4 Secondary metrics (allowed but subordinate to EV)
- Policy divergence: e.g., whether chosen action probability under solver is below a threshold.
- “Pure mistake” flag: chosen action has solver frequency ~0 (threshold defined in design).
- Secondary metrics must never override EV-based ordering or the primary grade.

## 3. Opponent Policy Execution (Base + Future Transforms)
- Base opponent policy is the solver mixed strategy p(ai) at each node.
- Opponent action selection samples from the opponent policy distribution at the node.

### 3.1 Deterministic RNG requirement
- Session config provides a seed.
- Given identical (seed, config, spot selection), opponent actions must be reproducible.

### 3.2 Playstyle transforms (required for extensibility)
- Opponent policy must be representable as: p'(ai) = Normalize( p(ai) * w(ai, context, params) )
  - Example transforms: under-bluffing, over-calling, tighter/looser.
- EV grading remains anchored to the base solver outputs (EV_best / EV_mix) to keep EV reporting consistent.
- Optionally, system may also report “EV vs this opponent” later, but MVP grading is solver-anchored.

## 4. Solver Integration (Adapter Contract Required)
- Must use an existing open-source solver (license respected); integration approach decided in design (service / WASM / hybrid).
- The system must define a solver adapter API contract:

### 4.1 Adapter input (minimum)
- Game family version + tree/abstraction version
- Public state: street, pot, effective stack, board cards
- Action history (canonicalized)
- Player to act
- Any required range/strategy context required by chosen solver (documented)

### 4.2 Adapter output (minimum)
For each legal action:
- Action identifier (type + size if applicable)
- Frequency p(ai)
- EV(ai)
Plus:
- Optional metadata (solver node id, solve status, exploitability if available)
- Any data needed to continue the hand to child nodes

## 5. Caching + Persistence
- Every node must have a canonical node hash (stable across runs for identical state + abstraction + versions).
- Cache strategy (MVP requirement):
  - Memory cache (fast)
  - Persistent cache on disk (so repeated training doesn’t re-solve identical nodes)
- Cache entries keyed by canonical node hash include the adapter output payload.
- Cache must be versioned by (game family version, abstraction version, solver version/config) to avoid stale mismatches.

## 6. Configuration Toggles (Apply to Any Mode)
- Preflop ON/OFF (even if preflop training is deferred, the toggle exists).
- Postflop ON/OFF.
- Streets multi-select.
- Position matchup selection (MVP: BTN vs BB only; structure supports future).
- Stack depth presets (MVP: 100bb fixed; structure supports future).
- Board selection rules: random vs board buckets.
- Tree restriction controls (simplified sizes; cap raises).
- Feedback verbosity.

## 7. Review + Progress Tracking (EV-first)
- Each graded decision record stores:
  - node hash, mode, filters/config snapshot, seed, timestamp
  - user action, EV_user, EV_mix, EV_best
  - EV_loss_vs_mix (primary), EV_loss_vs_best (secondary)
  - optional secondary metrics
- Review ordering defaults to highest EV_loss_vs_mix first.
- Progress summaries are EV-first (aggregate EV loss, distribution, trend over time).

## 8. UI/Content Originality
- The system shall not include GTOWizard proprietary UI, text, assets, branding, datasets, or solver outputs.
- All labels/explanations/visuals are original.

## 9. Platform and Compatibility
- Next.js (App Router) + TypeScript + Tailwind CSS.
- Modern desktop + mobile browsers.

## 10. Acceptance Criteria (MVP)
- Spot Quiz: given a node with solver output, user selects an action and sees EV_loss_vs_mix immediately; record is saved.
- Hand Play: system can advance through >1 decision in a hand with opponent actions sampled from policy; each user decision is graded and saved.
- Review/Mistakes: displays saved decisions sorted by EV_loss_vs_mix descending; selecting an item shows chosen action + EV numbers.
- Targeted Drill: changing filters alters spot generation to match constraints (at least streets + board buckets + tree restriction).
- Determinism: with the same seed/config, opponent action sampling is reproducible for a fixed sequence of nodes.
- Caching: requesting the same node twice uses cache on second request (observable via logs/telemetry defined in design).

## Status
Requirements generated (reviewed + refined).
