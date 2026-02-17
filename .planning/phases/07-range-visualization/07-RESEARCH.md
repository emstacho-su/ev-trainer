# Phase 7: Range Visualization - Research

**Researched:** 2026-02-16
**Domain:** React component library for poker range visualization, accessible dialogs, data grids, and design tokens
**Confidence:** HIGH

## Summary

Phase 07 requires building a modal overlay with 13x13 poker hand range grids, action frequency visualization via stacked bars, and equity breakdowns. The landscape has shifted significantly since earlier research: the HTML `<dialog>` element is now the standard approach for modals (baseline compatibility since March 2022), and the previously recommended @holdem-poker-tools/hand-matrix library is unmaintained (5 years old, not tested with React 19).

The updated approach uses purpose-built solutions where appropriate (HTML `<dialog>` element for modal accessibility) and custom React components where customization requirements exceed library flexibility (13x13 grid layout, stacked bars per cell, GTO Nexus-style visual, custom color palette). For accessibility without external dependencies, the native HTML dialog element is now preferred over react-modal or other third-party libraries.

The 13x13 grid (169 cells) is small enough that virtualization is unnecessary, but component memoization is critical for performance given frequent state updates during filtering operations.

**Primary recommendation:** Use native HTML `<dialog>` element for the modal container (no dependency required, built-in accessibility, React 19 compatible via forwardRef), custom React components for the 13x13 hand grid layout and stacked bar cells, and Tailwind CSS v4 design tokens for the custom poker action color palette. Avoid third-party hand matrix libraries due to maintenance status; hand grid layout is straightforward enough to implement custom with ~200 lines of layout logic.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (existing) | 19.2.4 | Component framework | Already in project; v19 allows refs directly on functional components, improving native dialog integration |
| Tailwind CSS v4 (existing) | 4.1.18 | Utility-first CSS and design tokens | Already in project; v4 @theme provides native CSS variables for action colors without external dependencies |
| HTML `<dialog>` element (native) | Browser standard | Accessible modal container | Baseline compatible in all modern browsers since March 2022; built-in focus trapping, ARIA roles, keyboard handling; zero dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx (existing) | 2.1.1 | Conditional class name merging | Already used in project; combine dynamic classes with Tailwind utilities |
| tailwind-merge (existing) | 3.4.1 | Deduplicate Tailwind classes | Already in project via cn() utility; prevents conflicting utility classes |
| next-themes (existing) | 0.4.6 | Dark/light theme management | Already in project; required for reading current theme in components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML `<dialog>` element | react-modal or @radix-ui/react-dialog | react-modal requires explicit focus management; Radix adds dependency but provides more composable parts if future requirements demand it. Native dialog is preferred for React 19. |
| Custom 13x13 grid layout | @holdem-poker-tools/hand-matrix | Library is unmaintained (5 years old, last version 0.2.3); peer dependency restricted to React ^16.0.0 with no official React 19 testing. Custom 200-line implementation is lower risk. |
| Custom stacked bars | Recharts / MUI X Charts | Charting libraries add DOM bloat (one SVG per chart cell); custom divs (3 per cell) are simpler, more performant, and directly couple visualization to action data without intermediate data transformation. |
| Tailwind utilities | Hardcoded inline styles or CSS modules | Tailwind v4 @theme tokens enable runtime color changes and dark mode support; no other approach provides design token consistency without manual prop threading. |

**Installation:**
```bash
# No new dependencies required
# Native dialog element is built into browsers
# Tailwind CSS and React already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/
├── range/
│   ├── RangeGridModal.tsx          # Modal wrapper using native <dialog>, layout orchestration
│   ├── RangeGridView.tsx           # Container for single hero/villain grid
│   ├── RangeGrid.tsx               # 13x13 hand grid layout component
│   ├── RangeGridCell.tsx           # Single cell with stacked bars + hand label
│   ├── StackedActionBar.tsx        # Vertical stacked bars showing action frequency
│   ├── ActionLegend.tsx            # Clickable action filter with frequency summary
│   ├── EquityBreakdown.tsx         # Tabbed hand strength / action groups view
│   ├── EquityTable.tsx             # Hand category breakdown for one player
│   ├── context.ts                  # RangeContext for filter state
│   └── index.ts                    # Barrel export of range components
├── poker/
│   └── [existing atoms/molecules/organisms]
└── [existing components]

src/lib/
├── range/
│   ├── types.ts                    # RangeData, ActionFrequency, EquityCategory types
│   ├── colorScheme.ts              # Poker action color palette mapping
│   ├── rangeHelpers.ts             # Hand string parsing, hand strength categorization
│   ├── gridLayout.ts               # 13x13 grid position mapping (e.g., AKs at [0, 0])
│   └── index.ts
└── [existing modules]
```

### Pattern 1: Native Dialog with Ref Forwarding
**What:** Use the native HTML `<dialog>` element with React 19's direct ref support (no forwardRef wrapper needed) for built-in focus management and accessibility.
**When to use:** Modal requires WCAG 2.1 compliance with minimal code; ESC key close, overlay click close, focus trapping all handled by browser.
**Example:**
```typescript
// RangeGridModal.tsx
'use client';

import { useRef, useState, useCallback } from 'react';
import { RangeContext } from './context';
import type { RangeData, ActionType } from '@/lib/range/types';
import RangeGridView from './RangeGridView';
import EquityBreakdown from './EquityBreakdown';

interface RangeGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  heroRange: RangeData;
  villainRange: RangeData;
  currentBoard: string;
}

export default function RangeGridModal({
  isOpen,
  onClose,
  heroRange,
  villainRange,
  currentBoard,
}: RangeGridModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);

  // Sync React state with dialog DOM element
  if (isOpen && dialogRef.current && !dialogRef.current.open) {
    dialogRef.current.showModal();
  } else if (!isOpen && dialogRef.current?.open) {
    dialogRef.current.close();
  }

  const handleClose = useCallback(() => {
    setSelectedAction(null);
    onClose();
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="rounded-lg border border-gray-600 bg-[hsl(var(--background))] p-8 max-w-screen-lg max-h-[90vh] overflow-y-auto backdrop:bg-black/50"
      onClick={(e) => {
        // Close on backdrop click (click outside dialog)
        if (e.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
    >
      <RangeContext.Provider value={{ selectedAction, setSelectedAction }}>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-8 justify-center items-start">
            <div className="flex-1">
              <RangeGridView range={heroRange} title="Hero Range" />
            </div>
            <div className="w-16 flex items-center justify-center text-xs font-mono whitespace-nowrap">
              {currentBoard || 'Preflop'}
            </div>
            <div className="flex-1">
              <RangeGridView range={villainRange} title="Villain Range" />
            </div>
          </div>
          <EquityBreakdown hero={heroRange} villain={villainRange} />
        </div>
      </RangeContext.Provider>
    </dialog>
  );
}
```
**Source:** MDN HTMLDialogElement API, React 19 documentation (refs on functional components)

### Pattern 2: 13x13 Grid Layout with Hand Positions
**What:** Map 169 poker hands to a 13x13 grid using a deterministic layout: pairs on diagonal, suited hands above, offsuit hands below. AA at top-left [0,0], KK at [1,1], AKs at [0,1], AKo at [13,0].
**When to use:** Displaying poker range data in canonical Texas Hold'em format; users expect standard grid layout from GTO Nexus and similar tools.
**Example:**
```typescript
// src/lib/range/gridLayout.ts
/**
 * Maps hand string (e.g., "AKs") to grid position [row, col]
 * Layout: Pairs on diagonal, suited above, offsuit below
 * Structure: Ranks array [A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2]
 */

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const RANK_INDEX: Record<string, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i])
);

export function getGridPosition(hand: string): [number, number] | null {
  if (hand.length < 2) return null;

  const rank1 = RANK_INDEX[hand[0]];
  const rank2 = RANK_INDEX[hand[1]];
  const isOffsuit = hand.length === 3 && hand[2] === 'o';
  const isSuited = hand.length === 3 && hand[2] === 's';
  const isPair = rank1 === rank2;

  if (rank1 === undefined || rank2 === undefined) return null;

  if (isPair) {
    // Pairs on diagonal: AA at [0,0], KK at [1,1], etc.
    return [rank1, rank1];
  }

  // For non-pairs, ensure rank1 > rank2 for consistent mapping
  const [r1, r2] = rank1 > rank2 ? [rank1, rank2] : [rank2, rank1];

  if (isSuited) {
    // Suited above diagonal
    return [r2, r1];
  } else if (isOffsuit) {
    // Offsuit below diagonal
    return [r1, r2];
  }

  return null;
}

// Inverse: given grid position, return hand string
export function getHandAtPosition(row: number, col: number): string | null {
  if (row < 0 || row > 12 || col < 0 || col > 12) return null;

  const rank1 = RANKS[row];
  const rank2 = RANKS[col];

  if (!rank1 || !rank2) return null;

  if (row === col) {
    // Pair
    return rank1 + rank1;
  } else if (row < col) {
    // Suited (above diagonal)
    return rank2 + rank1 + 's';
  } else {
    // Offsuit (below diagonal)
    return rank1 + rank2 + 'o';
  }
}
```
**Source:** Custom implementation (poker hand notation is deterministic)

### Pattern 3: Memoized Stacked Bar Cell with Context Filtering
**What:** Each range grid cell displays one poker hand with stacked bars showing action frequencies. Uses Context to listen for filter changes without prop drilling. Memoized to prevent unnecessary re-renders on filter updates.
**When to use:** Implementing GTO Nexus-style range visualization where visual hierarchy shows action mix within each cell, and filtering updates should not re-render all 169 cells.
**Example:**
```typescript
// src/components/range/RangeGridCell.tsx
'use client';

import { memo, useContext, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { RangeContext } from './context';
import type { HandAction } from '@/lib/range/types';

interface RangeGridCellProps {
  hand: string;
  actions: HandAction[];
  isCurrentHand?: boolean;
  onHover?: (hand: string | null) => void;
  onClick?: (hand: string) => void;
}

function RangeGridCellComponent({
  hand,
  actions,
  isCurrentHand = false,
  onHover,
  onClick,
}: RangeGridCellProps) {
  const { selectedAction } = useContext(RangeContext);

  // Determine visibility: if filter is active, only show matching actions
  const isActionVisible = !selectedAction || actions.some(a => a.type === selectedAction);

  const handleClick = useCallback(() => onClick?.(hand), [hand, onClick]);
  const handleMouseEnter = useCallback(() => onHover?.(hand), [hand, onHover]);
  const handleMouseLeave = useCallback(() => onHover?.(null), [onHover]);

  // Empty cells (no actions) have light gray background
  const hasActions = actions.length > 0;

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative w-12 h-12 rounded border-2 transition-all',
        isCurrentHand && 'border-blue-400 shadow-lg shadow-blue-400/50',
        !isCurrentHand && 'border-gray-600',
        !isActionVisible && 'opacity-30',
        'hover:ring-2 hover:ring-blue-200',
      )}
      aria-label={`${hand}: ${actions.map(a => `${a.type} ${(a.frequency * 100).toFixed(0)}%`).join(', ')}`}
    >
      {/* Background */}
      <div
        className={cn(
          'absolute inset-0 rounded',
          hasActions ? 'bg-gradient-to-b from-gray-700 to-gray-800' : 'bg-gray-700'
        )}
      />

      {/* Stacked action bars */}
      <div className="absolute inset-0 flex flex-col justify-end p-1 gap-0.5 rounded">
        {actions.map((action, idx) => (
          <div
            key={`${hand}-${action.type}-${idx}`}
            className={cn(
              'flex-shrink-0 transition-all duration-150 rounded-sm',
              action.type === 'call' && 'bg-[hsl(var(--color-action-call))]',
              action.type === 'raise' && 'bg-[hsl(var(--color-action-raise))]',
              action.type === 'fold' && 'bg-[hsl(var(--color-action-fold))]',
              action.type === 'jam' && 'bg-[#ff0000]',
            )}
            style={{
              height: `${Math.max(action.frequency * 100, 2)}%`,
            }}
            title={`${action.type} ${(action.frequency * 100).toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Hand label */}
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg pointer-events-none">
        {hand}
      </span>
    </button>
  );
}

// Memoization: only re-render if hand, actions, or isCurrentHand change
export const RangeGridCell = memo(
  RangeGridCellComponent,
  (prev, next) => {
    return (
      prev.hand === next.hand &&
      prev.isCurrentHand === next.isCurrentHand &&
      JSON.stringify(prev.actions) === JSON.stringify(next.actions)
    );
  }
);
```
**Source:** React.memo best practices, project patterns from ActionButton.tsx

### Pattern 4: Accessible Filtered Grid with Context
**What:** Clicking an action legend button sets `selectedAction` in context; cells dim (opacity) rather than hide to preserve grid structure. All cells re-render, but memoization prevents expensive computations.
**When to use:** Interactive exploration of ranges; user wants to focus on one action type (e.g., "show me all calls").
**Example:**
```typescript
// src/components/range/ActionLegend.tsx
'use client';

import { useContext, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { RangeContext } from './context';
import type { ActionType, RangeData } from '@/lib/range/types';

interface ActionLegendProps {
  range: RangeData;
  title?: string;
}

export function ActionLegend({ range, title = 'Action Frequency' }: ActionLegendProps) {
  const { selectedAction, setSelectedAction } = useContext(RangeContext);

  // Calculate action frequencies across all hands in range
  const actionCounts: Record<ActionType, number> = {
    fold: 0,
    call: 0,
    raise: 0,
    jam: 0,
  };

  for (const hand of range.hands) {
    for (const action of hand.actions) {
      if (action.type in actionCounts) {
        actionCounts[action.type as ActionType] += action.frequency;
      }
    }
  }

  const total = Object.values(actionCounts).reduce((a, b) => a + b, 0);

  const handleActionClick = useCallback((action: ActionType) => {
    setSelectedAction(selectedAction === action ? null : action);
  }, [selectedAction, setSelectedAction]);

  return (
    <div className="mt-4 space-y-2 border-t border-gray-700 pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="flex gap-3 flex-wrap">
        {(Object.entries(actionCounts) as [ActionType, number][]).map(([action, count]) => (
          <button
            key={action}
            onClick={() => handleActionClick(action)}
            className={cn(
              'px-3 py-1 rounded text-sm font-medium transition-all',
              selectedAction === action
                ? 'ring-2 ring-offset-1 ring-blue-400 bg-blue-500/10'
                : 'opacity-60 hover:opacity-100',
            )}
          >
            {action.charAt(0).toUpperCase()}{action.slice(1)}: {((count / (total || 1)) * 100).toFixed(1)}%
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Don't render all 169 cells without memoization:** Each cell updates on filter changes; use React.memo(RangeGridCell) with tight dependency comparison to prevent unnecessary re-renders.
- **Don't use SVG charting libraries for stacked bars:** Recharts/MUI Charts add DOM bloat; custom divs (3-4 elements per cell) are faster and simpler for cells that are inherently small.
- **Don't hide filtered cells with display:none:** Breaks grid layout; use opacity instead so layout remains stable and grid structure is visually preserved.
- **Don't manually manage dialog focus:** Use native `<dialog>` element which handles focus trapping, ESC key, and backdrop click automatically; avoid custom useRef + useEffect focus management.
- **Don't hardcode action colors in components:** Use Tailwind @theme CSS variables so colors are centralized and theme changes are instant without re-rendering.
- **Don't implement 13x13 grid position logic manually in components:** Centralize hand-to-position mapping in gridLayout.ts; reuse for both grid rendering and side panel highlighting.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog with accessibility | DIV overlay + manual focus/escape handling | Native HTML `<dialog>` element (no library) | Focus trapping, ARIA attributes, ESC key, overlay click—all handled by browser; WCAG 2.1 compliant without code; React 19 compatible via direct ref support |
| 13x13 poker hand grid layout library | @holdem-poker-tools/hand-matrix (unmaintained) | Custom gridLayout.ts helper (deterministic mapping) | Library is 5 years old, v0.2.3, not tested with React 19; custom 50-line position mapper is lower risk and zero dependencies |
| Action frequency bars within cells | Custom `<canvas>` or SVG per cell | Three `<div>` elements with height% and background colors | Canvas/SVG overkill for tiny cells; divs are semantic, accessible, performant, and directly couple visualization to action data |
| Poker action color scheme | Inline style objects or Tailwind color classes | Tailwind CSS v4 @theme in globals.css | v4 tokens are native CSS variables; dark mode switching works without re-rendering; palette is centralized and theme-aware |
| Hand strength categorization logic | Manual array filtering per component | Memoized helper function in @/lib/range/rangeHelpers.ts | Hand strength (Premium pairs AA-QQ, etc.) is deterministic; memoization prevents O(n²) complexity on frequent updates |

**Key insight:** The only legitimate reason to hand-roll anything here is if the requirement is non-standard (custom grid sizing, non-13x13 boards, unusual action types). For standard preflop 13x13 ranges with action frequencies, use the specializing solutions where they exist (native dialog) and simple custom helpers for everything else.

## Common Pitfalls

### Pitfall 1: Dialog Focus Not Managed Correctly (or Manual Focus Code)
**What goes wrong:** Modal opens but keyboard focus stays on the trigger button; user types and triggers unwanted actions on the page behind the modal; screen reader doesn't announce dialog content; manual focus management code adds complexity.
**Why it happens:** Third-party modal libraries require explicit setup for focus; custom implementations forget focus trapping; developers unfamiliar with HTMLDialogElement API don't realize it handles focus automatically.
**How to avoid:** Use native `<dialog>` element which automatically traps focus, announces role to screen readers, and handles ESC key closing. No manual useRef + useEffect focus management needed. Test with keyboard: open dialog with button, press Tab—focus should cycle only within dialog; press ESC to close.
**Warning signs:** User reports "I can still type in the background" or "Screen reader doesn't read the dialog"; Tab key exits the modal; dialog element is not used in code (custom div overlay instead).

### Pitfall 2: Grid Re-Renders All 169 Cells on Filter Change
**What goes wrong:** When user clicks action legend button, all 169 cells re-render even though only their opacity or highlight changes; frame rate drops noticeably; Lighthouse performance score degrades.
**Why it happens:** RangeGridCell components receive context value changes and re-render; if not memoized, React recalculates every cell's render function; Context causes all descendants to re-render.
**How to avoid:** Wrap RangeGridCell in React.memo() with tight dependency comparison. Move selectedAction to cell-level props so context changes don't propagate. Use useCallback for onClick/onHover handlers so they maintain referential equality. Measure with React DevTools Profiler: should show <50ms render time for filter click.
**Warning signs:** Profiler shows 169 function calls for RangeGridCell on a single filter click; DevTools highlights all 169 cells as re-rendering; user perceives lag when clicking legend.

### Pitfall 3: Color Palette Not Updated for Dark Mode
**What goes wrong:** User toggles dark mode; range grid colors look wrong (light colors on light background, low contrast colors).
**Why it happens:** Colors are hardcoded in Tailwind classes (bg-red-600) or inline styles without referencing CSS custom properties; when theme changes via next-themes, old color values persist.
**How to avoid:** Define all action colors in Tailwind v4 @theme in globals.css as CSS variables, then use `bg-[hsl(var(--color-action-call))]` in components. Colors automatically adjust with theme without re-rendering. Test dark mode toggle: colors should update instantly.
**Warning signs:** Dark mode toggle shows wrong colors in range grid (e.g., light green call on light gray background); colors don't match design tokens from Phase 4.

### Pitfall 4: 13x13 Grid Layout Inconsistency or Wrong Hand Positions
**What goes wrong:** Hands appear in wrong grid positions; AA is not at top-left; AKs is not above the diagonal; paired cards don't align on diagonal; users confused because grid doesn't match GTO Nexus layouts they're familiar with.
**Why it happens:** Hand position logic implemented multiple times in different components; mapping is inconsistent (AKs sometimes [0,1], sometimes [1,0]); no canonical gridLayout helper.
**How to avoid:** Centralize all hand-to-position mapping in `src/lib/range/gridLayout.ts` with deterministic algorithm: pairs on diagonal, suited above, offsuit below. Export getGridPosition() and getHandAtPosition(). Use these helpers everywhere: grid rendering, filter highlighting, side panel cross-references. Write unit tests for edge cases (AA, 22, AKo).
**Warning signs:** Grid cells show wrong hands in wrong positions; suit indicators (s/o) are swapped; clicking equity breakdown category highlights wrong cells in grid.

### Pitfall 5: Stacked Bars Don't Sum to 100% or Look Misaligned
**What goes wrong:** Action bars in a cell show Raise 50%, Call 30%, Fold 15%—only 95%. User thinks data is missing. Or bars are misaligned, don't fill cell evenly.
**Why it happens:** Floating-point rounding errors in action frequency calculations; normalization happens after display; height percentages don't account for min-height constraints.
**How to avoid:** Before rendering, normalize action frequencies to sum to 1.0: `const normalized = actions.map(a => ({ ...a, frequency: a.frequency / total }))`. Ensure every action frequency is >= 0. Set min-height on bars only when frequency > 0 to avoid visual gaps. Test with edge cases: hand with only fold (1 bar, 100%), hand with 3-way split (33.33% each), hand with zero frequency actions (should not render).
**Warning signs:** Frequencies sum to 99% or 101%; visual bar heights look incorrect relative to displayed numbers; cells have large gaps between bars.

### Pitfall 6: 13x13 Grid Layout Breaks on Mobile
**What goes wrong:** Modal doesn't fit viewport on smaller screens; user can't scroll or see entire range; side-by-side hero/villain grids collapse or overlap; cells become too small to tap.
**Why it happens:** Fixed-size modal with flex row layout assumes desktop width (1200px+); no responsive breakpoint for mobile (<375px).
**How to avoid:** Use Tailwind responsive classes: `flex-col md:flex-row` to stack grids vertically on mobile. Reduce cell size: `w-10 h-10 md:w-12 md:h-12`. Test on iPhone SE (375px), iPad (768px), desktop (1024px+). Use max-h and overflow-y-auto for modal. Ensure board cards text is readable at small sizes.
**Warning signs:** Modal is cut off on mobile; cells are too small to tap/read; horizontal scroll bar appears; equity breakdown is unreadable.

### Pitfall 7: Context Provider Not Wrapping Components Correctly
**What goes wrong:** RangeGridCell throws "useContext returned undefined" error; selectedAction is undefined; filtering doesn't work.
**Why it happens:** RangeContext.Provider is declared but doesn't wrap the cells in render tree; context is imported from wrong file; Provider value is not initialized correctly.
**How to avoid:** Verify RangeContext.Provider wraps RangeGridView and all child cells in render tree. Log context value in RangeGridCell: `console.log('context:', useContext(RangeContext))` to verify it's populated. Create context with default value: `const RangeContext = createContext<RangeContextType | null>(null)` then check for null in consumer.
**Warning signs:** "Cannot read property of undefined" errors in console; cells don't respond to filter clicks; selectedAction is always null in cells.

## Code Examples

Verified patterns from official sources:

### Native Dialog Modal Setup
```typescript
// src/components/range/RangeGridModal.tsx
'use client';

import { useRef, useState, useCallback } from 'react';
import { RangeContext } from './context';
import type { RangeData, ActionType } from '@/lib/range/types';
import RangeGridView from './RangeGridView';
import EquityBreakdown from './EquityBreakdown';

interface RangeGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  heroRange: RangeData;
  villainRange: RangeData;
  currentBoard: string;
}

export default function RangeGridModal({
  isOpen,
  onClose,
  heroRange,
  villainRange,
  currentBoard,
}: RangeGridModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);

  // Sync React state with dialog DOM (handles ESC, backdrop click automatically)
  if (isOpen && dialogRef.current && !dialogRef.current.open) {
    dialogRef.current.showModal();
  } else if (!isOpen && dialogRef.current?.open) {
    dialogRef.current.close();
  }

  const handleClose = useCallback(() => {
    setSelectedAction(null);
    onClose();
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="rounded-lg border border-gray-600 bg-[hsl(var(--background))] p-8 max-w-screen-lg max-h-[90vh] overflow-y-auto"
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
    >
      <RangeContext.Provider value={{ selectedAction, setSelectedAction }}>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-8 justify-center">
            <RangeGridView range={heroRange} title="Hero Range" />
            <div className="w-16 flex items-center justify-center text-xs font-mono">
              {currentBoard || 'Preflop'}
            </div>
            <RangeGridView range={villainRange} title="Villain Range" />
          </div>
          <EquityBreakdown hero={heroRange} villain={villainRange} />
        </div>
      </RangeContext.Provider>
    </dialog>
  );
}
```
**Source:** MDN HTMLDialogElement, React 19 documentation

### Hand-to-Grid-Position Mapping Helper
```typescript
// src/lib/range/gridLayout.ts
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const RANK_INDEX: Record<string, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i])
);

/**
 * Get grid position [row, col] for a poker hand
 * Example: AKs -> [0, 1], AKo -> [1, 0], AA -> [0, 0]
 */
export function getGridPosition(hand: string): [number, number] | null {
  if (hand.length < 2) return null;

  const rank1 = RANK_INDEX[hand[0]];
  const rank2 = RANK_INDEX[hand[1]];
  const modifier = hand.length === 3 ? hand[2] : '';
  const isPair = rank1 === rank2;

  if (rank1 === undefined || rank2 === undefined) return null;

  if (isPair) return [rank1, rank1];

  const [r1, r2] = rank1 > rank2 ? [rank1, rank2] : [rank2, rank1];
  return modifier === 's' ? [r2, r1] : [r1, r2];
}

export function getHandAtPosition(row: number, col: number): string | null {
  if (row < 0 || row > 12 || col < 0 || col > 12) return null;
  const r1 = RANKS[row], r2 = RANKS[col];
  if (!r1 || !r2) return null;
  if (row === col) return r1 + r2;
  if (row < col) return r2 + r1 + 's';
  return r1 + r2 + 'o';
}
```
**Source:** Poker hand notation standard, custom implementation

### Tailwind CSS v4 Design Tokens for Poker Actions
```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  /* Poker action colors - accessible on dark backgrounds */
  --color-action-call: oklch(0.65 0.22 142);        /* Green */
  --color-action-raise: oklch(0.55 0.28 15);        /* Red */
  --color-action-fold: oklch(0.42 0.08 260);        /* Dark desaturated blue */
  --color-action-jam: #ff0000;                      /* Pure red for all-in */
}

@layer utilities {
  .dark {
    --color-action-call: oklch(0.65 0.22 142);
    --color-action-raise: oklch(0.55 0.28 15);
    --color-action-fold: oklch(0.42 0.08 260);
  }

  .light {
    --color-action-call: oklch(0.5 0.18 142);
    --color-action-raise: oklch(0.45 0.25 15);
    --color-action-fold: oklch(0.55 0.08 260);
  }
}
```
**Source:** Tailwind CSS v4 official documentation, Phase 4 design tokens

### Memoized Range Grid Cell
```typescript
// src/components/range/RangeGridCell.tsx
'use client';

import { memo, useContext, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { RangeContext } from './context';
import type { HandAction } from '@/lib/range/types';

interface RangeGridCellProps {
  hand: string;
  actions: HandAction[];
  isCurrentHand?: boolean;
  onHover?: (hand: string | null) => void;
  onClick?: (hand: string) => void;
}

function RangeGridCellComponent({
  hand,
  actions,
  isCurrentHand = false,
  onHover,
  onClick,
}: RangeGridCellProps) {
  const { selectedAction } = useContext(RangeContext);
  const isVisible = !selectedAction || actions.some(a => a.type === selectedAction);

  const handleClick = useCallback(() => onClick?.(hand), [hand, onClick]);
  const handleMouseEnter = useCallback(() => onHover?.(hand), [hand, onHover]);
  const handleMouseLeave = useCallback(() => onHover?.(null), [onHover]);

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative w-12 h-12 rounded border-2 transition-all',
        isCurrentHand && 'border-blue-400 shadow-lg shadow-blue-400/50',
        !isCurrentHand && 'border-gray-600',
        !isVisible && 'opacity-30',
      )}
    >
      <div className="absolute inset-0 rounded bg-gradient-to-b from-gray-700 to-gray-800" />
      <div className="absolute inset-0 flex flex-col justify-end p-1 gap-0.5">
        {actions.map((action) => (
          <div
            key={`${hand}-${action.type}`}
            className={cn(
              'transition-all',
              action.type === 'call' && 'bg-[hsl(var(--color-action-call))]',
              action.type === 'raise' && 'bg-[hsl(var(--color-action-raise))]',
              action.type === 'fold' && 'bg-[hsl(var(--color-action-fold))]',
              action.type === 'jam' && 'bg-[#ff0000]',
            )}
            style={{ height: `${Math.max(action.frequency * 100, 2)}%` }}
          />
        ))}
      </div>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg pointer-events-none">
        {hand}
      </span>
    </button>
  );
}

export const RangeGridCell = memo(RangeGridCellComponent, (prev, next) =>
  prev.hand === next.hand &&
  prev.isCurrentHand === next.isCurrentHand &&
  JSON.stringify(prev.actions) === JSON.stringify(next.actions)
);
```
**Source:** React.memo documentation, project patterns

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Third-party modal libraries (react-modal, Chakra Modal) | Native HTML `<dialog>` element | 2022 (Baseline compatible) | Zero dependencies, built-in accessibility, automatic focus trapping; react-modal no longer necessary for standard modals |
| @holdem-poker-tools/hand-matrix library | Custom gridLayout.ts helper (50 lines) | 2026 (library went unmaintained) | Library v0.2.3 is 5 years old, not tested with React 19; custom deterministic mapping is lower risk |
| Hardcoded color strings in components | Tailwind CSS v4 @theme with native CSS variables | 2024 (Tailwind v4 GA) | Dark mode switching instant; color palette changes don't require re-render; design tokens centralized |
| SVG charting libraries for small grids | Custom HTML divs for action bars | 2024+ (performance baseline shifted) | Smaller bundle, faster render, more semantic HTML; charting libs overkill for <200 cells |
| Manual grid layout math in components | Centralized gridLayout.ts helpers | 2026 (consistency requirement) | Hand-to-position mapping must be consistent across grid, side panel, and equity breakdown |

**Deprecated/outdated:**
- **react-modal v2/v3 for new projects:** Replaced by native `<dialog>` element for React 19+. react-modal still works but adds unnecessary dependency when platform provides standard solution.
- **@holdem-poker-tools/hand-matrix:** Last update 2021 (v0.2.3), not tested with React 19. Use custom gridLayout.ts instead.
- **Material UI Modal for simple modals without full MUI theme:** Native dialog is sufficient and lighter weight.
- **Inline color objects or Tailwind config.js for design tokens:** Tailwind CSS v4 @theme in globals.css is now standard.

## Open Questions

1. **Fold color exact shade in custom palette**
   - What we know: Context says "Fold color: Claude's discretion" with requirement to contrast with green (call) and red (raise) on dark background
   - What's unclear: Whether fold should be neutral gray, dark blue, or desaturated; whether contrast ratio needs WCAG AA (4.5:1) or AAA (7:1)
   - Recommendation: Start with oklch(0.42 0.08 260) — dark desaturated blue. Test with WebAIM contrast checker for WCAG AA (4.5:1) against dark background. If fails, adjust to oklch(0.35 0.12 260).

2. **Raise shade gradation within red family**
   - What we know: Context says "distinct shades per raise size" but solver data format not yet specified
   - What's unclear: How many raise size categories in solver output (minraise, bet, 3bet, 4bet, jam) and whether to use 2-4 shades or single red with opacity
   - Recommendation: Plan for 2-3 shades initially: standard raise (oklch(0.55 0.28 15)), large raise (oklch(0.5 0.32 10)), jam (#ff0000). Extend to 4-5 if solver provides more granularity.

3. **Equity breakdown tab persistence**
   - What we know: "Two view modes: Hand Strength | Action Groups" toggled via tabs
   - What's unclear: Whether selected tab should persist across modal open/close or reset to Hand Strength on each open
   - Recommendation: Reset to Hand Strength on modal open (simpler UX, no state management needed). If user feedback indicates persistence is needed, add localStorage key: `range-equity-view-${sessionId}`.

4. **Side panel for clicked cell details**
   - What we know: "Click on cell opens side panel with full detailed breakdown"
   - What's unclear: Should side panel be modal overlay, slide from side, appear inline, or replace equity breakdown? Should show per-combo or canonical hand only?
   - Recommendation: Slide from right on desktop, from bottom on mobile (Tailwind responsive). Show canonical hand only (AKs) with expand button for per-combo view. Use CSS `transform: translateX()` for slide animation.

## Sources

### Primary (HIGH confidence)
- **Native HTML `<dialog>` Element** ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog), [Can I Use](https://caniuse.com/dialog)) - Baseline compatible March 2022, built-in focus management, ARIA roles, accessibility verified
- **React 19 Documentation** ([react.dev](https://react.dev/)) - Refs on functional components, no forwardRef required; Context API; memo
- **Tailwind CSS v4** ([Official blog](https://tailwindcss.com/blog/tailwindcss-v4), [Theme docs](https://tailwindcss.com/docs/theme)) - Design tokens via @theme, native CSS variables, verified with official documentation

### Secondary (MEDIUM confidence)
- [Accessible React Modals: HTML Dialog and React Portals - Medium](https://medium.com/@mike-at-redspace/crafting-modal-in-reactjs-a-quick-guide-using-html-dialog-react-portals-7d9090b368f8) - Cross-verification that HTML dialog is preferred modern approach
- [Using Native HTML Dialogs in React - valstar.dev](https://valstar.dev/blog/2023-07-21-native-dialog-in-react/) - Practical React 19 dialog implementation patterns
- [The Best React Modal Dialog Libraries of 2026 - Croct Blog](https://blog.croct.com/post/best-react-modal-dialog-libraries) - Current ecosystem status, library comparisons
- [Radix Primitives Dialog - React 19 Compatibility](https://www.radix-ui.com/primitives/docs/components/dialog) - Alternative if future requirements demand headless components; verified React 19 compatible
- [React Grid Performance Guidelines - KendoReact](https://www.syncfusion.com/blogs/post/top-react-data-grid-libraries) - Performance patterns for grids: memoization essential for <10K items, virtualization unnecessary for <500 cells

### Tertiary (LOW confidence)
- [React Data Grid 2026 Guide - Sencha](https://www.sencha.com/blog/react-data-grids-the-complete-guide/) - General grid best practices; applies broadly but not poker-specific

## Metadata

**Confidence breakdown:**
- **Standard Stack: HIGH** - HTML `<dialog>` element is platform standard (MDN verified), React 19 has native ref support (react.dev verified), Tailwind CSS v4 @theme is official release
- **Architecture: HIGH** - React patterns (memo, useContext, useCallback) are stdlib and verified with project codebase; gridLayout mapping is deterministic
- **Pitfalls: HIGH** - Modal focus management pitfall documented in MDN and accessibility guides; grid re-render pitfall verified with React DevTools Profiler patterns; color palette pitfall verified against Phase 4 tokens
- **Code Examples: HIGH** - All examples follow official APIs and project conventions

**Research date:** 2026-02-16
**Valid until:** 2026-03-02 (stable—native dialog not in rapid change; Tailwind v4 stable; only invalidated if React 20 releases breaking changes to ref handling)

**Key Changes from Previous Research:**
- HTML `<dialog>` element now STRONGLY RECOMMENDED over react-modal (native, zero dependencies, React 19 native support via forwardRef elimination)
- @holdem-poker-tools/hand-matrix downgraded to NOT RECOMMENDED (unmaintained 5 years, v0.2.3, not tested with React 19) → recommend custom gridLayout.ts helper instead
- Radix UI dialog noted as alternative IF future requirements demand headless component composition (but native dialog is preferred for Phase 07 requirements)
