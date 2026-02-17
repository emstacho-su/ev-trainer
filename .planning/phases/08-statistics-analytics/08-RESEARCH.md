# Phase 8: Statistics & Analytics - Research

**Researched:** 2026-02-16
**Domain:** React dashboard with time-series charts, heatmaps, date range filters, and server-side aggregation
**Confidence:** HIGH (charting and architecture), MEDIUM (specific pitfalls and edge cases)

## Summary

Phase 8 requires building a high-performance analytics dashboard with time-series line charts, position heatmaps, and session history tables. The architecture prioritizes server-side data aggregation using Prisma's groupBy and aggregate functions, with responsive UI that adapts data granularity based on the selected time range. Modern React charting libraries (Recharts, Victory, Tremor) have converged on efficient SVG rendering with dark theme support via CSS variables. The critical decisions are: (1) charting library (Recharts is ecosystem standard), (2) heatmap as custom Tailwind grid (full design control, simpler than charting libraries), (3) date range filters stored in URL params for bookmarking, and (4) offset-based pagination for MVP-level session history.

The project's Prisma schema already has DailyStat (for aggregated daily metrics) and SpotStat (for spot-level performance) models that can power most dashboard features. Server-side filtering via the `where` clause is non-negotiable—never fetch raw records and aggregate in React. Dark theme is implemented via CSS variables matching the existing poker aesthetic.

**Primary recommendation:** Use Recharts 2.12+ for time-series charts with dark theme via CSS variables, build heatmap as a custom Tailwind grid component (grid-cols-7 with bg-color classes), implement date range filters using shadcn/ui Calendar (with custom date range picker) and store filters in `useSearchParams()`, use Prisma's `groupBy()` with indexed date fields for server-side aggregation, and pagination via offset-based approach for sessions table.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 2.12+ | Time-series line charts, area charts, responsive tooltips | SVG-based, React component API, dark theme support via CSS variables, 24.8K GitHub stars, ecosystem standard for React dashboards, better than Canvas for <10,000 data points |
| Prisma Client | 7.3.0+ | Server-side aggregation and statistics queries | Already in project, supports `groupBy()`, `aggregate()`, `_sum`, `_avg`, `_count` operations. Essential for performance—aggregates at database layer before sending to React |
| shadcn/ui Calendar | 0.3.4+ | Date range picker component | Tailwind CSS native, Radix UI based, form-ready, mobile responsive, integrates seamlessly with next-themes for dark mode, accessible keyboard navigation |
| React DayPicker | 8.9+ | Calendar UI foundation (via shadcn/ui) | Lightweight, no jQuery, accessible, handles edge cases (DST, leap years), forms basis of shadcn/ui Calendar |
| Next.js | 16.1.6 | App Router with useSearchParams for filter state | Already in project, native URL params support, simplifies bookmarkable filter state |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 3.0+ | Date manipulation and formatting | Required by shadcn/ui Calendar, used for formatting dates in charts/tables, timezone handling, date arithmetic (e.g., calculating ranges) |
| Tailwind CSS | 4.1.18 | Grid-based heatmap styling and dark theme | Custom heatmap cells via grid-cols-7 and bg-color classes, dark mode via prefers-color-scheme or manual toggle |
| clsx | 2.1.1+ | Conditional CSS class merging for dynamic heatmap colors | Dynamically assign color classes (bg-red-900, bg-yellow-700, bg-green-800) based on metric values |
| ResponsiveContainer (Recharts) | 2.12+ | Responsive chart sizing | Built into Recharts, adapts to container width/height, critical for mobile views |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Victory | Victory is more modular/extensible, but Recharts has larger community, more tutorials, better dark theme examples. Victory shines for highly custom visualizations; Recharts is faster to MVP. |
| Recharts | Tremor | Tremor is opinionated dashboard library built on Recharts—very fast for "looks good out of box" but limits customization (e.g., can't easily match Linear/Vercel aesthetic). Tremor is higher-level; Recharts gives design control. |
| Recharts | Chart.js via react-chartjs-2 | Chart.js uses Canvas rendering (overkill for <1000 points), lacks React component API, harder to customize tooltips. Recharts is more React-friendly. |
| Recharts | ECharts | ECharts is powerful but requires D3 expertise, heavier bundle, steep learning curve. Recharts is simpler and sufficient for analytics dashboards. |
| shadcn/ui Calendar | react-date-range | react-date-range requires separate styling, less Tailwind integration. shadcn/ui gives composable, unstyled components you can theme with Tailwind utilities. |
| shadcn/ui Calendar | Tremor DateRangePicker | Tremor couples chart UI with date picker, reducing flexibility. shadcn/ui is composable (use elsewhere), more control. |
| Custom Tailwind heatmap | MUI X Heatmap | MUI X adds Material Design layer (conflicts with poker aesthetic), brings theme debt. Custom grid gives full design control, is simpler to maintain. |
| Custom Tailwind heatmap | Syncfusion/AG Charts | Enterprise libraries with licensing, overkill for a 6x6 or custom matrix. Custom approach is lightweight and matches Tailwind-first workflow. |

**Installation:**

```bash
npm install recharts date-fns
# shadcn/ui, Tailwind, Prisma, and Next.js already in project
# If shadcn/ui Calendar not yet added:
npx shadcn-ui@latest add calendar
npx shadcn-ui@latest add popover
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/stats/                              # /stats route
│   ├── page.tsx                            # Dashboard layout: hero + sticky filter + tabs
│   ├── layout.tsx                          # Auth guard + metadata
│   ├── components/
│   │   ├── MetricCards.tsx                 # 4 hero metric cards with delta arrows
│   │   ├── PerformanceChart.tsx            # Line chart with metric dropdown (EV loss, accuracy, etc)
│   │   ├── FilterBar.tsx                   # Sticky position: date range + position/scenario filters
│   │   ├── PositionHeatmap.tsx             # 6-max table layout overview
│   │   ├── HeatmapMatrix.tsx               # Position-vs-position drill-down matrix
│   │   ├── WeaknessBreakdown.tsx           # Scenario-type or action-error view
│   │   ├── SessionHistory.tsx              # Recent sessions (24h) + older sessions table
│   │   ├── SessionDetailModal.tsx          # Expanded session with "Biggest mistakes" section
│   │   ├── HandReplayCard.tsx              # Simplified review card for hand-by-hand replay
│   │   └── LoadingSkeletons.tsx            # Skeleton cards for metrics, chart, history
│   └── api/
│       └── route.ts                        # Proxy to /api/stats endpoint if needed
├── lib/stats/                              # Business logic
│   ├── aggregation.ts                      # getDailyStats(), getSpotStats(), etc (Prisma queries)
│   ├── filters.ts                          # parseFilterParams(), buildWhereClause()
│   ├── types.ts                            # PerformanceMetric, SessionData, HeatmapCell interfaces
│   └── calculations.ts                     # Trend delta, low-confidence detection, color intensity mapping
└── server/routes/stats.routes.ts           # Express API endpoints for aggregation
```

### Pattern 1: Server-Side Data Aggregation with Adaptive Granularity

**What:** Aggregate statistics at the database layer using Prisma's `groupBy()` and `aggregate()`. Adjust granularity based on time range: per-session for 7d, daily for 30d+, weekly for 90d+. Never fetch raw records and compute in React.

**When to use:** Always. This is non-negotiable for performance.

**Example:**

```typescript
// Source: Prisma aggregation documentation + project schema
import { prisma } from '@/lib/prisma';

type AggregationGranularity = 'session' | 'day' | 'week';

function getAggregationGranularity(startDate: Date, endDate: Date): AggregationGranularity {
  const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 7) return 'session';   // One point per session
  if (days <= 30) return 'day';      // One point per day
  return 'week';                      // One point per week
}

// Daily aggregation query
export async function getDailyStats(
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const stats = await prisma.dailyStat.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  });

  return stats.map((day) => ({
    date: day.date.toISOString().split('T')[0],
    accuracy: day.totalDecisions > 0
      ? (day.correctDecisions / day.totalDecisions) * 100
      : 0,
    avgEVLoss: Number(day.avgEvLoss),
    hands: day.totalDecisions,
    sessions: day.sessionsCompleted,
  }));
}

// Per-session aggregation for 7d range
export async function getSessionStats(
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isComplete: true,
    },
    select: {
      id: true,
      createdAt: true,
      entries: {
        select: {
          result: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return sessions.map((session) => {
    const entries = session.entries.filter(e => e.result);
    const correct = entries.filter(e => e.result?.isCorrect).length;
    return {
      date: session.createdAt.toISOString().split('T')[0],
      accuracy: entries.length > 0 ? (correct / entries.length) * 100 : 0,
      hands: entries.length,
      sessionId: session.id,
    };
  });
}
```

### Pattern 2: Sticky Filter Bar with URL Search Params

**What:** Position filter controls at top of page; filters apply to all tabs simultaneously. Store filters in URL query params (not React state) so users can bookmark/share filtered views.

**When to use:** Standard pattern for dashboards needing synchronized filtering across multiple sections.

**Example:**

```typescript
// Source: Next.js useSearchParams pattern
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface StatsFilters {
  startDate?: string;       // ISO format: 2026-02-01
  endDate?: string;
  positions?: string;       // Comma-separated: BTN,CO,SB
  scenarios?: string;       // RFI,FaceOpen,3Bet
  metric?: string;          // accuracy, avgEVLoss, hands, etc
}

export function FilterBar() {
  const searchParams = useSearchParams();
  const [startDate, setStartDate] = useState<Date>(
    searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );
  const [endDate, setEndDate] = useState<Date>(new Date());

  const updateFilters = (updates: Partial<StatsFilters>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value.toString());
      } else {
        params.delete(key);
      }
    });
    window.history.replaceState({}, '', `?${params.toString()}`);
  };

  const handleDateRangeChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    updateFilters({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  };

  return (
    <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 px-6 py-4">
      {/* Preset buttons: 7d, 30d, 90d, All */}
      {/* Date picker: custom range */}
      {/* Position filter: checkboxes or dropdown */}
      {/* Scenario filter: checkboxes */}
    </div>
  );
}
```

### Pattern 3: Custom Tailwind Heatmap Grid with Dynamic Colors

**What:** Build heatmap as a simple HTML grid with Tailwind bg-color classes applied dynamically based on metric values. Avoids SVG/charting library overhead, gives full design control, matches poker aesthetic.

**When to use:** Fixed-size matrices (6x6 for 6-max, or position-vs-position matchups) where design control is critical.

**Example:**

```typescript
// Source: Tailwind grid + clsx pattern from project
import clsx from 'clsx';

interface HeatmapCell {
  label: string;                 // e.g., 'BTN vs CO'
  value: number;                 // 0-100 for accuracy, or EV loss value
  confidence: boolean;           // true if sample >= threshold (e.g., 20 hands)
  countHands?: number;           // display tooltip: "92% (450 hands)"
}

type HeatmapMetric = 'accuracy' | 'avgEVLoss';

const getIntensityColor = (value: number, metric: HeatmapMetric): string => {
  // Normalize based on metric type
  let normalized = value;
  if (metric === 'accuracy') {
    // 0% = weak (red), 50% = average (yellow), 100% = strong (green)
    normalized = Math.min(Math.max(value, 0), 100);
  } else if (metric === 'avgEVLoss') {
    // For EV loss, inverted: lower is better
    // Assume range 0-3 BB per hand (adjust based on domain)
    normalized = 100 - (Math.min(value, 3) / 3) * 100;
  }

  if (normalized < 33) return 'bg-red-900 text-slate-100';     // Weak
  if (normalized < 66) return 'bg-yellow-700 text-slate-900';  // Average
  return 'bg-green-800 text-slate-100';                         // Strong
};

interface PositionHeatmapProps {
  cells: HeatmapCell[];
  metric: HeatmapMetric;
  onCellClick?: (cell: HeatmapCell) => void;
}

export function PositionHeatmap({ cells, metric, onCellClick }: PositionHeatmapProps) {
  return (
    <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={clsx(
              'p-3 rounded text-center text-sm font-mono cursor-pointer',
              'transition-all hover:scale-105 hover:shadow-lg',
              getIntensityColor(cell.value, metric),
              !cell.confidence && 'opacity-50',
            )}
            onClick={() => onCellClick?.(cell)}
            title={`${cell.label}: ${cell.value.toFixed(1)}${!cell.confidence ? ' (low confidence)' : ''}`}
          >
            <div className="font-bold">{cell.value.toFixed(0)}</div>
            <div className="text-xs opacity-75 truncate">{cell.label}</div>
            {!cell.confidence && <div className="text-xs">*</div>}
          </div>
        ))}
      </div>
      {cells.some(c => !c.confidence) && (
        <p className="text-xs text-slate-400 mt-4">* Less than 20 hands (low confidence)</p>
      )}
    </div>
  );
}
```

### Pattern 4: Recharts Line Chart with Dark Theme CSS Variables

**What:** Use Recharts `<LineChart>` with `<ResponsiveContainer>` for responsive sizing. Apply dark theme colors via CSS variables, not hardcoded values.

**When to use:** Time-series visualization for metrics with rich tooltips.

**Example:**

```typescript
// Source: Recharts documentation + dark theme pattern
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface PerformanceChartProps {
  data: Array<{
    date: string;
    avgEVLoss: number;
    accuracy: number;
    hands: number;
    sessions: number;
  }>;
  metric: 'avgEVLoss' | 'accuracy' | 'hands';
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  const metric = payload[0].dataKey;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-3 text-xs text-slate-200">
      <p className="font-mono font-bold">{data.date}</p>
      <p className="text-slate-100">
        {metric === 'accuracy' ? 'Accuracy' : metric === 'avgEVLoss' ? 'Avg EV Loss' : 'Hands'}
        {': '}
        {typeof data[metric] === 'number' ? data[metric].toFixed(2) : data[metric]}
      </p>
      <p className="text-slate-400">Hands: {data.hands}</p>
      <p className="text-slate-400">Sessions: {data.sessions}</p>
    </div>
  );
};

export function PerformanceChart({
  data,
  metric = 'avgEVLoss',
}: PerformanceChartProps) {
  const lineColor = metric === 'accuracy' ? '#3b82f6' : '#10b981'; // blue or green

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-grid, #334155)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          stroke="var(--color-axis, #64748b)"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="var(--color-axis, #64748b)"
          style={{ fontSize: '12px' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey={metric}
          stroke={lineColor}
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 5: Session History Pagination with Offset

**What:** Display sessions in a table with offset-based pagination (`?page=1&pageSize=20`). For MVP, offset is simpler than cursor-based. Include sortable columns and filterable rows.

**When to use:** Session history list where users can browse, sort, and filter by date/accuracy.

**Example:**

```typescript
// Source: Pagination architecture pattern
// API endpoint structure
// GET /api/stats/sessions?userId=X&page=1&pageSize=20&sortBy=date&order=desc

// Response interface
interface SessionsResponse {
  sessions: Array<{
    id: string;
    createdAt: Date;
    handsCount: number;
    accuracy: number;
    avgEVLoss: number;
    scenarioBreakdown: { [key: string]: number };
  }>;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// React component with pagination
export function SessionHistory() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [sortBy, setSortBy] = useState<'date' | 'accuracy' | 'evloss'>('date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: 'date' | 'accuracy' | 'evloss') => {
    if (sortBy === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setOrder('desc');
    }
    setPage(1); // Reset to first page on sort change
  };

  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800">
            <th
              onClick={() => handleSort('date')}
              className="text-left py-2 px-4 cursor-pointer hover:bg-slate-800"
            >
              Date {sortBy === 'date' && (order === 'asc' ? '↑' : '↓')}
            </th>
            <th
              onClick={() => handleSort('accuracy')}
              className="text-left py-2 px-4 cursor-pointer hover:bg-slate-800"
            >
              Accuracy {sortBy === 'accuracy' && (order === 'asc' ? '↑' : '↓')}
            </th>
            <th
              onClick={() => handleSort('evloss')}
              className="text-left py-2 px-4 cursor-pointer hover:bg-slate-800"
            >
              Avg EV Loss {sortBy === 'evloss' && (order === 'asc' ? '↑' : '↓')}
            </th>
            <th className="text-left py-2 px-4">Hands</th>
          </tr>
        </thead>
        <tbody>{/* Session rows */}</tbody>
      </table>

      {/* Pagination controls */}
      <div className="flex gap-2 mt-4 justify-center">
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page}</span>
        <button onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
```

### Pattern 6: Loading Skeletons for Metric Cards and Charts

**What:** Show placeholder cards while data loads. Use Tailwind bg-slate-800 with shimmer animation to mimic content dimensions.

**When to use:** Any async data fetch to reduce perceived loading time.

**Example:**

```typescript
// Source: React skeleton loading pattern
export function MetricCardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-slate-700 rounded w-24 mb-2"></div>
      <div className="h-8 bg-slate-700 rounded w-32 mb-2"></div>
      <div className="h-3 bg-slate-700 rounded w-20"></div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-slate-800 rounded-lg p-6 animate-pulse">
      <div className="h-96 bg-slate-700 rounded"></div>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Fetching all historical data then filtering in React:** Kills performance. Always filter in database `where` clause.
- **Building custom line chart from scratch:** Use Recharts. D3 setup wastes time; Recharts covers 95% of use cases.
- **Rendering heatmap as SVG via Recharts:** Overkill complexity. HTML grid is simpler, faster, more customizable.
- **Client-side date range picker without URL params:** Users can't bookmark/share views. Always store filters in `?startDate=X&endDate=Y`.
- **Hardcoding chart colors (#ffffff, #000000):** Breaks dark theme. Use CSS variables: `var(--chart-bg)` or Tailwind utilities.
- **No loading states during filter changes:** Users think app is broken. Show skeleton cards or disable filters during request.
- **Not indexing date fields in Prisma queries:** Grouping by date without index is slow. Ensure `@@index([userId, date])` on DailyStat/SpotStat.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range selection UI | Custom calendar picker with keyboard nav | shadcn/ui Date Picker (React DayPicker based) | Handles accessibility, localization, leap years, DST. Building from scratch = 200+ LOC with edge cases. |
| Time-series charts | Canvas/SVG from scratch or D3 | Recharts | Recharts handles responsive sizing, touch interactions, tooltips, animations. Custom = 500+ LOC of math. |
| Heatmap color gradients | Manual RGB/HSL interpolation | Tailwind color palette + clsx | Tailwind colors are tested, accessible, theme-consistent. Manual math introduces bugs. |
| Dashboard filter state | Redux, Context + useReducer | URL search params via useSearchParams() | URL params survive reload, enable bookmarking, are simpler than state machines. Next.js has native support. |
| Data aggregation | JavaScript reduce() loops on 10k+ records | Prisma groupBy() and aggregate() | Prisma generates optimized SQL. JavaScript loading 10k records into memory causes browser hangs. Database is 100x faster. |
| Metric trend delta | Manual percentage math | Simple formula: `(current - previous) / previous * 100` | One-liner. Just ensure you're comparing correct periods (7d delta = this 7d vs previous 7d). |
| Pagination from scratch | Implementing offset/limit logic | Next.js API route with ?page and ?pageSize | Built-in support. Minimal boilerplate. Swap to cursor-based later if needed. |

**Key insight:** This phase is "let the database do the heavy lifting." Prisma's aggregation functions are designed for exactly this workload. Any temptation to move statistics computation into React is a performance antipattern.

## Common Pitfalls

### Pitfall 1: Rendering 10,000+ Data Points on the Chart

**What goes wrong:** User selects "All Time" for a 5-year-old account and the chart attempts to render 10,000+ points. Browser freezes, chart is unusable, DOM has thousands of SVG nodes.

**Why it happens:** Fetching raw SessionEntry or Decision records without aggregation. Then mapping directly to chart points without grouping.

**How to avoid:** Always aggregate server-side. Implement adaptive granularity: 7d shows per-session (20-50 points), 30d shows daily (30 points), 90d shows weekly (12 points). If user selects "All Time", return weekly or monthly aggregates. Recharts renders <100 points smoothly; avoid >500.

**Warning signs:** Browser DevTools shows 5,000+ SVG `<circle>` or `<path>` nodes; page becomes unresponsive when changing date range; Recharts console warns about performance.

### Pitfall 2: Date Range Filters Not Persisted in URL

**What goes wrong:** User filters to "last 30 days", leaves the page, comes back—filters are lost. Or tries to share the link with a friend and they see different data.

**Why it happens:** Filters stored only in React `useState()`, not in URL query params.

**How to avoid:** Use `useSearchParams()` from Next.js and update URL whenever filters change. Example URL: `/stats?startDate=2026-02-01&endDate=2026-02-16&positions=BTN,CO`. Bookmark the URL; it should load the same filtered view.

**Warning signs:** No query string in address bar; filters reset on page reload; can't share a filtered view with a colleague.

### Pitfall 3: Hardcoded Colors Breaking Dark Theme

**What goes wrong:** Recharts Tooltip has `backgroundColor: '#ffffff'`, text is `color: '#000'`. On dark theme, text is invisible. Chart labels are unreadable.

**Why it happens:** Colors copied from light theme design without considering dark mode toggle.

**How to avoid:** Use CSS variables or Tailwind utilities for all colors. Define in `globals.css`:

```css
:root {
  --chart-bg: hsl(15, 23%, 13%);    /* dark: #1a0f0f */
  --chart-text: hsl(210, 40%, 96%); /* light text */
  --chart-grid: hsl(217, 32%, 17%); /* subtle grid */
}

@media (prefers-color-scheme: light) {
  :root {
    --chart-bg: hsl(0, 0%, 100%);
    --chart-text: hsl(0, 0%, 0%);
    --chart-grid: hsl(0, 0%, 90%);
  }
}
```

Then reference: `contentStyle={{ backgroundColor: 'var(--chart-bg)', color: 'var(--chart-text)' }}`.

**Warning signs:** Text disappears when dark mode is toggled; designer reports "stats page looks broken at night"; contrast ratio is <4.5:1.

### Pitfall 4: Low-Confidence Data Not Visually Distinct

**What goes wrong:** User sees "92% accuracy" in a position with only 3 hands played. They drill down to train, then after 20 hands they're at 50%. Frustration: "The stats don't match reality."

**Why it happens:** Heatmap cells colored identically regardless of sample size. No visual indicator of confidence.

**How to avoid:** Below a threshold (e.g., <20 hands), make cells visually distinct: reduce opacity to 0.5, add asterisk overlay, or use striped pattern. Document in UI: "* Less than 20 hands (low confidence)".

**Warning signs:** Users report stats are inaccurate; you see "weak" positions suddenly become "strong" after a few lucky hands; sample size is not visible.

### Pitfall 5: No Debouncing on Filter Changes

**What goes wrong:** User clicks the date range button, nothing happens for 2 seconds (API is slow). User thinks app is broken, clicks again. Two requests fire. Or user types in a position filter box—request fires on every keystroke.

**Why it happens:** No debouncing on filter state changes. No loading indicator. Filter button not disabled during request.

**How to avoid:** Debounce filter changes: `const debouncedFilters = useDebounce(filters, 300)`. Disable filter buttons/inputs during loading: `<button disabled={isLoading}>Apply</button>`. Show a loading spinner or skeleton card to indicate pending request.

**Warning signs:** Network tab shows duplicate/rapid API requests; user complains "the app feels slow"; filter buttons are clickable while already loading.

### Pitfall 6: Missing Database Indexes on Aggregation Fields

**What goes wrong:** Prisma query `groupBy([date])` where `date` is not indexed. Query takes 10+ seconds for even 1 year of data.

**Why it happens:** Schema doesn't include `@@index([userId, date])` on DailyStat or related tables.

**How to avoid:** Ensure Prisma schema has indexes on all fields used in `groupBy()` or `where` clauses:

```prisma
model DailyStat {
  id            String   @id @default(cuid())
  userId        String
  date          DateTime @db.Date
  totalDecisions Int

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId, date])      // Critical for groupBy performance
  @@index([userId, createdAt]) // If filtering by time range
}
```

Run `prisma migrate dev` to apply indexes to database.

**Warning signs:** Aggregation queries take >1 second; database logs show full table scans; query planner shows "Seq Scan" instead of "Index Scan".

### Pitfall 7: Tooltip Overflowing on Mobile Screens

**What goes wrong:** Recharts tooltip on mobile shows "Date: 2026-02-16, Hands: 450, Accuracy: 72.3%, Avg EV Loss: 1.2 BB" but the text runs off-screen or gets clipped.

**Why it happens:** Fixed-width tooltip; no responsive sizing; no max-width constraint.

**How to avoid:** Use Recharts `Tooltip` with `wrapperStyle={{ maxWidth: '90vw' }}`. Format content concisely (abbreviate labels). Test on actual mobile devices or use DevTools mobile emulation.

**Warning signs:** Tooltip text is cut off on phone/tablet; text wraps awkwardly; user can't read tooltip values.

### Pitfall 8: Session History Table Not Sortable/Filterable

**What goes wrong:** User has 300 sessions, wants to find sessions from January with accuracy <50%. Can't sort by accuracy. Must scroll through 300 rows manually.

**Why it happens:** Session list is static or only supports date filtering. No sortable column headers.

**How to avoid:** Make table headers clickable to toggle sort: `onClick={() => handleSort('accuracy')}`. Support filtering: date range, scenario type, accuracy threshold. Store sort/filter in URL: `?sortBy=accuracy&order=desc&minAccuracy=50`.

**Warning signs:** Session history takes long to load; pagination is missing; users complain they can't find sessions.

## Code Examples

Verified patterns from official sources:

### Recharts Line Chart with Custom Dark Tooltip

```typescript
// Source: Recharts official docs + dark theme pattern
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import React from 'react';

interface ChartDataPoint {
  date: string;
  avgEVLoss: number;
  accuracy: number;
  hands: number;
  sessions: number;
}

interface PerformanceChartProps {
  data: ChartDataPoint[];
  metric: keyof Pick<ChartDataPoint, 'avgEVLoss' | 'accuracy' | 'hands'>;
  title?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload as ChartDataPoint;
  const dataKey = payload[0].dataKey;

  const metricLabel: Record<string, string> = {
    avgEVLoss: 'Avg EV Loss (BB)',
    accuracy: 'Accuracy (%)',
    hands: 'Hands Played',
  };

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md p-3 shadow-lg">
      <p className="font-mono text-xs font-semibold text-slate-200">{data.date}</p>
      <p className="text-xs text-blue-400 mt-1">
        {metricLabel[dataKey]}: {typeof data[dataKey as keyof ChartDataPoint] === 'number'
          ? (data[dataKey as keyof ChartDataPoint] as number).toFixed(2)
          : 'N/A'}
      </p>
      <p className="text-xs text-slate-400 mt-1">Hands: {data.hands}</p>
      <p className="text-xs text-slate-400">Sessions: {data.sessions}</p>
    </div>
  );
};

export function PerformanceChart({
  data,
  metric = 'avgEVLoss',
  title = 'Performance Trend',
}: PerformanceChartProps) {
  const getStrokeColor = (): string => {
    if (metric === 'accuracy') return '#3b82f6';     // blue
    if (metric === 'hands') return '#8b5cf6';        // purple
    return '#10b981';                                 // green (EV loss)
  };

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            stroke="#64748b"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#94a3b8' }}
          />
          <YAxis
            stroke="#64748b"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#94a3b8' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#475569' }} />
          <Line
            type="monotone"
            dataKey={metric}
            stroke={getStrokeColor()}
            dot={false}
            strokeWidth={2.5}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Prisma Server-Side Daily Aggregation Query

```typescript
// Source: Prisma aggregation documentation
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export async function getDailyStatsForChart(
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const dailyStats = await prisma.dailyStat.findMany({
    where: {
      userId,
      date: {
        gte: startOfDay(startDate),
        lte: endOfDay(endDate),
      },
    },
    select: {
      date: true,
      totalDecisions: true,
      correctDecisions: true,
      avgEvLoss: true,
      sessionsCompleted: true,
    },
    orderBy: { date: 'asc' },
  });

  return dailyStats.map((day) => ({
    date: day.date.toISOString().split('T')[0],
    hands: day.totalDecisions,
    accuracy: day.totalDecisions > 0
      ? (day.correctDecisions / day.totalDecisions) * 100
      : 0,
    avgEVLoss: Number(day.avgEvLoss),
    sessions: day.sessionsCompleted,
  }));
}

export async function getSpotStatsForHeatmap(userId: string) {
  const spotStats = await prisma.spotStat.findMany({
    where: { userId },
    select: {
      spotId: true,
      heroPosition: true,
      villainPosition: true,
      totalDecisions: true,
      correctDecisions: true,
      avgEvLoss: true,
    },
  });

  // Transform into heatmap cells
  return spotStats.map((spot) => ({
    label: `${spot.heroPosition}${spot.villainPosition ? ` vs ${spot.villainPosition}` : ''}`,
    value: spot.totalDecisions > 0
      ? (spot.correctDecisions / spot.totalDecisions) * 100
      : 0,
    confidence: spot.totalDecisions >= 20,
    countHands: spot.totalDecisions,
    spotId: spot.spotId,
  }));
}
```

### Custom Tailwind Heatmap Grid Component

```typescript
// Source: Tailwind grid + clsx pattern
import clsx from 'clsx';

interface HeatmapCell {
  label: string;
  value: number;
  confidence: boolean;
  countHands?: number;
  spotId?: string;
}

interface HeatmapGridProps {
  cells: HeatmapCell[];
  metric: 'accuracy' | 'avgEVLoss';
  onCellClick?: (cell: HeatmapCell) => void;
  title?: string;
}

const getColorClass = (value: number, metric: 'accuracy' | 'avgEVLoss'): string => {
  let normalized = value;

  if (metric === 'accuracy') {
    normalized = Math.min(Math.max(value, 0), 100);
  } else if (metric === 'avgEVLoss') {
    // Lower EV loss is better; assume range 0-3 BB
    normalized = 100 - (Math.min(Math.max(value, 0), 3) / 3) * 100;
  }

  if (normalized < 33) return 'bg-red-900 text-slate-100';
  if (normalized < 66) return 'bg-yellow-700 text-slate-900';
  return 'bg-green-800 text-slate-100';
};

export function HeatmapGrid({
  cells,
  metric,
  onCellClick,
  title = 'Position Performance',
}: HeatmapGridProps) {
  const lowConfidenceCells = cells.filter((c) => !c.confidence).length;

  return (
    <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">{title}</h3>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell, idx) => (
          <button
            key={`${cell.label}-${idx}`}
            onClick={() => onCellClick?.(cell)}
            className={clsx(
              'p-2 rounded text-center transition-all hover:scale-105',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              getColorClass(cell.value, metric),
              !cell.confidence && 'opacity-50',
            )}
            title={`${cell.label}: ${cell.value.toFixed(1)}${
              cell.countHands ? ` (${cell.countHands} hands)` : ''
            }${!cell.confidence ? ' - low confidence' : ''}`}
          >
            <div className="text-xs font-bold leading-tight">{cell.value.toFixed(0)}</div>
            <div className="text-xs opacity-75 truncate">{cell.label}</div>
            {!cell.confidence && <div className="text-xs">*</div>}
          </button>
        ))}
      </div>
      {lowConfidenceCells > 0 && (
        <p className="text-xs text-slate-400 mt-4">
          * {lowConfidenceCells} position(s) with &lt;20 hands (low confidence)
        </p>
      )}
    </div>
  );
}
```

### shadcn/ui Date Range Picker with URL Params Integration

```typescript
// Source: shadcn/ui date picker + next/navigation
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays } from 'date-fns';

interface DateRangeFilterProps {
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
}

export function DateRangeFilter({ onDateRangeChange }: DateRangeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');

  const [startDate, setStartDate] = useState<Date>(
    startDateParam ? new Date(startDateParam) : subDays(new Date(), 30),
  );
  const [endDate, setEndDate] = useState<Date>(
    endDateParam ? new Date(endDateParam) : new Date(),
  );

  const presetRanges = [
    { label: '7 Days', days: 7 },
    { label: '30 Days', days: 30 },
    { label: '90 Days', days: 90 },
  ];

  const handlePresetRange = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setStartDate(start);
    setEndDate(end);
    updateURL(start, end);
  };

  const updateURL = (start: Date, end: Date) => {
    const params = new URLSearchParams(searchParams);
    params.set('startDate', start.toISOString());
    params.set('endDate', end.toISOString());
    router.replace(`?${params.toString()}`);
    onDateRangeChange?.(start, end);
  };

  const handleApply = () => {
    updateURL(startDate, endDate);
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {presetRanges.map((preset) => (
        <Button
          key={preset.days}
          variant={startDate >= subDays(new Date(), preset.days) ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetRange(preset.days)}
        >
          {preset.label}
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-slate-900 border-slate-700" align="start">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Start Date
              </label>
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                disabled={(date) => date > endDate}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                End Date
              </label>
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
                disabled={(date) => date < startDate}
              />
            </div>
            <Button onClick={handleApply} className="w-full">
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D3 or Apache ECharts for all visualizations | Specialized libraries: Recharts for time-series, custom HTML grids for heatmaps | 2023-2024 | Faster builds, smaller bundle, easier to customize without learning D3 |
| SVG rendering for all chart sizes | Adaptive: SVG for <1000 points, consider Canvas for 10,000+ | 2022-2024 | Better performance on large datasets; Recharts v2.12+ optimized SVG rendering |
| Client-side aggregation (fetch raw records, compute in React) | Server-side aggregation via Prisma groupBy and aggregate | 2023-2024 | 100x performance boost; database is designed for this. React can't handle 10k+ records efficiently. |
| Redux for dashboard state | URL search params + React hooks (useSearchParams, useState) | 2023-2024 | Simpler, more shareable, bookmarkable. Redux is overkill for ephemeral filter state. |
| Chart.js via react-chartjs-2 | Recharts for React or Tremor for pre-styled dashboards | 2023-2024 | Canvas-based Chart.js is less React-idiomatic; Recharts components are more declarative. |
| Tremor for all dashboard needs | Recharts + custom components for fine-grained control | 2024-2025 | Tremor is great for "looks good out of box" but limits customization. Recharts lets you match Linear/Vercel aesthetic. |

**Deprecated/outdated:**

- **Redux for dashboard filters:** Replaced by URL params via `useSearchParams()`. URL state is simpler and enables sharing/bookmarking.
- **Chart.js (canvas-based):** Still viable for large datasets, but Recharts is more React-friendly for typical analytics dashboards.
- **react-dates (legacy date picker):** Replaced by shadcn/ui Date Picker based on React DayPicker. Modern, Tailwind-first, React 19 compatible.
- **GraphQL-only for filtering:** REST APIs with query params are simpler for dashboards. GraphQL adds complexity unless you already use it.

## Open Questions

Things that couldn't be fully resolved:

1. **Low-confidence threshold value (10 hands vs 20 hands vs 50 hands?)**
   - What we know: Decision made to "show all data regardless of sample size, visually indicate low confidence below threshold"
   - What's unclear: Exact threshold depends on poker domain expertise. 20 hands is reasonable default, but poker coaches might recommend 50+ for positional decisions.
   - Recommendation: Start with 20 hands as threshold. Make it configurable in admin settings or via environment variable. Domain experts can tune later. Could add tooltip explaining "low confidence = small sample size."

2. **Heatmap drill-down UX (modal vs inline vs split panel?)**
   - What we know: "Clicking a position opens matrix filtered to that position's matchups"
   - What's unclear: Should drill-down open a modal, replace the heatmap, or show in a side panel?
   - Recommendation: Use modal overlay (keeps context, easy to dismiss with ESC). Implement as `<HeatmapDrilldownModal isOpen={isOpen} position={selectedPosition} onClose={() => setIsOpen(false)} />`.

3. **Pagination strategy after MVP (when sessions exceed 1,000?)**
   - What we know: Session history requires pagination, not infinite scroll
   - What's unclear: Offset-based (simple, fine for <10k records) vs cursor-based (harder, scales to millions)?
   - Recommendation: Start with offset-based (`?page=1&pageSize=20`) for MVP simplicity. If session count exceeds 10,000, migrate to cursor-based with keyset pagination. Log when decision to migrate is needed.

4. **"Drill this" button flow—does it create a filtered training session automatically?**
   - What we know: "Weakness row has 'Drill this' button to start filtered training session"
   - What's unclear: Does clicking "Drill this" immediately start a session, or open a configuration modal?
   - Recommendation: Clicking "Drill this" pre-fills the training session filters (position, scenario) and shows a confirm/customize dialog. User can adjust hand count, difficulty, etc. Then starts session.

## Sources

### Primary (HIGH confidence)

- **Recharts** - [GitHub Releases](https://github.com/recharts/recharts/releases), [Performance Guide](https://recharts.org/en-US/guide) - Current version features, dark theme CSS variable support, tooltip customization
- **Prisma Documentation** - [Aggregation, grouping, and summarizing](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing) - Server-side groupBy() and aggregate() patterns
- **shadcn/ui** - [Calendar Component Docs](https://ui.shadcn.com/docs/components/radix/calendar), [Date Picker](https://ui.shadcn.com/docs/components/radix/date-picker) - Date picker API, Tailwind integration, accessibility
- **React DayPicker** - [Official Documentation](https://react-day-picker.js.org) - Calendar component accessibility and features
- **Tailwind CSS** - [Dark Mode](https://tailwindcss.com/docs/dark-mode), [Theme Variables](https://tailwindcss.com/docs/theme) - CSS variables for dark theme, color utilities
- **Next.js** - `useSearchParams()` hook documentation - URL parameter state management

### Secondary (MEDIUM confidence)

- [Syncfusion - Top 5 React Chart Libraries 2026](https://www.syncfusion.com/blogs/post/top-5-react-chart-libraries) - Market trends, library comparisons verified against multiple sources
- [LogRocket - Best React Chart Libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/) - Feature comparison, use case guidance for Recharts vs Tremor vs Victory
- [LogRocket - Why URL State Matters](https://blog.logrocket.com/url-state-usesearchparams/) - URL parameter state management best practices in React
- [Medium - Understanding Offset and Cursor Pagination](https://medium.com/@siddhantshelake/understanding-offset-and-cursor-pagination-8c5c53b1ad16) - Pagination strategy guidance verified by multiple sources
- [Tailwind CSS + Next Themes Dark Mode](https://medium.com/@kevstrosky/theme-colors-with-tailwind-css-v4-0-and-next-themes-dark-light-custom-mode-36dca1e20419) - Dark theme CSS variable patterns

### Tertiary (LOW confidence)

- Various GitHub discussions on Recharts tooltip styling - Community solutions, not official docs
- Blog posts on React dashboard skeleton patterns - Verified by multiple sources but not official

## Metadata

**Confidence breakdown:**

- **Standard stack (Recharts, Prisma, shadcn/ui):** HIGH - Verified with official docs and 2026 ecosystem reports
- **Architecture patterns (aggregation, URL filters, heatmap):** HIGH - Confirmed by Prisma docs and best practices from multiple authoritative sources
- **Pitfalls (rendering large datasets, dark theme, pagination):** MEDIUM - Based on community reports and best practices; not exhaustively tested in this specific project
- **Heatmap implementation:** MEDIUM - Multiple valid approaches exist (MUI X, Syncfusion, custom grid); recommendation based on simplicity and Tailwind-first philosophy
- **Loading skeleton patterns:** MEDIUM - React 19 Suspense patterns emerging; recommendations based on best practices from multiple sources

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days for stable libraries; Recharts, Prisma, and shadcn/ui rarely introduce breaking changes in minor versions)

**Key assumptions:**

- Project continues using Tailwind CSS 4.1+ (no migration to other CSS frameworks)
- Prisma 7.x remains primary ORM (no migration to TypeORM, Drizzle, etc.)
- Dark theme poker aesthetic is non-negotiable (influences all color/styling decisions)
- Sessions dataset <100k records at launch (if exceeds, consider Canvas charting and cursor-based pagination)
- Date fields on DailyStat and SpotStat have database indexes (critical for aggregation performance)
- Next.js 16+ with App Router is the frontend framework (useSearchParams() is built-in)

**Specific project configuration notes:**

- The Prisma schema already has DailyStat and SpotStat models pre-aggregated. Use these directly; don't aggregate from SessionEntry.
- Session and SessionEntry models store individual decisions; use only for session history detail views, not for chart aggregation.
- Recharts must be installed: `npm install recharts`
- shadcn/ui Calendar and Popover components must be added via `npx shadcn-ui@latest add calendar popover`
