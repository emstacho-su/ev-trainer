# Feature Landscape

**Domain:** GTO Poker Training Platform
**Researched:** 2026-02-03
**Confidence:** MEDIUM (based on training data, not web-verified)

## Table Stakes

Features users expect. Missing = product feels incomplete or unusable.

### Preflop Training

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 13x13 range grid display | Universal convention for preflop ranges; users trained on this format from GTO Wizard/PioSolver/etc. | Medium | Standard 13x13 matrix (AA top-left to 22 bottom-right), pairs on diagonal, suited above, offsuit below |
| Color-coded action frequencies | Shows mixed strategies visually; pure colors mislead users about mixed strategies | Medium | Each cell shows frequency breakdown (e.g., 60% raise, 40% fold) via stacked colors |
| Position-based scenarios | RFI, vs 3bet, vs 4bet are distinct spots | Low | Filter by scenario type (open, call, 3bet, 4bet) and position |
| Stack depth presets | MTT vs cash game ranges differ dramatically | Low | Common buckets: 20bb, 40bb, 60bb, 100bb, 150bb+ |
| Immediate action grading | Must show correct vs user action instantly | Low | Already have EV grading pipeline; extend to preflop |
| Full range reveal post-decision | Show GTO strategy for the spot after user commits | Medium | Display the complete 13x13 grid with all frequencies |

### Range Visualization

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Consistent color scheme | Industry converged on red=raise/bet, green=call, blue=fold pattern | Low | GTO Nexus/Wizard/Pio all use this; deviating confuses users |
| Frequency percentages on hover/click | Users need exact numbers, not just visual | Low | Tooltip or panel showing 47.2% raise, 32.1% call, etc. |
| Heat map intensity | Brighter = higher frequency for that action | Low | Visual encoding of probability |
| Hand category grouping | Pairs, suited, offsuit visually distinct | Low | Standard diagonal/above/below layout |
| Mixed strategy indication | Clear when action is mixed vs pure | Low | Visual difference between 100% action and 60/40 split |

### Statistics Dashboard

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session history list | Need to see past sessions to track progress | Low | Already have RecentSessionsList; extend with better metadata |
| Per-session summary stats | Mean EV loss, best-action rate, volume | Low | Already built in v2 |
| Time-based filtering | 7D/30D/90D/All Time views are standard | Medium | Requires date indexing on decisions |
| Aggregate totals | Total decisions, total sessions, overall EV loss | Low | Already have global stats; ensure persistence |
| Per-spot-type breakdown | "How am I doing on BTN opens?" | Medium | Requires tagging decisions with spot metadata |

### Session Review

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| EV-sorted mistake list | Biggest mistakes first for review | Low | Already implemented in v2 |
| Per-decision detail view | Full spot context, GTO strategy, user action | Low | Already have ReviewDecisionDetail |
| Side-by-side comparison | User action vs GTO action frequencies | Medium | Show user choice against full mixed strategy |
| Filter by mistake severity | Show only hands with >0.5bb EV loss | Low | Threshold filter on existing review list |

## Differentiators

Features that set product apart. Not expected, but valued.

### Preflop Training UX

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Range comparison view (Hero vs Villain) | Shows both ranges side-by-side; helps understand range interactions | High | GTO Nexus style; two 13x13 grids with overlap indicators |
| "Why this action" explanations | Educational value beyond just showing correct answer | Very High | Requires reasoning engine or pre-written explanations |
| Scenario tree navigation | Navigate RFI -> 3bet -> 4bet tree structure | Medium | Tree UI showing decision branches |
| Custom scenario creation | Let users create specific spots to drill | Medium | Scenario builder with position/stack/prior action inputs |
| Preflop quiz mode (random scenarios) | Rapid-fire drilling across different spots | Low | Already have targeted drill pattern; extend to preflop |

### Range Visualization

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Animated range evolution | Show how ranges change through betting tree | Very High | Advanced visualization; potentially future |
| Equity vs range calculator | Instant equity display on hover | High | Requires equity calculations for all combos |
| Combo blocker display | Show which combos block villain's value/bluffs | High | Requires range analysis tools |
| Export range as image | Share/save ranges externally | Low | Canvas or SVG export |
| Custom color themes | Accessibility and preference | Low | User-configurable color palette |

### Statistics Dashboard

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Performance graphs over time | Visual trend analysis (EV loss improving?) | Medium | Line/area charts with time axis |
| Weakness detection | Auto-identify worst spot types | Medium | Aggregation + ranking by EV loss |
| Practice recommendations | "You should work on CO vs BB 3bet" | High | Requires analysis logic to identify gaps |
| Comparison to benchmarks | "You're in top 20% for this spot type" | Very High | Requires aggregate user data |
| Daily streak tracking | Gamification/habit formation | Low | Simple counter with date tracking |
| Export statistics | CSV/PDF reports | Medium | Data serialization and formatting |

### Session Review

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Hand replay animation | Visual recreation of the hand | High | Card dealing, action animations, pot changes |
| Note-taking on hands | Personal annotations for study | Medium | Text field per decision, persisted |
| Tag hands for drilling | "Practice this spot more" flag | Low | Boolean flag + filter for targeted drill |
| Share hand for discussion | Link sharing for forums/Discord | Medium | Shareable URLs with decision state |
| Range equity graphs | Show equity distribution through hand | Very High | Complex visualization |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-money integration | Regulatory nightmare, liability, distracts from training value | Keep as pure training tool |
| Multiplayer/social training | Adds massive complexity, dilutes focus | Solo training with optional export for external discussion |
| AI opponent chat/personality | Gimmick that doesn't improve training | Focus on accurate GTO feedback |
| Gacha/loot box mechanics | Exploitative, damages trust | Straightforward subscription model (future) |
| Leaderboards with real usernames | Privacy concerns, potential for harassment | Anonymous percentile ranks only if any |
| Auto-play suggestions | Removes learning opportunity | Show GTO action only AFTER user commits |
| Excessive animations | Slows down training pace, frustrates serious users | Quick, skippable, optional animations |
| Copy GTOWizard/PioSolver UI directly | Legal risk, also misses opportunity for originality | Original design inspired by conventions |
| Hand history import from real play | Scope creep, format complexity, focus on training spots | Training scenarios only (may reconsider v4+) |
| Video content integration | Storage costs, content creation burden | External links only, training-focused |

## Feature Dependencies

```
Preflop Mode
├── 13x13 Grid Component (required first)
│   └── Color-coded action frequencies
│       └── Mixed strategy display
├── Preflop Scenario System
│   └── Position/stack scenarios
│       └── RFI/3bet/4bet tree
└── Solver integration (CFR+ for preflop)

Statistics Dashboard
├── Decision persistence with metadata (already have)
│   └── Spot-type tagging on decisions
│       └── Per-spot aggregation
├── Time-indexed storage
│   └── Time-based filtering
│       └── Performance graphs
└── Session history (already have)

Range Visualization
├── 13x13 Grid Component (shared with preflop)
│   └── Hover/click interactions
│       └── Frequency tooltips
└── Solver output parsing
    └── Action frequency extraction
```

## MVP Recommendation

For v3 MVP, prioritize:

1. **13x13 range grid component** - Foundation for all preflop features; reusable for range visualization
2. **Preflop training mode with basic scenarios** - Core new capability; RFI and vs-3bet are highest volume
3. **Performance graphs** - Visual progress feedback drives retention
4. **Solver integration for preflop** - Requires CFR+ or equivalent to provide accurate GTO strategies

### Phase Suggestion

**Phase 1: Range Grid + Preflop Basics**
- 13x13 grid component
- Action frequency display
- RFI scenarios (all positions)
- Session grading extended to preflop

**Phase 2: Preflop Tree + vs-3bet**
- vs-3bet scenarios
- Scenario selection UI
- Range reveal after decision

**Phase 3: Statistics Overhaul**
- Performance graphs (7D/30D/90D)
- Per-spot-type breakdown
- Daily aggregates

**Phase 4: Polish + Differentiation**
- Range comparison view
- Hand tagging for drilling
- Export features

### Defer to post-MVP:

| Feature | Reason to Defer |
|---------|-----------------|
| Hand replay animation | High complexity, nice-to-have not must-have |
| Practice recommendations | Requires substantial data before valuable |
| Custom scenario creation | Power user feature; standard scenarios first |
| Equity calculators | Complex, not core training flow |
| Note-taking system | Can use external tools initially |

## Confidence Notes

| Feature Category | Confidence | Reason |
|------------------|------------|--------|
| 13x13 grid pattern | HIGH | Universal industry standard, confirmed across all major products |
| Color conventions (R/G/B) | HIGH | Consistent across GTO Wizard, GTO Nexus, PioSolver |
| Statistics dashboard patterns | MEDIUM | Common in training apps; specific implementations vary |
| Preflop scenario tree structure | MEDIUM | Based on GTO Wizard patterns; may have evolved |
| Differentiator value props | MEDIUM | Subjective; based on user feedback patterns in training |

**Note:** These findings are based on training data (knowledge cutoff May 2025). Specific product features may have changed. Recommend validating key assumptions about competitor UX patterns before major UI decisions.

## Sources

- Training data on GTO Wizard, GTO Nexus, PioSolver feature sets (unverified, based on pre-May 2025 knowledge)
- Existing v2 codebase analysis (HIGH confidence for current state)
- PROJECT.md v3 requirements (HIGH confidence for planned features)

**Verification needed:** Specific competitor UI patterns should be manually reviewed before implementation to ensure conventions haven't shifted.
