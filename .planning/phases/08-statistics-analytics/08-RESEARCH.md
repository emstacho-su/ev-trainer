# Phase 8: Statistics & Analytics - Research

**Researched:** 2026-02-16
**Domain:** React dashboard with time-series charts, heatmaps, date range filters, and server-side data aggregation
**Confidence:** HIGH (charting), HIGH (architecture), MEDIUM (specific pitfalls)

## Summary

Phase 8 requires building a performance analytics dashboard with time-series line charts, position heatmaps, and session history tables. The architecture prioritizes server-side data aggregation for performance, with adaptive UI that adjusts data granularity based on selected time range. Chart libraries have matured significantly in 2026, with SVG-based options (Recharts) remaining viable for typical dashboard use cases while Canvas-based approaches gain traction for large datasets. The key technical choices are: (1) charting library with dark theme support, (2) heatmap visualization approach, (3) date range picker integration, and (4) server-side aggregation patterns.

**Primary recommendation:** Use Recharts for performance charts (high customization with dark theme support), build heatmap as a custom Tailwind-styled grid component (simplicity + design control), implement date range filters with shadcn/ui Date Picker (Tailwind native, familiar API), and perform server-side aggregation in Prisma queries with careful indexing.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 2.12+ | Time-series line charts and visualizations | SVG-based, highly customizable, dark theme support via CSS variables, excellent Tailwind integration, 24.8K GitHub stars, most common choice in 2026 React dashboards |
| shadcn/ui Date Picker | 0.3.4+ | Date range selection with presets | Tailwind CSS native, Radix UI based, form-ready, mobile responsive, integrates seamlessly with Tailwind utilities |
| Prisma 7.x | 7.3.0+ | Server-side aggregation queries | Already in project, supports `groupBy()`, `aggregate()`, and `_sum/_avg/_count` operations for statistics |
| React DayPicker | 8.9+ | Calendar component (via shadcn/ui) | Lightweight, no jQuery dependency, accessible, foundation for shadcn Date Picker |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 3.0+ | Date manipulation and formatting | Formatting dates for charts and tables, timezone handling, required by shadcn/ui Calendar |
| Tailwind CSS | 4.1.18 | Grid-based heatmap styling | Custom heatmap cells with dynamic background colors, matches existing project styling |
| clsx | 2.1.1+ | Conditional CSS class merging | Dynamic color classes for heatmap cells based on intensity values |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Victory, Chart.js via react-chartjs-2, ECharts | Victory lacks dark theme maturity; Chart.js uses Canvas (overkill for typical dataset sizes); ECharts requires D3 mastery, heavier bundle |
| shadcn/ui Date Picker | react-date-range, Tremor DateRangePickerValue | react-date-range requires separate styling; Tremor couples chart + filter UI, reducing flexibility |
| Custom Tailwind heatmap | MUI X Heatmap, Syncfusion, AG Charts | MUI X adds Material theming layer (conflicts with poker aesthetic); Syncfusion/AG Charts are enterprise libraries with licensing; custom approach gives full design control |

**Installation:**
```bash
npm install recharts date-fns
# shadcn/ui, Tailwind, and Prisma already in project
# Add shadcn/ui date picker if not already present:
npx shadcn-ui@latest add calendar
npx shadcn-ui@latest add popover
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/stats/                    # /stats route
│   ├── page.tsx                  # Layout: hero metrics + sticky filter bar
│   ├── layout.tsx                # Auth guard + metadata
│   └── components/
│       ├── MetricCards.tsx        # 4 hero cards with trend deltas
│       ├── PerformanceChart.tsx   # Line chart with metric dropdown
│       ├── FilterBar.tsx          # Sticky date range + position filters
│       ├── PositionHeatmap.tsx    # 6-max layout overview
│       ├── HeatmapMatrix.tsx      # Position-vs-position drill-down
│       ├── WeaknessBreakdown.tsx  # Scenario or action-error view
│       └── SessionHistory.tsx     # Recent/older sessions with pagination
├── lib/stats/                    # Business logic
│   ├── aggregation.ts            # Server-side aggregation functions
│   ├── types.ts                  # PerformanceMetric, SessionData, etc.
│   └── filters.ts                # Date range + position parsing
└── server/routes/stats.routes.ts # API endpoints for dashboard
```

### Pattern 1: Server-Side Data Aggregation
**What:** Calculate statistics at the database layer using Prisma's `groupBy()` and `aggregate()` rather than fetching raw data and computing in React.
**When to use:** Always—this is non-negotiable for performance. Never fetch thousands of hand records to compute daily averages in the browser.
**Example:**
```typescript
// Source: Prisma aggregation guide
// Get daily accuracy and EV loss aggregates
const dailyStats = await prisma.decision.groupBy({
  by: ['date'],
  where: {
    userId: session.userId,
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  },
  _count: true,
  _avg: { evLoss: true },
  _sum: { isCorrect: true },
  orderBy: { date: 'asc' },
});

// Transform into chart format
const chartData = dailyStats.map(day => ({
  date: day.date.toISOString().split('T')[0],
  accuracy: (day._sum.isCorrect / day._count) * 100,
  avgEVLoss: day._avg.evLoss,
  hands: day._count,
}));
```

### Pattern 2: Adaptive Data Granularity by Time Range
**What:** Adjust database query and chart rendering based on selected date range—per-session for 7D, daily aggregates for 30D+, weekly for 90D+.
**When to use:** Balances detail (can see session impact) with performance (not rendering 10,000 data points).
**Example:**
```typescript
// Determine aggregation level based on range
const getRangeGranularity = (startDate: Date, endDate: Date) => {
  const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 7) return 'session'; // One point per session
  if (days <= 30) return 'day';    // One point per day
  return 'week';                    // One point per week
};

// In API endpoint:
const granularity = getRangeGranularity(startDate, endDate);
const stats = granularity === 'session'
  ? await fetchSessionStats(userId, startDate, endDate)
  : await fetchAggregatedStats(userId, startDate, endDate, granularity);
```

### Pattern 3: Sticky Filter Bar with Global State
**What:** Position filter controls at the top of the page; apply filters to all tabs (Performance, Positions, Sessions) simultaneously.
**When to use:** Standard dashboard pattern when multiple sections need synchronized filtering.
**Example:**
```typescript
// In FilterBar component
interface StatsFilters {
  dateRange: { start: Date; end: Date };
  positions?: string[]; // e.g., ['BTN', 'CO', 'SB']
  scenarios?: string[]; // e.g., ['RFI', 'FaceOpen']
}

// Share via URL params or React context
const [filters, setFilters] = useSearchParams(); // Prefer URL for bookmarking
// All child components subscribe to these params
```

### Pattern 4: Recharts Line Chart with Custom Tooltip
**What:** Use Recharts `<LineChart>` with `<Tooltip>` that renders rich data (date, metric, hand count, session count).
**When to use:** Standard time-series visualization in React.
**Example:**
```typescript
// Source: Recharts documentation
<LineChart data={chartData} width={1000} height={400}>
  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
  <XAxis dataKey="date" stroke="#666" />
  <YAxis stroke="#666" />
  <Tooltip
    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }}
    formatter={(value) => value.toFixed(2)}
    labelFormatter={(label) => `Date: ${label}`}
  />
  <Line
    type="monotone"
    dataKey="avgEVLoss"
    stroke="#10b981"
    dot={false}
    isAnimationActive={false}
  />
</LineChart>
```

### Pattern 5: Custom Tailwind Heatmap Grid
**What:** Build heatmap as a simple grid of cells, each colored via Tailwind background utilities or inline styles, avoiding heavyweight charting libraries.
**When to use:** For fixed-size matrices (6x6 for 6-max, or custom matchup grids) where you need full design control to match the poker aesthetic.
**Example:**
```typescript
// Source: Tailwind grid styling pattern
interface HeatmapCell {
  label: string; // e.g., 'UTG vs BTN'
  value: number; // accuracy % or avg EV loss
  confidence: boolean; // sample size >= threshold
}

const getHeatmapColor = (value: number, min: number, max: number) => {
  const normalized = (value - min) / (max - min);
  if (normalized < 0.33) return 'bg-red-900'; // weak
  if (normalized < 0.66) return 'bg-yellow-700'; // average
  return 'bg-green-800'; // strong
};

<div className="grid grid-cols-7 gap-1">
  {cells.map((cell) => (
    <div
      key={cell.label}
      className={`p-2 text-center text-sm font-mono rounded ${getHeatmapColor(
        cell.value,
        0,
        100
      )} ${!cell.confidence ? 'opacity-40' : ''}`}
    >
      {cell.value.toFixed(1)}
      {!cell.confidence && <span className="ml-1">*</span>}
    </div>
  ))}
</div>
```

### Pattern 6: Session History Pagination with Sortable Headers
**What:** Display sessions in a table with sortable columns (date, accuracy, EV loss) and cursor-based pagination.
**When to use:** For lists of 50+ items where infinite scroll isn't appropriate.
**Example:**
```typescript
// API endpoint structure
GET /api/stats/sessions?userId=X&page=1&pageSize=20&sortBy=date&order=desc

// Response includes cursor for next page
{
  sessions: [...],
  nextCursor: "2026-02-15T12:00:00Z",
  hasMore: true
}

// In React, fetch next page via:
const fetchNextPage = () => {
  fetch(`/api/stats/sessions?cursor=${nextCursor}&pageSize=20`);
};
```

### Anti-Patterns to Avoid
- **Fetching all historical data then filtering in React:** Kills performance. Always filter in the database query (`where` clause).
- **Building custom line chart from scratch:** Use Recharts. D3 setup is overkill and wastes time.
- **Rendering heatmap as SVG via Recharts:** Overkill complexity. Use simple HTML grid, much easier to customize.
- **Client-side date range picker without URL params:** Users can't bookmark/share filtered views. Store filters in `?startDate=X&endDate=Y`.
- **Hardcoding color values:** Use Tailwind color classes or CSS variables for dark theme consistency.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range selection UI | Custom calendar picker | shadcn/ui Date Picker (based on React DayPicker) | Handles keyboard navigation, accessibility, localization, and edge cases (leap years, DST) that are tedious to implement |
| Time-series line charts | Canvas/SVG from scratch | Recharts | Recharts handles responsive sizing, touch interactions, tooltips, animations, and accessibility out of the box; custom approach requires 500+ LOC |
| Heatmap color gradients | Manual HSL/RGB math | Tailwind color utilities + `clsx` for conditional classes | Tailwind provides tested color palettes; manual color math introduces bugs and inconsistencies |
| Dashboard filter state management | Redux/useReducer | URL search params via `useSearchParams()` | URL params survive page refresh, enable bookmarking, reduce state complexity; searchParams is built into Next.js |
| Data aggregation logic | JavaScript loops and reduce() | Prisma `groupBy()` and `aggregate()` | Prisma queries generate optimized SQL; JavaScript reduces massive datasets into memory, causing hangs |

**Key insight:** This phase is a showcase of "use the database for heavy lifting." React's job is to render what Prisma already computed. Any temptation to move aggregation into React is a performance trap.

## Common Pitfalls

### Pitfall 1: Rendering 10,000 Data Points on the Chart
**What goes wrong:** User selects "All Time", and the chart attempts to render one point per hand (10,000+ points). Browser freezes, chart is unusable.
**Why it happens:** No aggregation in the database query; fetched raw Decisions and mapped them directly to chart points.
**How to avoid:** Always aggregate server-side. Use adaptive granularity: 7D shows per-session, 30D+ shows daily. If user selects "All Time" for a 5-year-old account, return weekly aggregates.
**Warning signs:** Performance inspector shows 10,000+ DOM nodes in the chart; browser tab becomes unresponsive when date range changes.

### Pitfall 2: Date Range Filters Not Persisted in URL
**What goes wrong:** User filters to "last 30 days", leaves the page, comes back—filters are lost. Or tries to share the link with a friend and they see different data.
**Why it happens:** Filters stored only in React state (useState), not in URL params.
**How to avoid:** Use `useSearchParams()` and update the URL whenever filters change. Example: `/stats?startDate=2026-02-01&endDate=2026-02-16&positions=BTN,CO`.
**Warning signs:** No query string in the URL address bar; filters reset on page reload.

### Pitfall 3: Hardcoded Color Values Breaking Dark Theme
**What goes wrong:** Chart tooltips have `backgroundColor: '#ffffff'`, labels have `color: '#000'`. On dark theme, text is invisible.
**Why it happens:** Colors copied from light theme design without considering theme switching.
**How to avoid:** Use CSS variables or Tailwind color utilities. Define colors in `globals.css`: `--chart-bg: hsl(var(--background))`. Reference in Recharts: `contentStyle={{ backgroundColor: 'var(--chart-bg)' }}`.
**Warning signs:** Text disappears when dark mode is enabled; designer reports "the stats page looks broken at night."

### Pitfall 4: Low-Confidence Data Not Visually Distinct
**What goes wrong:** User sees a heatmap cell showing "92% accuracy" in a position with only 3 hands. They drill down to train, then after 20 hands they're at 50%. Confusion and frustration.
**Why it happens:** Heatmap cells colored identically regardless of sample size.
**How to avoid:** Below a threshold (e.g., <20 hands), make cells visually distinct: faded opacity, asterisk overlay, or striped pattern. Document the threshold in UI: "* less than 20 hands".
**Warning signs:** Users report "the stats don't match reality"; weak positions suddenly become strong with a few lucky hands.

### Pitfall 5: Session History Not Sortable or Filterable
**What goes wrong:** User has 300 sessions and wants to find sessions from January where accuracy was under 50%. Can't sort by accuracy, can't filter by month without manually scrolling.
**Why it happens:** Session list is static or only supports date filtering.
**How to avoid:** Make table headers clickable to sort by column (date, accuracy, EV loss, hand count). Support filtering: date range picker, scenario filter, accuracy threshold slider. Store these in URL params.
**Warning signs:** Session list loads very slowly; pagination is missing entirely.

### Pitfall 6: Missing or Vague Loading States
**What goes wrong:** User clicks a filter button, nothing happens for 3 seconds, they think the app is broken and click again. Two requests fire.
**Why it happens:** No loading skeleton or spinners; no debouncing on filter changes.
**How to avoid:** Show a skeleton card for metrics while stats load. Debounce filter changes (300ms): `const debouncedFilters = useDebounce(filters, 300)`. Disable the filter button during a request: `<button disabled={isLoading}>...`.
**Warning signs:** Filter buttons are rapidly clicked; duplicate API requests appear in network tab.

### Pitfall 7: Tooltip Content Overflowing on Mobile
**What goes wrong:** Recharts tooltip on mobile shows "Date: 2026-02-16, Hands: 450, Accuracy: 72.3%, Avg EV Loss: 1.2" but the text runs off-screen.
**Why it happens:** No responsive tooltip sizing; fixed width tooltip.
**How to avoid:** Use Recharts `Tooltip` with `wrapperStyle={{ maxWidth: '90vw' }}` and format content concisely. Test on mobile devices.
**Warning signs:** Tooltip text is cut off or unreadable on phone/tablet.

## Code Examples

Verified patterns from official sources:

### Time-Series Chart with Adaptive Tooltips
```typescript
// Source: Recharts documentation + dark theme pattern
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const PerformanceChart = ({ data, metric = 'avgEVLoss' }) => {
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload) return null;
    const dataPoint = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200">
        <p className="font-mono">{dataPoint.date}</p>
        <p>{metric === 'avgEVLoss' ? 'Avg EV Loss' : 'Accuracy %'}: {dataPoint[metric]?.toFixed(2)}</p>
        <p className="text-slate-400">Hands: {dataPoint.hands}</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#64748b' }} />
        <Line
          type="monotone"
          dataKey={metric}
          stroke="#10b981"
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
```

### Server-Side Aggregation Query
```typescript
// Source: Prisma aggregation documentation
import { prisma } from '@/lib/prisma';
import { eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

export async function getDailyStats(
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const stats = await prisma.decision.groupBy({
    by: ['date'], // Requires timestamp field
    where: {
      userId,
      createdAt: {
        gte: startOfDay(startDate),
        lte: endOfDay(endDate),
      },
    },
    _count: true,
    _avg: { evLoss: true },
    _sum: { isCorrect: true },
    orderBy: { date: 'asc' },
  });

  return stats.map((day) => ({
    date: day.date.toISOString().split('T')[0],
    hands: day._count,
    accuracy: ((day._sum.isCorrect ?? 0) / day._count) * 100,
    avgEVLoss: day._avg.evLoss ?? 0,
  }));
}
```

### Custom Tailwind Heatmap Grid
```typescript
// Source: Tailwind grid + clsx pattern
import clsx from 'clsx';

interface HeatmapCell {
  label: string;
  value: number;
  confidence: boolean;
}

const PositionHeatmap = ({ cells, metric = 'accuracy' }: { cells: HeatmapCell[]; metric: string }) => {
  const getIntensityClass = (value: number): string => {
    // Normalize value to 0-100 range (adjust based on your metric)
    const normalized = Math.min(Math.max(value, 0), 100);
    if (normalized < 33) return 'bg-red-900 text-slate-100';
    if (normalized < 66) return 'bg-yellow-700 text-slate-900';
    return 'bg-green-800 text-slate-100';
  };

  return (
    <div className="grid grid-cols-7 gap-2 p-4 bg-slate-800 rounded-lg">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className={clsx(
            'p-3 rounded text-center text-sm font-mono transition-opacity',
            getIntensityClass(cell.value),
            !cell.confidence && 'opacity-50',
          )}
          title={`${cell.label}: ${cell.value.toFixed(1)}${!cell.confidence ? ' (low confidence)' : ''}`}
        >
          <div className="font-bold">{cell.value.toFixed(0)}</div>
          <div className="text-xs opacity-75">{cell.label}</div>
          {!cell.confidence && <div className="text-xs">*</div>}
        </div>
      ))}
    </div>
  );
};
```

### shadcn/ui Date Range Picker Integration
```typescript
// Source: shadcn/ui documentation
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';

export function DateRangeFilter() {
  const searchParams = useSearchParams();
  const [startDate, setStartDate] = useState<Date>(
    searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );
  const [endDate, setEndDate] = useState<Date>(new Date());

  const handleApply = () => {
    const params = new URLSearchParams(searchParams);
    params.set('startDate', startDate.toISOString());
    params.set('endDate', endDate.toISOString());
    window.history.replaceState({}, '', `?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <Calendar mode="range" selected={{ from: startDate, to: endDate }} onSelect={(range) => {
            if (range?.from) setStartDate(range.from);
            if (range?.to) setEndDate(range.to);
          }} />
          <Button onClick={handleApply} className="w-full mt-2">Apply</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Heavyweight charting libraries (D3, Apache ECharts) for all visualizations | Specialized libraries for specific needs: Recharts for time-series, custom Tailwind grids for matrices | 2023-2024 | Faster builds, smaller bundle, easier to customize |
| SVG-only rendering for all chart sizes | Adaptive rendering: SVG for <1000 points, Canvas for 10,000+ | 2022-2024 | Better performance on large datasets without sacrificing interactivity |
| Client-side data aggregation (fetch all, compute in React) | Server-side aggregation (Prisma groupBy, database indexes) | 2023-2024 | Major performance boost for analytics dashboards; moved filtering from React to SQL |
| Global Redux state for dashboard filters | URL search params with useSearchParams() | 2023-2024 | Better UX (bookmarkable, shareable filters), simpler state management |
| Tremor or headless UI component collections | Composable libraries (shadcn/ui) + Tailwind utilities | 2024-2025 | Full design control, less "theme debt", easier to match brand aesthetics |

**Deprecated/outdated:**
- **Redux for dashboard state:** Replaced by URL params + React hooks. URL params are simpler, enable sharing/bookmarking.
- **Chart.js (via react-chartjs-2):** Canvas-based, lacks customization for interactive tooltips; Recharts offers better DX for React projects.
- **react-dates (legacy date picker):** Replaced by shadcn/ui Date Picker, which uses modern React 19 patterns and Tailwind CSS.

## Open Questions

Things that couldn't be fully resolved:

1. **Low-confidence threshold value (< 20 hands vs < 10 hands?)**
   - What we know: Decision made to "show all data regardless of sample size, visually indicate low confidence below threshold"
   - What's unclear: Exact threshold (10, 20, or 50 hands?) depends on poker domain expertise
   - Recommendation: Defer to domain expert (poker coach/player on the team). Start with 20 hands as a reasonable default; make it configurable in admin panel if time permits.

2. **Heatmap drill-down interaction model (modal vs inline expansion?)**
   - What we know: "Heatmap drill-down: clicking a position on the table layout opens the matrix filtered to that position's matchups"
   - What's unclear: Should drill-down open a modal, replace the current view, or show in a split panel?
   - Recommendation: Use a modal for drill-down (keeps page context, easy to dismiss). Implement in component as `<HeatmapDrilldownModal isOpen={...} position={...} />`.

3. **Pagination strategy (cursor-based vs offset?)**
   - What we know: Session history requires pagination (not infinite scroll)
   - What's unclear: Cursor-based pagination (harder, better for large offsets) vs offset-based (simpler, fine for <10k records)
   - Recommendation: Use offset-based for MVP (`?page=1&pageSize=20`). If session count exceeds 50k, migrate to cursor-based.

## Sources

### Primary (HIGH confidence)
- Recharts GitHub & Documentation - Time-series chart API, tooltip customization, responsive container
- Prisma Documentation (https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing) - Server-side aggregation with `groupBy()` and `aggregate()`
- shadcn/ui (https://ui.shadcn.com/docs/components/radix/date-picker) - Date picker component API, Tailwind integration
- React DayPicker (https://react-day-picker.js.org) - Calendar component, accessibility features

### Secondary (MEDIUM confidence)
- [Syncfusion Blogs - Top 5 React Chart Libraries 2026](https://www.syncfusion.com/blogs/post/top-5-react-chart-libraries) - Market trends, library comparisons
- [LogRocket - Best React Chart Libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/) - Feature comparison, use case guidance
- [MUI X Heatmap Documentation](https://mui.com/x/react-charts/heatmap/) - Heatmap customization with color gradients
- [Prisma Performance Guide](https://www.prisma.io/dataguide/managing-databases/how-to-spot-bottlenecks-in-performance) - Query optimization, aggregation patterns

### Tertiary (LOW confidence)
- Various blog posts on React dashboard patterns (verified by multiple sources)
- GitHub issues on Recharts tooltip styling (community discussions, not official docs)

## Metadata

**Confidence breakdown:**
- **Standard stack (Recharts, shadcn/ui, Prisma):** HIGH - Verified with official docs and 2026 ecosystem surveys
- **Architecture patterns (aggregation, filter state):** HIGH - Confirmed by Prisma docs and modern dashboard best practices
- **Pitfalls (rendering large datasets, color theming):** MEDIUM - Based on community reports and best practices, not exhaustively tested in this project
- **Heatmap implementation:** MEDIUM - Multiple valid approaches exist (MUI X, custom grid); recommendation based on simplicity + design control, not performance benchmarks

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days for stable libraries; Recharts and shadcn/ui rarely introduce breaking changes)

**Key assumptions:**
- Project continues with Tailwind CSS 4.1+ (no switch to other CSS frameworks)
- Prisma 7.x remains primary ORM (no migration to alternative ORMs)
- Dark theme poker aesthetic is non-negotiable (influences all color/styling decisions)
- Sessions dataset is <100k records (if exceeds, migrate to cursor-based pagination and Canvas charting)
