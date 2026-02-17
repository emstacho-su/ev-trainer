# Phase 6: Trainer Configuration - Research

**Researched:** 2026-02-17
**Domain:** Session Configuration UI, State Management, Settings Persistence
**Confidence:** HIGH

## Summary

Phase 6 implements a comprehensive trainer configuration system with two primary surfaces: a lobby-based card layout for pre-session configuration, and a mid-session sidebar drawer for adjustable filters. The phase combines form state management (React Hook Form 7.71.1), localStorage-backed persistence with Zod validation, database-backed persistence via Prisma 7.3.0 JSON fields, and custom toggle/preset UI patterns with Tailwind CSS v4. Core challenges are maintaining filter validation constraints (minimum selection rules), architectural separation between locked lobby-only settings and mid-session-adjustable filters, and providing clear visual distinction between configuration surfaces.

**Research domains covered:**
- React 19.2 hooks patterns for configuration state management
- React Hook Form 7.71.1 installation and integration with Zod validation
- Tailwind CSS v4 multi-select chip patterns and drawer overlay animations
- Next.js 16 API route POST handling for configuration persistence
- localStorage with Zod schema validation for client-side persistence
- Prisma 7.3.0 JSON field typing and runtime validation
- Toast notification patterns with React Context API
- Common pitfalls in filter-based form state management

**Primary recommendation:** Use React Hook Form 7.71.1 with Zod schemas for robust form state and validation. Implement localStorage + Zod for client-side persistence with schema migration support. Store user preferences in Prisma User.trainerPreferences JSON field with prisma-json-types-generator for type safety. Build custom toast context for session notifications. Use Tailwind peer selector for toggle chips and fixed positioning + transform for drawer overlay animations.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI framework with hooks | Already in project; useCallback, useState, useContext sufficient for configuration |
| Next.js | 16.1.6 | Full-stack framework | Already in project; Route Handlers (app directory) for API endpoints, middleware for auth |
| React Hook Form | 7.71.1 | Form state management | Industry standard for efficient form handling; minimizes re-renders; integrates perfectly with Zod |
| Tailwind CSS | v4 | Utility-first CSS | Already in project; peer selector for toggles, fixed positioning for overlays, transform for animations |
| TypeScript | 5.9.3 | Type safety | Already in project; strict mode enables compile-time config validation |
| Zod | 4.3.6 | Runtime schema validation | Already in project; validates forms, localStorage, and API payloads consistently |
| Prisma | 7.3.0 | Database ORM | Already in project; JSON field support for user preferences |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| localStorage API | Native (browser) | Client-side persistence | Persist last used lobby configuration across sessions and page reloads |
| @prisma/client | 7.3.0 | Database client | Persist authenticated user's trainer config server-side with schema evolution |
| React Context API | Native | Shared state container | Toast notification system; theme context already in use |
| prisma-json-types-generator | 4.x | JSON field typing | Add type safety to Prisma JSON fields (recommended but optional; Zod validation is primary guard) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Hook Form 7.71.1 | Manual useState + useCallback | -70% boilerplate; RHF automatically deduplicates field updates, ~50 LOC vs ~200 for config form |
| localStorage + Zod | Custom localStorage wrapper without validation | Risk of corrupted state after schema changes; Zod catches breakages early |
| Prisma JSON field | Separate TrainerPreferences table | Simpler initially (no relations), but JSON sufficient for v1; can migrate later if preferences grow |
| Context API for toast | Sonner or React Toastify library | No external dependency; project already has custom components throughout |
| Tailwind peer for toggles | Controlled checkbox + state | Peer approach reduces re-renders; uncontrolled pattern fits form submission workflow |

**Installation:**

```bash
npm install react-hook-form
```

(Other dependencies already in project. Prisma JSON types generator is optional but recommended.)

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── trainer/
│   │   ├── layout.tsx               # Trainer section layout (wraps lobby and session pages)
│   │   ├── page.tsx                 # Lobby screen (config cards + start button)
│   │   ├── [sessionId]/
│   │   │   └── page.tsx             # Active session page (table + sidebar)
│   │   └── api/
│   │       └── config/
│   │           └── route.ts         # POST/GET trainer configuration endpoints
├── components/
│   ├── trainer/
│   │   ├── TrainerLobby.tsx         # Main lobby screen with config cards
│   │   ├── ConfigCard.tsx           # Reusable card wrapper for config sections
│   │   ├── ModeToggle.tsx           # Preflop/Flop toggle (lobby-only)
│   │   ├── GameSetup.tsx            # Game type, table size, stack depth selectors
│   │   ├── PositionFilters.tsx      # Position multi-select with presets
│   │   ├── PotTypeFilters.tsx       # Pot type multi-select
│   │   ├── DrillSuggestions.tsx     # Weak spot drill top 3
│   │   ├── SessionSidebar.tsx       # Mid-session overlay drawer
│   │   ├── SessionSummary.tsx       # End-of-session summary screen
│   │   └── SessionLayout.tsx        # Table + sidebar container
│   └── ui/
│       ├── Toast/
│       │   ├── ToastContainer.tsx   # Toast renderer
│       │   └── ToastProvider.tsx    # Context provider
│       └── ...
├── lib/
│   ├── v2/
│   │   ├── config/
│   │   │   ├── configSchema.ts      # Zod schema for trainer configuration
│   │   │   ├── configStore.ts       # localStorage helper with validation
│   │   │   ├── defaults.ts          # Default configuration values
│   │   │   └── userPreferences.ts   # Server API for user preferences
│   │   ├── hooks/
│   │   │   ├── useTrainerConfig.ts  # Custom hook for config state + persistence
│   │   │   ├── useSessionConfig.ts  # Hook for active session config state
│   │   │   ├── useToast.ts          # Toast notification hook
│   │   │   └── useSessionTarget.ts  # Hand count target state
│   │   └── ui/
│   │       ├── toastContext.ts      # Toast notification context definition
│   │       └── toastHelpers.ts      # Toast creation utilities
│   └── prisma/
│       └── userPreferences.ts       # Prisma user preferences type inference
└── server/
    ├── routes/
    │   └── config.routes.ts         # Express route handlers (backup for Next.js)
    └── services/
        └── configService.ts         # Shared config persistence logic
```

### Pattern 1: Configuration Form with React Hook Form + Zod

**What:** Centralized form state management with validation, using React Hook Form for efficient updates and Zod for schema-driven validation.

**When to use:** For the lobby configuration form that collects mode, game setup, position filters, pot type filters, and hand count target.

**Example:**

```typescript
// src/lib/v2/config/configSchema.ts
import { z } from 'zod';

export const TrainerConfigSchema = z.object({
  // Lobby-only (not changeable mid-session)
  mode: z.enum(['PREFLOP', 'FLOP']),
  gameType: z.enum(['CASH', 'HU']),
  tableSize: z.enum(['6max', '9max']),
  stackDepth: z.enum(['50bb', '100bb', '200bb']),

  // Changeable mid-session
  positions: z.array(z.string()).min(1, 'Select at least one position'),
  potTypes: z.array(z.string()).min(1, 'Select at least one pot type'),
  handCountTarget: z.number().min(1).max(1000).optional(),
});

export type TrainerConfig = z.infer<typeof TrainerConfigSchema>;
```

```typescript
// src/components/trainer/TrainerLobby.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TrainerConfigSchema, type TrainerConfig } from '@/lib/v2/config/configSchema';
import { loadConfigFromStorage, saveConfigToStorage } from '@/lib/v2/config/configStore';
import { useEffect } from 'react';

export default function TrainerLobby({
  onStartSession,
}: {
  onStartSession: (config: TrainerConfig) => Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
    reset,
  } = useForm<TrainerConfig>({
    resolver: zodResolver(TrainerConfigSchema),
    defaultValues: loadConfigFromStorage() ?? {
      mode: 'PREFLOP',
      gameType: 'CASH',
      tableSize: '6max',
      stackDepth: '100bb',
      positions: ['BB', 'SB'],
      potTypes: ['SRP'],
    },
  });

  // Save form state to localStorage on every change (debounced in useEffect)
  const formValues = watch();
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        saveConfigToStorage(formValues);
      } catch (e) {
        console.error('Failed to save config to localStorage:', e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formValues]);

  const onSubmit = async (config: TrainerConfig) => {
    await onStartSession(config);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Config cards using RHF Controller or register patterns */}
      {/* ... */}
      <button
        type="submit"
        disabled={isSubmitting || Object.keys(errors).length > 0}
        className="rounded bg-stone-900 px-6 py-3 font-semibold text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Starting...' : 'Start Training'}
      </button>
    </form>
  );
}
```

Source: [React Hook Form Getting Started](https://react-hook-form.com/get-started), [Zod Integration](https://react-hook-form.com/ts#Resolver)

### Pattern 2: localStorage Persistence with Zod Validation

**What:** Client-side persistence that survives page reloads and browser sessions, with schema validation to prevent corruption from schema changes.

**When to use:** To remember user's last configuration when they return to the lobby, and as fallback when server preferences haven't loaded yet.

**Example:**

```typescript
// src/lib/v2/config/configStore.ts
import { TrainerConfigSchema, type TrainerConfig } from './configSchema';

const STORAGE_KEY = 'trainer-config-v1'; // Version key for future migrations

export function loadConfigFromStorage(): TrainerConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    // Validate and fill in defaults from schema
    const validated = TrainerConfigSchema.safeParse(parsed);

    if (!validated.success) {
      console.warn('localStorage config validation failed, using defaults:', validated.error);
      // Log issues but don't crash; return null to use form defaults
      return null;
    }

    return validated.data;
  } catch (e) {
    console.error('Failed to load config from localStorage:', e);
    return null;
  }
}

export function saveConfigToStorage(config: TrainerConfig): void {
  try {
    const validated = TrainerConfigSchema.parse(config); // Will throw if invalid
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  } catch (e) {
    console.error('Failed to save config to localStorage:', e);
    // Don't throw; let app continue with current config
  }
}

export function clearConfigStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

Source: [Type-safe localStorage with Zod](https://medium.com/@michu2k/validate-data-in-browser-storage-with-zod-be254f465a40), [MDN localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

### Pattern 3: Multi-Select Toggle Chips with Tailwind CSS v4

**What:** Multi-select filter UI using toggle chips (position, pot type) with preset buttons, implemented with button state tracking and Tailwind utility classes.

**When to use:** For position selection (UTG, HJ, CO, BTN, SB, BB) and pot type selection (SRP, 3BP, 4BP) with minimum-one-selected constraint.

**Example:**

```typescript
// src/components/trainer/PositionFilters.tsx
'use client';

import { useState, useCallback } from 'react';

const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

const PRESETS = {
  'All Positions': POSITIONS,
  'Blinds Only': ['SB', 'BB'],
  'Late Position Only': ['CO', 'BTN', 'SB', 'BB'],
} as const;

export default function PositionFilters({
  value,
  onChange,
}: {
  value: string[];
  onChange: (positions: string[]) => void;
}) {
  const selectedSet = new Set(value);

  const handleToggle = useCallback(
    (position: string) => {
      const next = new Set(selectedSet);

      // Enforce minimum: at least one position must be selected
      if (selectedSet.has(position) && selectedSet.size === 1) {
        return; // Prevent deselecting the last position
      }

      next.has(position) ? next.delete(position) : next.add(position);
      onChange(Array.from(next));
    },
    [selectedSet, onChange]
  );

  const applyPreset = useCallback(
    (presetName: keyof typeof PRESETS) => {
      const preset = PRESETS[presetName];
      onChange(preset);
    },
    [onChange]
  );

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Positions</legend>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {Object.keys(PRESETS).map((presetName) => (
          <button
            key={presetName}
            type="button"
            onClick={() => applyPreset(presetName as keyof typeof PRESETS)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              PRESETS[presetName as keyof typeof PRESETS].every((p) => selectedSet.has(p))
                ? 'bg-blue-600 text-white'
                : 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50'
            }`}
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

Source: [Tailwind CSS v4 Styling](https://tailwindcss.com/docs), [Multi-Select with React and Tailwind](https://www.prudkohliad.com/articles/multi-select-dropdown-with-react-and-tailwind-4-2025-02-04)

### Pattern 4: Session Sidebar Overlay Drawer with Fixed Positioning

**What:** Left-side overlay drawer that slides over the table when opened from hamburger menu, maintained with fixed positioning and CSS transform animations.

**When to use:** For mid-session settings that must be accessible without interrupting gameplay, sliding over content rather than pushing it.

**Example:**

```typescript
// src/components/trainer/SessionSidebar.tsx
'use client';

import { useEffect, useRef } from 'react';
import type { TrainerConfig } from '@/lib/v2/config/configSchema';

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

  // Close on outside click (backdrop click)
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
      {/* Backdrop: fixed overlay with semi-transparent background */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar drawer: fixed positioning with transform slide animation */}
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 z-50 h-screen w-80 transform bg-white shadow-lg transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Session settings"
      >
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-lg font-semibold">Session Settings</h2>
            <button
              onClick={onClose}
              className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          {/* Locked settings indicator */}
          <fieldset disabled className="space-y-1 opacity-50">
            <legend className="text-xs font-medium text-stone-600">Locked (change on lobby)</legend>
            <div className="text-xs text-stone-500">
              Mode: {config.mode} | Game: {config.gameType} | Size: {config.tableSize} | Stack: {config.stackDepth}
            </div>
          </fieldset>

          {/* Changeable settings: Position filters, pot filters, hand target */}
          <div className="space-y-4">
            {/* Position filters component */}
            {/* Pot type filters component */}
            {/* Hand count target input */}
          </div>
        </div>
      </div>
    </>
  );
}
```

**Key design notes:**
- Use `fixed` positioning (not `absolute`) so drawer slides relative to viewport
- Use `transform -translate-x-full` (hidden) and `translate-x-0` (visible) for smooth animation
- Backdrop uses `z-40`, drawer uses `z-50` to maintain proper stacking order
- `duration-300` matches typical drawer speed (300ms is snappy but not jarring)
- Sidebar width `w-80` (320px) provides room for content without consuming entire screen

Source: [shadcn/ui Drawer](https://www.shadcn.io/ui/drawer), [Next.js + Tailwind Drawer Pattern](https://medium.com/designly/create-a-responsive-animated-sidebar-using-react-next-js-and-tailwind-css-bd5a0f42f103)

### Pattern 5: Toast Notification Context with React

**What:** Global toast notification system using React Context API to queue, display, and auto-dismiss notifications without external libraries.

**When to use:** For session notifications ("Filters updated on next hand", "Session ended", "Config saved"), maintaining one notification at a time or a small queue.

**Example:**

```typescript
// src/lib/ui/toastContext.ts
'use client';

import { createContext, useContext, useState, useCallback } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number; // ms; undefined = permanent
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
      const id = Math.random().toString(36).slice(2, 11);

      setToasts((prev) => [
        // Keep max 3 toasts visible
        ...(prev.length >= 3 ? prev.slice(1) : prev),
        { id, message, type, duration },
      ]);

      // Auto-dismiss after duration
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
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
```

```typescript
// src/components/ui/Toast/ToastContainer.tsx
'use client';

import { useToast } from '@/lib/ui/toastContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      className="fixed bottom-4 right-4 z-50 space-y-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`max-w-sm rounded-lg p-4 text-sm font-medium shadow-lg animate-in fade-in-0 slide-in-from-bottom-4 ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : toast.type === 'error'
                ? 'bg-red-600 text-white'
                : toast.type === 'warning'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-stone-800 text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 text-lg opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Source: [React Context + Hooks Pattern](https://react.dev/reference/react/createContext), [Toast Best Practices 2026](https://medium.com/@ksathyareddy7/creating-a-toast-notification-system-in-react-a-step-by-step-guide-9b76b182d336)

### Anti-Patterns to Avoid

- **Lifting config state too high:** Don't manage all configuration at the root layout level with Context; keep local to the trainer page or session page. Lifting only what's shared (auth, theme).
- **Over-persisting to localStorage:** Don't write on every keystroke; debounce to 500ms intervals or save on form submission only.
- **Controlled inputs for all filter states:** Avoid managing 50 individual checkbox states in React; use Set/Array with callbacks, letting button onClick update parent state.
- **No minimum selection enforcement:** Must prevent empty filter states at component level (button disabled) AND server-side validation; don't rely on UX alone.
- **Stale localStorage after schema changes:** Always validate deserialized data with Zod; provide defaults for new fields; consider versioning localStorage keys.
- **Sidebar state separate from session state:** Don't keep sidebar config local; pass through props or Context so sidebar updates feed back to session.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state + validation | Custom useState + validation handlers | React Hook Form + Zod | RHF minimizes re-renders, deduplicates field updates, integrates with schema validation. ~50 LOC with RHF vs ~250 LOC manual |
| localStorage safety | Custom JSON serialize/deserialize | Zod validation on load | Zod catches corrupted or stale data; provides defaults for new fields; enables schema versioning |
| Toast notifications | DOM mutation + setTimeout cleanup | Context API + hook | Context prevents duplicate toasts, handles queuing and auto-dismiss, maintains accessibility |
| Drawer animation | Manual state + CSS transitions | Tailwind transform + fixed positioning | Tailwind provides smooth transitions; fixed/absolute positioning is sufficient; no JS animation library needed |
| Preset button logic | Manual if-else for each preset | Data-driven object (PRESETS = {...}) | Easier to add presets, type-safe, clearer intent |
| Filter constraint validation | Conditional button disabling only | Prevent invalid state from creation | Early guard prevents invalid state; Set-based tracking clearer than array methods |
| JSON preferences in Prisma | Untyped JSON fields | prisma-json-types-generator + Zod | Type-safe JSON ensures autocomplete; Zod validation is runtime guard |

**Key insight:** Configuration forms are where form state complexity concentrates. Use React Hook Form to separate form state (values, errors, submission) from UI rendering, and validate early (Zod at form level, Zod at API level) to prevent invalid states from propagating.

## Common Pitfalls

### Pitfall 1: No Minimum Filter Selection Validation

**What goes wrong:** User deselects all positions and clicks "Start Training", creating a session with empty position array. API accepts it (or rejects silently), user sees no error message.

**Why it happens:** Minimum selection constraints are not enforced at component level. No early-return guard in toggle handler.

**How to avoid:**
1. Track selected positions/pot types as Set internally
2. In toggle handler, check `if (set.has(item) && set.size === 1) return;` to prevent last item deselect
3. Disable "Start Training" button if validations fail: `disabled={config.positions.length === 0}`
4. Show inline error message when button is disabled
5. Validate server-side as well (Zod parse will reject)

**Warning signs:**
- User can click "Start Training" with no visible selections
- Form submission with empty filter arrays succeeds
- No error message in UI after clicking Start

**Example prevention:**
```typescript
// Component-level constraint
const handleToggle = (position: string) => {
  if (selectedSet.has(position) && selectedSet.size === 1) {
    return; // Prevent emptying the set
  }
  // ... toggle logic
};

// Button-level validation
<button
  disabled={selectedPositions.length === 0 || selectedPotTypes.length === 0}
  className="..."
>
  {selectedPositions.length === 0 && <span className="text-red-600">Select at least one position</span>}
  Start Training
</button>

// API-level validation (Zod)
const configSchema = z.object({
  positions: z.array(z.string()).min(1, 'Select at least one position'),
  potTypes: z.array(z.string()).min(1, 'Select at least one pot type'),
});
```

### Pitfall 2: Stale localStorage Data After Schema Changes

**What goes wrong:** Developer adds a new config field (e.g., `handCountTarget`). Old localStorage still has v0 schema. App loads old config, Zod validation fails silently, user gets defaults. Or app crashes trying to access new field.

**Why it happens:** localStorage is unversioned. No validation on deserialization. Schema evolution not planned.

**How to avoid:**
1. Always validate localStorage data with Zod schema on load
2. Provide `.optional()` defaults in schema for new fields
3. Version localStorage key: `trainer-config-v1`, `trainer-config-v2`, etc.
4. Write migration function if changing required fields to optional or vice versa
5. Log validation errors (don't silent-fail)

**Warning signs:**
- Config loading fails silently (no error logged)
- New config fields are always undefined
- Old localStorage data breaks new features

**Example:**
```typescript
// Version the key
const STORAGE_KEY = 'trainer-config-v1';

// Schema provides defaults
const configSchema = z.object({
  mode: z.enum(['PREFLOP', 'FLOP']),
  positions: z.array(z.string()).min(1),
  potTypes: z.array(z.string()).min(1),
  handCountTarget: z.number().optional(), // New field; won't crash if missing
});

// Validate on load
function loadConfigFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const result = configSchema.safeParse(JSON.parse(raw));
  if (!result.success) {
    console.warn('Config validation failed:', result.error);
    return null; // Return null, let form use defaults
  }
  return result.data;
}
```

### Pitfall 3: Losing Filter Changes When Navigating Away

**What goes wrong:** User adjusts position filters on lobby, accidentally navigates away or closes browser, returns. Lobby is reset to defaults. User had to re-select filters.

**Why it happens:** Lobby form state is component-local, not persisted. Only the final submitted config is saved to session.

**How to avoid:**
1. Save in-progress form state to localStorage on every change (debounced 500ms)
2. Load from localStorage on form mount
3. Distinguish "last used config" (lobby editing state) from "active session config" (submitted config)
4. Use React Hook Form's `watch()` to subscribe to form changes

**Warning signs:**
- Filters reset when navigating away from lobby
- No indication that config was saved
- Users report frustration with re-entering filters

**Example:**
```typescript
const { watch, reset } = useForm<TrainerConfig>({
  defaultValues: loadConfigFromStorage() ?? DEFAULT_CONFIG,
});

const formValues = watch();
useEffect(() => {
  const timer = setTimeout(() => {
    saveConfigToStorage(formValues); // Debounced
  }, 500);
  return () => clearTimeout(timer);
}, [formValues]);
```

### Pitfall 4: Sidebar Config Not Reflecting in Table

**What goes wrong:** User changes position filters in sidebar mid-session. Sidebar shows new selection, but table continues showing old spots. User thinks filters are applied but they're not.

**Why it happens:** Sidebar state is isolated from session state. Table doesn't subscribe to sidebar changes. Or changes are local-only, not synced to session record.

**How to avoid:**
1. Pass `onConfigChange` callback from session page (not sidebar)
2. Session page owns the true session config state
3. Sidebar receives config and onChange callback as props; updates feed back to parent
4. Table component subscribes to session config via props or context
5. Show toast when filter changes take effect: "Filters applied on next hand"

**Warning signs:**
- User changes sidebar settings, table behavior unchanged
- No confirmation toast after sidebar change
- Sidebar and table have inconsistent config

### Pitfall 5: JSON Field Type Safety Without Runtime Validation

**What goes wrong:** You add `trainerPreferences: Json` to Prisma User model. TypeScript says it's `JsonValue` (untyped). Code reads `user.trainerPreferences.handCountTarget` and TypeScript allows it (because it's `any`). At runtime, it's undefined because schema changed and DB still has old data.

**Why it happens:** Prisma's Json fields are untyped by default. prisma-json-types-generator adds type safety but not runtime validation.

**How to avoid:**
1. Install prisma-json-types-generator (optional but recommended)
2. Define Zod schema as source of truth
3. Validate JSON data on read and write
4. Don't trust the database schema; validate at API boundaries

**Example:**
```typescript
// src/lib/prisma/userPreferences.ts
import { z } from 'zod';

const UserPreferencesSchema = z.object({
  trainerConfig: z.object({
    mode: z.enum(['PREFLOP', 'FLOP']),
    positions: z.array(z.string()),
    potTypes: z.array(z.string()),
  }).optional(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// Read: validate on fetch
export async function getUserPreferences(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const result = UserPreferencesSchema.safeParse(user?.trainerPreferences ?? {});
  return result.success ? result.data : null;
}

// Write: validate before save
export async function saveUserPreferences(userId: string, prefs: UserPreferences) {
  const validated = UserPreferencesSchema.parse(prefs);
  return prisma.user.update({
    where: { id: userId },
    data: { trainerPreferences: validated },
  });
}
```

### Pitfall 6: Forgetting to Close Sidebar on Mobile/Narrow Screens

**What goes wrong:** User opens sidebar on mobile, it covers the table completely. User has to manually close it to see anything. Or sidebar slides behind table instead of on top.

**Why it happens:** Z-index not set high enough, or fixed positioning isn't relative to viewport.

**How to avoid:**
1. Ensure sidebar uses `fixed` positioning (relative to viewport, not parent)
2. Set z-index on sidebar higher than content: `z-50` for sidebar, `z-40` for backdrop
3. Add close button clearly visible
4. On mobile, consider a close button in the top-right always visible
5. Test on narrow screens and mobile breakpoints

**Example:**
```typescript
<div className="fixed left-0 top-0 z-50 h-screen w-80 ...">
  {/* Close button always visible */}
  <button className="absolute top-4 right-4 z-51">✕</button>
</div>
```

## Code Examples

### Complete Lobby Configuration Form

```typescript
// src/components/trainer/TrainerLobby.tsx
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { TrainerConfigSchema, type TrainerConfig } from '@/lib/v2/config/configSchema';
import { loadConfigFromStorage, saveConfigToStorage } from '@/lib/v2/config/configStore';
import ConfigCard from './ConfigCard';
import ModeToggle from './ModeToggle';
import GameSetup from './GameSetup';
import PositionFilters from './PositionFilters';
import PotTypeFilters from './PotTypeFilters';
import { useToast } from '@/lib/ui/toastContext';
import { useEffect } from 'react';

export default function TrainerLobby() {
  const router = useRouter();
  const { showToast } = useToast();

  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<TrainerConfig>({
    resolver: zodResolver(TrainerConfigSchema),
    defaultValues: loadConfigFromStorage() ?? {
      mode: 'PREFLOP',
      gameType: 'CASH',
      tableSize: '6max',
      stackDepth: '100bb',
      positions: ['BB', 'SB'],
      potTypes: ['SRP'],
    },
  });

  // Debounced localStorage save
  const formValues = watch();
  useEffect(() => {
    const timer = setTimeout(() => {
      saveConfigToStorage(formValues);
    }, 500);
    return () => clearTimeout(timer);
  }, [formValues]);

  const onSubmit = async (config: TrainerConfig) => {
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const error = await res.json();
        showToast(error.error?.message ?? 'Failed to start session', 'error');
        return;
      }

      const { sessionId } = await res.json();
      showToast('Session started', 'success', 2000);
      router.push(`/trainer/${sessionId}`);
    } catch (error) {
      console.error('Failed to start session:', error);
      showToast('Failed to start session', 'error');
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-semibold">Trainer Configuration</h1>
        <p className="text-stone-600">Customize your training session</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Essentials card */}
        <ConfigCard title="Essentials" subtitle="Mode and Game Setup">
          <div className="space-y-4">
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <ModeToggle
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.mode?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="gameType"
              render={({ field }) => (
                <GameSetup
                  gameType={field.value}
                  tableSize={watch('tableSize')}
                  stackDepth={watch('stackDepth')}
                  onGameTypeChange={field.onChange}
                  onTableSizeChange={(size) => {
                    // Use setValue via form context
                  }}
                  onStackDepthChange={(depth) => {
                    // Use setValue via form context
                  }}
                  errors={errors}
                />
              )}
            />
          </div>
        </ConfigCard>

        {/* Advanced filters (collapsible) */}
        <details className="group">
          <summary className="cursor-pointer text-lg font-semibold">
            Advanced Filters{' '}
            <span className="group-open:hidden">▶</span>
            <span className="hidden group-open:inline">▼</span>
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ConfigCard title="Positions">
              <Controller
                control={control}
                name="positions"
                render={({ field }) => (
                  <PositionFilters
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.positions?.message}
                  />
                )}
              />
            </ConfigCard>

            <ConfigCard title="Pot Types">
              <Controller
                control={control}
                name="potTypes"
                render={({ field }) => (
                  <PotTypeFilters
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.potTypes?.message}
                  />
                )}
              />
            </ConfigCard>
          </div>
        </details>

        {/* Submit section */}
        <div className="flex items-center justify-between pt-4">
          {hasErrors && (
            <div className="text-sm text-red-600">
              {errors.positions?.message ||
                errors.potTypes?.message ||
                'Please fix errors above'}
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting || hasErrors}
            className="rounded bg-stone-900 px-6 py-3 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Starting...' : 'Start Training'}
          </button>
        </div>
      </form>
    </main>
  );
}
```

Source: [React Hook Form Examples](https://react-hook-form.com/form-builder), [Zod Error Handling](https://zod.dev/?id=error-handling)

### Next.js API Route for Config Persistence

```typescript
// src/app/api/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/requireAuth';
import { TrainerConfigSchema } from '@/lib/v2/config/configSchema';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/config
 * Retrieve authenticated user's trainer configuration preferences
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    const userPrefs = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { trainerPreferences: true },
    });

    // Validate stored preferences
    if (!userPrefs?.trainerPreferences) {
      return NextResponse.json({ config: null });
    }

    const validated = TrainerConfigSchema.safeParse(userPrefs.trainerPreferences);
    if (!validated.success) {
      console.warn('Stored config validation failed:', validated.error);
      return NextResponse.json({ config: null });
    }

    return NextResponse.json({ config: validated.data });
  } catch (error) {
    console.error('Failed to fetch config:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch config' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config
 * Save authenticated user's trainer configuration preferences
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    const body = await req.json();

    // Validate request body
    const validated = TrainerConfigSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_ARGUMENT',
            message: 'Invalid configuration',
            details: validated.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Save to database
    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: { trainerPreferences: validated.data },
      select: { trainerPreferences: true },
    });

    return NextResponse.json({ config: updated.trainerPreferences });
  } catch (error) {
    console.error('Failed to save config:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save config' } },
      { status: 500 }
    );
  }
}
```

Source: [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Prisma with Next.js](https://www.prisma.io/docs/guides/nextjs)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual form state (10+ useState calls) | React Hook Form + Zod | 2020+ (RHF v5) | Reduced boilerplate ~70%, improved performance via selective field subscriptions |
| window.localStorage directly | Custom hook wrapper with Zod validation | 2022+ | Safe deserialization, schema evolution, easier testing and migration |
| Global Redux for all state | Hybrid: Context for theme/auth, localStorage for persistence, DB for user prefs | 2023+ | Simpler mental model, fewer re-renders, clearer data ownership |
| Styled components / CSS-in-JS | Tailwind CSS utility classes | 2021+ | Faster builds, smaller CSS bundles, easier responsive design |
| Class components | Functional components with hooks | 2019+ | Clearer logic flow, better code sharing (custom hooks), smaller bundles |
| Untyped JSON fields in Prisma | JSON + Zod validation + optional prisma-json-types-generator | 2024+ | Type safety at compile time (generator) and runtime (Zod) |

**Deprecated/outdated:**
- Redux for configuration state: Too much ceremony for stable, infrequent updates. Context + custom hooks sufficient.
- MobX: Reactive tracking less predictable; TypeScript integration weaker than simpler alternatives.
- Formik: Replaced by React Hook Form for better performance and smaller bundle.
- Controlled checkboxes for large filter lists: Performance penalty. Use uncontrolled with form submission or Set-based state tracking.
- Separate drill builder UI: Custom drill is just enhanced filters; no separate component needed.

## Open Questions

1. **Exact preset definitions for position filters**
   - What we know: CONTEXT.md specifies "Quick presets above position toggles: All Positions, Blinds Only, Late Position Only"
   - What's unclear: Does "Late Position Only" include HJ? How do players define late position?
   - Recommendation: Research existing trainer UIs and poker terminology. Recommend: All = [UTG,HJ,CO,BTN,SB,BB], Blinds = [SB,BB], Late = [HJ,CO,BTN,SB,BB] (includes HJ as common late position). Planner makes final call.

2. **Minimum hand threshold for drill suggestions**
   - What we know: CONTEXT.md specifies "minimum data threshold required before drill suggestions appear"
   - What's unclear: How many hands total? How many in a specific spot? Proportional or fixed?
   - Recommendation: Propose 50+ hands total before showing drills, or 5+ hands in a specific spot combo. Phase 8 (stats) will have exact metrics. Phase 6 can use a conservative threshold.

3. **Hand count target options**
   - What we know: CONTEXT.md says "optional configurable hand count target in settings"
   - What's unclear: Dropdown with presets (25, 50, 100, 250) or freeform number input? Both?
   - Recommendation: Start with dropdown [25, 50, 100, 250] + "Unlimited" option. Custom input can be added later. Limits: 1-1000 hands.

4. **Database schema for Prisma User preferences**
   - What we know: User model exists; no dedicated preferences model yet
   - What's unclear: Store trainer config as JSON in User.trainerPreferences, or separate TrainerPreferences table with relation?
   - Recommendation: Add optional `trainerPreferences: Json` field to User model (simpler, avoids table bloat). If preferences grow (saved presets, drill favorites, etc.), migrate to separate table in Phase 9.

5. **How to integrate stats page "Drill This" buttons before Phase 8**
   - What we know: CONTEXT.md defers stats page integration to Phase 8
   - What's unclear: Should Phase 6 include placeholder or full integration?
   - Recommendation: Phase 6 builds drill suggestion cards on lobby (receives hardcoded or mock data). Phase 8 creates stats page with "Drill This" buttons that pre-fill lobby filters. No blocker; Phase 6 is complete without stats integration.

6. **Sidebar animation and backdrop opacity preferences**
   - What we know: Sidebar overlays table with backdrop dim, 300ms transition
   - What's unclear: Exact backdrop opacity (25%? 30%? 50%?)
   - Recommendation: Tailwind default `bg-black/30` (30% opacity) balances dimming visibility and table readability. Test and adjust if needed.

## Sources

### Primary (HIGH confidence)

- **React 19.2.4 Documentation** - Official hooks and state management
  - [React Hooks API Reference](https://react.dev/reference/react/hooks)
  - [React Context API](https://react.dev/reference/react/createContext)
  - [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)

- **React Hook Form 7.71.1 Documentation** - Form state management and validation
  - [Getting Started](https://react-hook-form.com/get-started)
  - [API Documentation](https://react-hook-form.com/api)
  - [Zod Integration](https://react-hook-form.com/ts#Resolver)

- **Zod 4.3.6 Documentation** - Runtime schema validation
  - [Official Documentation](https://zod.dev/)
  - [Error Handling](https://zod.dev/?id=error-handling)

- **Tailwind CSS v4 Documentation** - Utility CSS and animations
  - [Z-Index Reference](https://tailwindcss.com/docs/z-index)
  - [Transform Animations](https://tailwindcss.com/docs/transform)
  - [Duration and Timing](https://tailwindcss.com/docs/transition-duration)

- **Prisma 7.3.0 Documentation** - Database ORM and JSON fields
  - [JSON Field Handling](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields)
  - [Next.js Integration](https://www.prisma.io/docs/guides/nextjs)

- **Next.js 16.1.6 Documentation** - Full-stack framework
  - [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
  - [Form Handling](https://nextjs.org/docs/pages/guides/forms)

- **MDN Web APIs** - Browser APIs and standards
  - [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

### Secondary (MEDIUM confidence)

- **WebSearch verified with official sources:**
  - [React 19 State Management 2026](https://thelinuxcode.com/state-management-in-react-2026-hooks-context-api-and-redux-in-practice/) - Verified with official React docs
  - [React Hook Form 7.71.1 Release Notes](https://github.com/react-hook-form/react-hook-form/releases) - Official GitHub releases
  - [Tailwind CSS v4 Multi-Select Components](https://www.prudkohliad.com/articles/multi-select-dropdown-with-react-and-tailwind-4-2025-02-04) - Recent article with verified patterns
  - [Next.js 16 Route Handlers](https://strapi.io/blog/nextjs-16-route-handlers-explained-3-advanced-usecases) - Verified with official Next.js docs
  - [Prisma 7 JSON Field Typing](https://www.wking.dev/library/a-backwards-compatible-type-safe-system-for-json-fields-in-prisma) - Verified with official Prisma docs

- **Toast Notification Patterns:**
  - [React Context Toast Notifications 2026](https://medium.com/@ksathyareddy7/creating-a-toast-notification-system-in-react-a-step-by-step-guide-9b76b182d336) - Best practices guide
  - [Flowbite Toast Components](https://flowbite.com/docs/components/toast/) - UI reference

- **localStorage Persistence:**
  - [Type-Safe localStorage with Zod](https://medium.com/@michu2k/validate-data-in-browser-storage-with-zod-be254f465a40) - Pattern guide
  - [React Persist Patterns](https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/) - Best practices

### Tertiary (LOW confidence - WebSearch only, marked for validation)

- [Tailwind Material Chip Component](https://www.material-tailwind.com/docs/html/chip) - External library example; project doesn't use Material Tailwind
- [shadcn/ui Drawer](https://www.shadcn.io/ui/drawer) - Third-party component; project builds custom components
- [React Navigation Drawer](https://reactnavigation.org/docs/drawer-navigator/) - React Native specific; not applicable to Next.js web

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| React 19 state patterns | HIGH | Official React documentation and 2026 ecosystem articles |
| React Hook Form 7.71 + Zod integration | HIGH | Official documentation, GitHub releases, matches project stack exactly |
| Tailwind CSS v4 component patterns | HIGH | Official Tailwind docs, recent 2025-2026 articles, peer-verified implementations |
| Next.js 16 Route Handlers and API design | HIGH | Official Next.js documentation, guides updated Feb 2026 |
| localStorage + Zod validation patterns | HIGH | Official MDN, official Zod docs, verified best practices |
| Prisma 7 JSON field typing and validation | HIGH | Official Prisma documentation, prisma-json-types-generator guidance |
| Toast notification context patterns | MEDIUM | Multiple guides confirm approach; implementation details left to project |
| Database schema design (User.trainerPreferences) | MEDIUM | Follows Prisma patterns; specific schema deferred to planner |
| Minimum hand threshold for drill suggestions | LOW | Deferred to Phase 8 (statistics) which has actual metrics |
| Animation timing and opacity specifics | LOW | Deferred to planner; Tailwind defaults are reasonable starting points |

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days; stable domain, library updates possible but unlikely to affect patterns)

---

*Phase: 06-trainer-configuration*
*Research completed: 2026-02-17*
