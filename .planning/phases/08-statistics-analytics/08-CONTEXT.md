# Phase 8: Statistics & Analytics - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can track performance trends, identify weaknesses by position and scenario, and review session history with hand-level detail. Auth-required — guests see a sign-up prompt. Does not include real-time notifications, social comparison, or leaderboards.

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout
- Separate route (/stats), not a sidebar or drawer
- Auth required — guests prompted to sign up
- Hero section: 4 key metric cards (total hands, accuracy %, avg EV loss BB, current streak)
- Metric cards show trend delta arrows with percentage change vs previous period
- Below hero: performance chart (line chart)
- Below chart: tabbed sections — Performance / Positions / Sessions
- Global sticky filter bar at top (date range + position/scenario filters apply across all tabs)

### Chart & graph style
- Line chart for performance trends — modern minimal aesthetic (Linear/Vercel style)
- Default metric: Avg EV loss (BB)
- Single metric displayed at a time with dropdown toggle
- 5 toggleable metrics: Accuracy %, Avg EV loss, Hands played, Correct fold %, Correct raise %
- Time range: preset buttons (7d / 30d / 90d / All) plus custom date picker option
- Adaptive data points: per-session for 7d view, daily aggregates for 30d+
- Rich tooltips on hover: date, metric value, hand count, session count

### Weakness detection
- Position heatmap: 6-max table layout as overview, position-vs-position matrix as drill-down
- Heatmap color scheme: red (weak) → yellow (average) → green (strong)
- Heatmap cells show color intensity + metric number overlay
- Heatmap metric toggleable between accuracy % and avg EV loss
- Show all data regardless of sample size, visually indicate low confidence below threshold (faded/asterisk)
- Weakness breakdown toggleable between scenario-type view (RFI, Facing Open, 3Bet, Blind Defense) and action-error view
- Action-error view: top-level fold/call/raise accuracy, expandable to show mistake direction (too passive vs too aggressive)
- Direct "Drill this" button on each weakness row to start filtered training session

### Session history
- Recent sessions (last 24h): expanded card format (date, duration, hands, accuracy, EV loss, scenario breakdown)
- Older sessions: compact summary row (date, hand count, accuracy %, avg EV loss)
- Session expand reveals "Biggest mistakes" section with highest EV loss hands
- Session replay: summary with hand list as default, hand-by-hand replay mode available
- Hand-by-hand replay uses simplified review cards (not full poker table)
- Sortable columns: date, accuracy, EV loss, hand count
- Filterable by date range and scenario type
- Pagination (not infinite scroll)
- Sessions deletable with confirmation dialog — full removal from all stats and charts

### Claude's Discretion
- Charting library choice
- Exact spacing, typography, and responsive breakpoints
- Pagination page size
- Low-confidence threshold value (e.g., 10 hands, 20 hands)
- Loading states and skeleton design
- Empty state messaging for new users with no data
- Review card layout for hand-by-hand replay

</decisions>

<specifics>
## Specific Ideas

- Chart aesthetic should match Linear/Vercel dashboards — clean lines, muted colors, subtle grid on dark theme
- Heatmap drill-down: clicking a position on the table layout opens the matrix filtered to that position's matchups
- "Drill this" buttons create a direct path from stats insight to training action — no friction

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-statistics-analytics*
*Context gathered: 2026-02-16*
