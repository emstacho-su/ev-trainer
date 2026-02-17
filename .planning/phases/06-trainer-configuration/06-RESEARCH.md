# Phase 6: Trainer Configuration - Research

**Researched:** 2026-02-16
**Domain:** Session Configuration UI, State Management, Settings Persistence
**Confidence:** HIGH

## Summary

Phase 6 implements a comprehensive trainer configuration system with two primary surfaces: a lobby-based card layout for pre-session configuration, and a mid-session sidebar drawer for adjustable filters. The phase combines form state management, localStorage-backed persistence for session memory, database-backed persistence for authenticated users, and custom toggle/preset UI patterns. Core challenges are maintaining filter validation (minimum selection rules), architectural separation between locked lobby-only settings and mid-session-adjustable filters, and providing clear visual distinction of configuration surfaces.

**Research domains covered:**
- React state management patterns for configuration (useState, Context, custom hooks)
- UI patterns for multi-select toggle chips and dropdown selectors
- Session configuration persistence (localStorage + database)
- Overlay/drawer implementation with state management
- Toast notification patterns for session notifications
- Form validation with constraint enforcement

**Primary recommendation:** Use React Context with custom hooks for session configuration state, localStorage for browser-side persistence, and Prisma for server-side user preferences. Implement toggle chips with Tailwind peer selector pattern. Use a custom toast context for session notifications.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI framework with hooks | Already in project; hooks provide sufficient state management for configuration |
| Next.js | 16.1.6 | Full-stack framework | Already in project; App Router handles routing and API layer |
| Tailwind CSS | v4 | Utility-first CSS | Already in project; peer selector enables toggle patterns without state |
| TypeScript | 5.9.3 | Type safety | Already in project; strict mode enabled |
| React Hook Form | Not yet installed | Form state management | Industry standard for efficient form handling with minimal re-renders; integrates with Zod validation |
| Zod | 4.3.6 | Runtime schema validation | Already in project for API validation; extend to form validation |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| localStorage API | Native browser API | Client-side persistence | Persist last used lobby configuration across sessions |
| Prisma Client | 7.3.0 | Database ORM | Persist authenticated user's trainer configuration server-side |
| Context API | Native React | Shared state (theme, auth) | Shared state that's stable/infrequent (e.g., training mode context) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Hook Form | Manual useState + useEffect | Less efficient (more re-renders), requires custom validation logic, ~200 LOC vs ~50 with RHF |
| Context API | Zustand/Jotai | Unnecessary overhead for stable configuration state; Context is sufficient for session config |
| Tailwind peer | Headless UI/Radix | Peer selector is sufficient; no third-party component library in use |
| Uncontrolled checkboxes (HTML) | Controlled React state | Uncontrolled fits form workflow; controlled adds re-render overhead for large filter lists |

**Installation:**

```bash
npm install react-hook-form
```

(Other dependencies already in project)

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── TrainerLobby.tsx          # Main lobby screen with config cards
│   ├── ConfigCard.tsx             # Reusable card wrapper for config sections
│   ├── ModeToggle.tsx             # Preflop/Flop toggle (lobby-only)
│   ├── GameSetup.tsx              # Game type, table size, stack depth selectors
│   ├── PositionFilters.tsx        # Position multi-select with presets
│   ├── PotTypeFilters.tsx         # Pot type multi-select
│   ├── DrillSuggestions.tsx       # Weak spot drills top 3
│   ├── SessionSidebar.tsx         # Mid-session configuration drawer
│   ├── ToastContainer.tsx         # Toast notification renderer
│   └── SessionSummary.tsx         # End-of-session summary screen
├── lib/
│   ├── v2/
│   │   ├── config/
│   │   │   ├── configStore.ts    # LocalStorage + client-side config state
│   │   │   ├── userPreferences.ts # Server-side user config API
│   │   │   └── filters.ts        # Config validation and defaults
│   │   └── hooks/
│   │       ├── useTrainerConfig.ts # Custom hook for config state + persistence
│   │       ├── useToast.ts        # Toast notification hook
│   │       └── useSessionTarget.ts # Hand count target state
│   └── ui/
│       ├── toastContext.ts        # Toast notification context
│       └── toastHelpers.ts        # Toast creation utilities
└── server/
    └── routes/
        └── config.routes.ts       # GET/POST /api/config endpoints
```

### Pattern 1: Session Configuration State with localStorage

**What:** Centralized configuration state with client-side persistence and server-side sync for authenticated users.

**When to use:** Whenever session configuration needs to be remembered across browser sessions and synced to a server for authenticated users.

**Example:**

```typescript
// src/lib/v2/hooks/useTrainerConfig.ts
import { useState, useEffect, useCallback } from 'react';
import type { TrainerConfig } from '../config/configStore';
import { loadConfigFromStorage, saveConfigToStorage } from '../config/configStore';

export function useTrainerConfig(userId?: string) {
  const [config, setConfig] = useState<TrainerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage on mount
  useEffect(() => {
    setIsLoading(true);
    const stored = loadConfigFromStorage();
    setConfig(stored);
    setIsLoading(false);
  }, []);

  // Auto-save to localStorage on change
  useEffect(() => {
    if (config) {
      saveConfigToStorage(config);
      // Sync to server if authenticated
      if (userId) {
        void syncConfigToServer(userId, config).catch(console.error);
      }
    }
  }, [config, userId]);

  const updateConfig = useCallback((updates: Partial<TrainerConfig>) => {
    setConfig((prev) => prev ? { ...prev, ...updates } : null);
  }, []);

  return { config, updateConfig, isLoading };
}
```

Source: [React State Persistence Patterns](https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/), [React Hook Form Integration](https://www.react-hook-form.com/advanced-usage/)

### Pattern 2: Multi-Select Toggle Chips with Tailwind peer

**What:** Multi-select filter UI using toggle chips with "Select All"/"Blinds Only"/"Late Position" presets, implemented with uncontrolled HTML inputs and Tailwind peer selector.

**When to use:** For position and pot type multi-select filters that don't require JavaScript-heavy validation during selection.

**Example:**

```typescript
// src/components/PositionFilters.tsx
'use client';

import { useMemo, useState } from 'react';

const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

const PRESETS = {
  'All Positions': POSITIONS,
  'Blinds Only': ['SB', 'BB'],
  'Late Position Only': ['CO', 'BTN', 'SB', 'BB'],
};

export default function PositionFilters({
  selected: initialSelected,
  onChange,
}: {
  selected: string[];
  onChange: (positions: string[]) => void;
}) {
  const [selectedSet, setSelectedSet] = useState(new Set(initialSelected));

  const handleToggle = (position: string) => {
    const next = new Set(selectedSet);
    // Enforce minimum: at least one position must be selected
    if (selectedSet.has(position) && selectedSet.size === 1) {
      return;
    }
    next.has(position) ? next.delete(position) : next.add(position);
    setSelectedSet(next);
    onChange(Array.from(next));
  };

  const applyPreset = (presetName: keyof typeof PRESETS) => {
    const preset = PRESETS[presetName];
    setSelectedSet(new Set(preset));
    onChange(preset);
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Positions</legend>

      {/* Preset buttons */}
      <div className="flex gap-2">
        {Object.keys(PRESETS).map((presetName) => (
          <button
            key={presetName}
            type="button"
            onClick={() => applyPreset(presetName as keyof typeof PRESETS)}
            className="rounded-full border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100"
          >
            {presetName}
          </button>
        ))}
      </div>

      {/* Toggle chips */}
      <div className="flex flex-wrap gap-2">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => handleToggle(pos)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              selectedSet.has(pos)
                ? 'bg-stone-900 text-white'
                : 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50'
            }`}
          >
            {pos}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
```

Source: [Tailwind peer selector patterns](https://www.prudkohliad.com/articles/multi-select-dropdown-with-react-and-tailwind-4-2025-02-04), [Material Tailwind chips](https://www.material-tailwind.com/docs/react/chip)

### Pattern 3: Session Sidebar Drawer Overlay

**What:** Left-side overlay drawer that slides over the table when opened from hamburger menu, maintaining table layout underneath while allowing configuration changes mid-session.

**When to use:** For settings that must be accessible during active training sessions without interrupting gameplay.

**Example:**

```typescript
// src/components/SessionSidebar.tsx
'use client';

import { useEffect, useRef } from 'react';
import type { TrainerConfig } from '../lib/v2/config/configStore';

export default function SessionSidebar({
  isOpen,
  config,
  onConfigChange,
  onClose,
}: {
  isOpen: boolean;
  config: TrainerConfig;
  onConfigChange: (updates: Partial<TrainerConfig>) => void;
  onClose: () => void;
}) {
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar drawer */}
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 z-50 h-screen w-80 transform bg-white shadow-lg transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Session Settings</h2>
            <button
              onClick={onClose}
              className="text-stone-500 hover:text-stone-900"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          {/* Changeable settings (position/pot filters, hand target) */}
          {/* Lobby-only settings hidden/disabled */}
          <fieldset disabled className="opacity-50">
            <legend>Locked (lobby-only)</legend>
            <p className="text-sm text-stone-600">Mode, Game Type, Table Size, Stack Depth</p>
          </fieldset>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Hand Count Target
              <input
                type="number"
                value={config.handCountTarget ?? ''}
                onChange={(e) =>
                  onConfigChange({ handCountTarget: e.target.value ? parseInt(e.target.value) : undefined })
                }
                className="mt-1 w-full rounded border border-stone-300 p-2"
              />
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
```

Source: [React Drawer Patterns](https://www.shadcn.io/ui/drawer), [Overlay State Management](https://strapi.io/blog/react-and-nextjs-in-2025-modern-best-practices)

### Anti-Patterns to Avoid

- **Lifting config state too high:** Don't manage all configuration in root layout Context; keep it local to lobby or session page, lifting only what's shared (e.g., user auth).
- **Over-relying on localStorage without validation:** Always validate deserialized config against schema; stale or corrupted localStorage data causes silent failures.
- **Controlled inputs for large filter lists:** Avoid managing 50+ checkbox states individually in React; use uncontrolled inputs with form submission or value tracking via Set/Array.
- **No minimum selection enforcement:** Filter states like "select at least one position" must be enforced at component level and API level to prevent invalid sessions.
- **Persisting all state changes to database immediately:** Debounce or batch server sync; don't write on every keystroke (use client-side state first, sync on blur or submission).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state + validation | Custom useState + useCallback handlers + manual error tracking | React Hook Form + Zod | RHF minimizes re-renders, integrates with schema validation, handles complex forms efficiently |
| Toast notifications | DOM mutation + setTimeout cleanup | Custom Context + hook | Toast context prevents multiple toasts per trigger, queuing, auto-dismiss, and accessibility |
| Drawer animation | CSS transitions + manual state | CSS classes + transition, click outside handler | Tailwind transitions are sufficient; premature optimization for animations is premature |
| localStorage serialization | Custom JSON encode/decode | JSON.stringify/parse + Zod parsing | Zod validation on deserialization catches corruption and schema changes |
| Preset button logic | If-else chains per preset | Data-driven presets (object lookup) | Easier to add presets, type-safe, reduces boolean logic |
| Filter validation (min/max selection) | Conditional button disabling | Set-based tracking + early-return guards | Prevents invalid state from being created; Set operations are clearer than array methods |

**Key insight:** Configuration forms are where most UI state management complexity concentrates. Use a library (React Hook Form) to separate form state from UI rendering, and validate early to prevent invalid states propagating to the API.

## Common Pitfalls

### Pitfall 1: No Minimum Filter Selection Validation

**What goes wrong:** User deselects all positions and clicks "Start Training", creating a session with empty filters. API accepts it (or rejects silently), user sees no feedback.

**Why it happens:** Filter constraints (at least one position, at least one pot type) are not enforced at component level. No early-return guard on button click.

**How to avoid:**
1. Track selected positions/pot types in a Set or derived state
2. Disable "Start Training" button if Set is empty
3. Show inline error message ("Select at least one position")
4. Validate schema server-side as well (Zod guard)

**Warning signs:**
- User can click "Start Training" with no visible selections
- Form submission succeeds with empty filter arrays
- No error toast or message after submission

**Example:**
```typescript
const canStart = useMemo(
  () => selectedPositions.size > 0 && selectedPotTypes.size > 0,
  [selectedPositions, selectedPotTypes]
);

<button disabled={!canStart} className="...">
  {!canStart && <span className="text-red-600">Select at least one position and pot type</span>}
  Start Training
</button>
```

### Pitfall 2: Stale localStorage Data After Schema Changes

**What goes wrong:** Developer adds a new config field (e.g., `handCountTarget`). Old localStorage still has the old schema. App loads old config, code accesses new field expecting it, gets undefined, crashes or falls back silently.

**Why it happens:** localStorage is unversioned. No validation on deserialization. Schema evolution not planned.

**How to avoid:**
1. Always validate localStorage data with Zod schema on load
2. Provide default for missing fields in schema
3. Consider versioning localStorage key: `trainer-config-v1`, `trainer-config-v2`
4. In migration, parse old version and transform to new

**Warning signs:**
- Config loading fails silently (no error logged)
- New config fields are always undefined
- Old localStorage data prevents new features from working

**Example:**
```typescript
const configSchema = z.object({
  mode: z.enum(['PREFLOP', 'FLOP']),
  positions: z.array(z.string()).min(1),
  potTypes: z.array(z.string()).min(1),
  handCountTarget: z.number().optional(), // New field with default
});

function loadConfigFromStorage(): TrainerConfig {
  const raw = localStorage.getItem('trainer-config');
  if (!raw) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    return configSchema.parse(parsed); // Zod validates and fills defaults
  } catch (e) {
    console.error('Config validation failed, using default:', e);
    return DEFAULT_CONFIG;
  }
}
```

### Pitfall 3: Losing Filter Changes When Session Starts

**What goes wrong:** User adjusts position filters on lobby, accidentally navigates away or closes tab, returns, lobby is reset to defaults. User had to re-select filters.

**Why it happens:** Lobby form state is component-local, not persisted. Only the final submitted config is saved (in session record).

**How to avoid:**
1. Save in-progress lobby configuration to localStorage on every change (debounced)
2. Load from localStorage on lobby mount
3. Keep "last used config" separate from "active session config"

**Warning signs:**
- Filters reset when navigating away from lobby
- No indication that config was saved
- Users report having to re-enter filters often

**Example:**
```typescript
// Save to localStorage on each change (debounced)
useEffect(() => {
  const timer = setTimeout(() => {
    saveLobbyConfigToStorage(formState);
  }, 500);
  return () => clearTimeout(timer);
}, [formState]);

// Load on component mount
useEffect(() => {
  const saved = loadLobbyConfigFromStorage();
  if (saved) {
    setFormState(saved);
  }
}, []);
```

### Pitfall 4: Sidebar Doesn't Actually Reflect Session State

**What goes wrong:** User changes position filters in sidebar mid-session. Sidebar shows new selection, but table continues showing old spots. User thinks filters are applied but they're not.

**Why it happens:** Sidebar state is local to sidebar component. Table doesn't subscribe to sidebar changes. Or changes are local-only, not synced to session record.

**How to avoid:**
1. Pass `onConfigChange` callback from session page (not sidebar)
2. Session page owns true config state, sidebar updates that state
3. Table component subscribes to session's config via props or context
4. Show a toast when filter change takes effect ("Filters applied on next hand")

**Warning signs:**
- User changes sidebar settings, table behavior unchanged
- No confirmation toast after sidebar change
- Sidebar and table config appear inconsistent

## Code Examples

### Complete Lobby Screen with Config Cards

```typescript
// src/components/TrainerLobby.tsx
'use client';

import { useState, useMemo } from 'react';
import ConfigCard from './ConfigCard';
import ModeToggle from './ModeToggle';
import GameSetup from './GameSetup';
import PositionFilters from './PositionFilters';
import PotTypeFilters from './PotTypeFilters';
import DrillSuggestions from './DrillSuggestions';
import type { TrainerConfig } from '../lib/v2/config/configStore';

export default function TrainerLobby({ onStartSession }: { onStartSession: (config: TrainerConfig) => Promise<void> }) {
  const [config, setConfig] = useState<TrainerConfig>({
    mode: 'PREFLOP',
    gameType: 'CASH',
    tableSize: '6max',
    stackDepth: '100bb',
    positions: ['BB', 'SB'],
    potTypes: ['SRP'],
  });

  const canStart = useMemo(
    () => config.positions.length > 0 && config.potTypes.length > 0,
    [config.positions, config.potTypes]
  );

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-semibold">Trainer Configuration</h1>
        <p className="text-stone-600">Customize your training session</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Essentials card */}
        <ConfigCard title="Essentials" subtitle="Mode and Game Setup">
          <div className="space-y-4">
            <ModeToggle
              value={config.mode}
              onChange={(mode) => setConfig({ ...config, mode })}
            />
            <GameSetup
              gameType={config.gameType}
              tableSize={config.tableSize}
              stackDepth={config.stackDepth}
              onChange={(updates) => setConfig({ ...config, ...updates })}
            />
          </div>
        </ConfigCard>

        {/* Drill suggestions card */}
        <ConfigCard title="Quick Drill" subtitle="Suggested weak spots">
          <DrillSuggestions onSelectDrill={(drill) => setConfig({ ...config, ...drill })} />
        </ConfigCard>
      </div>

      {/* Advanced card (collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-lg font-semibold">
          Advanced Filters <span className="group-open:hidden">▶</span><span className="hidden group-open:inline">▼</span>
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ConfigCard title="Positions">
            <PositionFilters
              selected={config.positions}
              onChange={(positions) => setConfig({ ...config, positions })}
            />
          </ConfigCard>
          <ConfigCard title="Pot Types">
            <PotTypeFilters
              selected={config.potTypes}
              onChange={(potTypes) => setConfig({ ...config, potTypes })}
            />
          </ConfigCard>
        </div>
      </details>

      {/* Start button */}
      <div className="flex items-center justify-between">
        {!canStart && (
          <p className="text-sm text-red-600">Select at least one position and pot type</p>
        )}
        <button
          onClick={() => onStartSession(config)}
          disabled={!canStart}
          className="rounded bg-stone-900 px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Start Training
        </button>
      </div>
    </main>
  );
}
```

Source: [React Hook Form API](https://react-hook-form.com/docs/useform), [Tailwind Details/Summary](https://tailwindcss.com/docs)

### Toast Notification Context & Hook

```typescript
// src/lib/ui/toastContext.ts
'use client';

import { createContext, useContext, useState, useCallback } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number; // ms, undefined = permanent
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: Toast['type'] = 'info', duration = 3000) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type, duration }]);

      if (duration) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
```

Source: [React Context + Hooks Pattern](https://react.dev/reference/react/createContext), [Toast UI Examples](https://flowbite.com/docs/components/toast/)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual form state (10+ useState calls) | React Hook Form + Zod | 2020+ (RHF v5) | Reduced boilerplate ~70%, improved performance via selective subscriptions |
| window.localStorage directly | Custom hook wrapper with Zod validation | 2022+ | Safe deserialization, schema evolution, easier testing |
| Global Redux store for all state | Hybrid: Context for stable state, localStorage for persistence, server state in DB | 2024+ | Simpler mental model, fewer re-renders, clearer data ownership |
| Styled components / CSS-in-JS | Tailwind CSS utility classes | 2021+ | Faster builds, smaller CSS bundles, easier responsive design |
| Class components with setState | Functional components with hooks | 2019+ | Clearer logic flow, better code sharing (custom hooks), smaller bundle sizes |

**Deprecated/outdated:**
- Redux for simple configuration state: Overkill for stable, infrequent updates. Context + custom hooks sufficient.
- MobX: Reactive tracking less predictable; TypeScript integration weaker than simpler alternatives.
- Controlled inputs for large filter lists: Performance penalty. Use uncontrolled + form submission or value tracking via primitives (Set, Array).

## Open Questions

1. **Minimum hand threshold for drill suggestions**
   - What we know: CONTEXT.md specifies "minimum data threshold required before drill suggestions appear"
   - What's unclear: How many hands? How many in a specific spot? Different for each position/pot combo?
   - Recommendation: Research existing EV Trainer stats (Phase 5) to see typical session hand counts, propose 50 hands total or 5 hands per spot. Planner makes final call.

2. **How to handle "Drill This" from stats page before stats page exists (Phase 8)**
   - What we know: CONTEXT.md defers stats page integration to Phase 8; this phase builds drill infrastructure
   - What's unclear: Should Phase 6 include a placeholder for stats drill buttons, or integrate fully?
   - Recommendation: Build drill suggestion cards on lobby (Phase 6). Phase 8 adds server-side "Drill This" button that pre-fills and navigates to lobby. No blocker.

3. **Hand count target options**
   - What we know: CONTEXT.md says "optional configurable hand count target in settings"
   - What's unclear: Dropdown with presets (25, 50, 100) or freeform input? Min/max limits?
   - Recommendation: Dropdown with presets + "Custom" option with number input. Min 1, max 1000. Allows both quick selection and flexibility.

4. **Sidebar animation and backdrop opacity**
   - What we know: Sidebar overlays table with backdrop dim
   - What's unclear: Exact timing (300ms? 500ms?) and backdrop opacity (30%? 50%?)
   - Recommendation: 300ms duration (snappy), 30% backdrop (dark enough to dim, light enough to see table underneath). Standard Tailwind durations.

5. **Database schema for user preferences**
   - What we know: Prisma User model exists; no dedicated preferences model yet
   - What's unclear: Should trainer config be stored as JSON in User model, or separate TrainerPreferences model with relationship?
   - Recommendation: Add optional `trainerPreferences: Json` field to User model initially. If preferences grow (saved drill presets, etc.), migrate to separate TrainerPreferences table later.

## Sources

### Primary (HIGH confidence)

- **React Documentation** - React 19.2 hooks (useState, useEffect, useContext, custom hooks)
  - [React Hooks API](https://react.dev/reference/react/hooks)
  - [Context API](https://react.dev/reference/react/createContext)

- **React Hook Form** - Form state management patterns
  - [React Hook Form Docs](https://react-hook-form.com/)
  - [Advanced Usage](https://react-hook-form.com/advanced-usage/)

- **Zod Documentation** - Runtime schema validation
  - [Zod Validation](https://zod.dev/)

- **Tailwind CSS v4** - Utility styling and peer selector
  - [Tailwind Peer Selector](https://tailwindcss.com/docs/hover-focus-and-other-states#peer)
  - [Tailwind Transitions](https://tailwindcss.com/docs/transition-property)

- **Prisma Documentation** - Database persistence
  - [Prisma ORM with Next.js](https://www.prisma.io/docs/guides/nextjs)

- **MDN Web APIs** - localStorage and native browser APIs
  - [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

### Secondary (MEDIUM confidence)

- **WebSearch verified with official patterns:**
  - [State Management in React 2026](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns) - Context API recommended for stable configuration state
  - [React Drawer Patterns](https://strapi.io/blog/react-and-nextjs-in-2025-modern-best-practices) - Overlay drawer with state management
  - [Multi-Select with React and Tailwind](https://www.prudkohliad.com/articles/multi-select-dropdown-with-react-and-tailwind-4-2025-02-04) - Chip and toggle patterns with Tailwind peer

- **Toast Notification Patterns:**
  - [Flowbite Toast Components](https://flowbite.com/docs/components/toast/)
  - [Tailwind Toast Examples](https://tailwindcss.com/plus/ui-blocks/application-ui/overlays/notifications)

- **Form Persistence:**
  - [localStorage State Persistence](https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/) - Best practices for browser persistence
  - [React Hook Form Persist](https://github.com/tiaanduplessis/react-hook-form-persist) - Form state persistence library

### Tertiary (LOW confidence - WebSearch only, marked for validation)

- [Tailwind CSS Chip Component](https://www.material-tailwind.com/docs/react/chip) - External library example; project doesn't use Material Tailwind
- [React Navigation Drawer](https://reactnavigation.org/docs/drawer-layout/) - React Native specific; not applicable to web

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| React state patterns | HIGH | Official React docs, verified with 2026 articles |
| Form management (React Hook Form + Zod) | HIGH | Official documentation, industry standard, matches project stack |
| UI patterns (toggle chips, presets, drawers) | HIGH | Multiple verified sources (official Tailwind, Flowbite, recent 2026 articles) |
| localStorage persistence | HIGH | Official MDN, verified with React-specific guides |
| Toast notifications | MEDIUM | Patterns clear, but exact implementation left to project; no third-party toast library mandated |
| Database persistence (Prisma) | HIGH | Official Prisma docs, integrated with project |
| Minimum hand threshold for drills | LOW | Deferred to planner; requires stats data from Phase 5 |
| Animation timing/opacity specifics | LOW | Deferred to planner; standard Tailwind defaults sufficient |

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days; stable domain, minor library updates possible)

---

*Phase: 06-trainer-configuration*
*Research completed: 2026-02-16*
