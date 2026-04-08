# Phase 12: Dashboard & Training Config Popout — Research

**Confidence:** HIGH
**Researched:** 2026-02-17

## Summary

Phase 12 transforms the lobby into a dashboard hub at `/` and moves training config into a GTO-Wizard-style centered popout dialog overlaying the poker table at `/training`. No new dependencies needed — uses native `<dialog>` element matching the existing RangeGridModal pattern.

## Key Findings

### 1. Current Architecture

**Routing:**
- `src/app/page.tsx` — redirects to `/lobby`
- `src/app/lobby/page.tsx` — renders `<TrainerLobby />`
- `src/app/session/[id]/page.tsx` — full training loop (start/submit/next, PokerTable, ActionPanel)
- `src/components/training/PreflopTrainingSession.tsx` — standalone preflop training component (separate from session page)

**TrainerLobby** (`src/components/config/TrainerLobby.tsx`):
- Config form: ModeToggle, GameSetup, PositionFilters, PotTypeFilters
- DrillSuggestions component
- `handleStartTraining()` calls `/api/session/start`, then `router.push()` to session page
- Uses `useTrainerConfig` hook for localStorage persistence

**Session page** (`src/app/session/[id]/page.tsx`):
- Full training loop: load session, submit action, next hand, keyboard shortcuts
- Renders PokerTable + ActionPanel + info bar
- Range modal support (RangeGridModal)
- SessionSidebar for mid-session config changes

### 2. Dialog Pattern (RangeGridModal)

The codebase already uses native `<dialog>` in `src/components/range/RangeGridModal.tsx`:
- `useRef<HTMLDialogElement>` + `showModal()`/`close()`
- `useEffect` syncs `isOpen` prop to imperative API
- Backdrop click handler: `e.target === dialogRef.current`
- Native close event listener for ESC key
- CSS: `backdrop:bg-black/60` for semi-transparent backdrop
- WCAG 2.1 compliant: built-in focus trap, ESC close

### 3. Files Referencing `/lobby` (need updates)

| File | Reference | New Target |
|------|-----------|------------|
| `src/app/page.tsx` | `redirect("/lobby")` | Becomes dashboard (no redirect) |
| `src/components/AppHeader.tsx` | nav link `/lobby` label "Lobby" | `/` label "Dashboard", add `/training` |
| `src/app/session/[id]/page.tsx` | `<Link href="/lobby">`, `router.push("/lobby")` | `/` |
| `src/app/summary/[id]/page.tsx` | `<Link href="/lobby">` (x2) | `/` |
| `src/app/stats/page.tsx` | `<Link href="/lobby">` | `/` |
| `src/app/stats/components/WeaknessBreakdown.tsx` | `router.push('/lobby?...')` | `/training?...` |
| `src/app/signup/page.tsx` | `router.push('/lobby')` | `/` |
| `src/app/login/page.tsx` | redirect default `/lobby` | `/` |
| `src/app/review/[id]/page.tsx` | `<Link href="/lobby">` | `/` |

### 4. Design Decisions

- **Native `<dialog>`** for config popout (matches RangeGridModal, zero dependencies)
- **Client-side dialog state** (no intercepting routes needed)
- **No new dependencies** required
- **Extract training loop** from session page into reusable hook or inline in training page
- **Preflop only** on `/training` page this phase; postflop stays at `/postflop-training`
- **`/lobby` backward compat**: change to redirect to `/`
- **AppHeader**: hide on `/training` when session is active (like `/session/`)

### 5. Component Architecture

```
/training page
├── PokerTable (background, always rendered)
├── ActionPanel (bottom, shown during active session)
├── Info bar (top, shown during active session)
├── TrainingConfigDialog (<dialog> popout)
│   ├── ModeToggle
│   ├── GameSetup
│   ├── PositionFilters / PotTypeFilters (collapsible)
│   └── Start Training button
└── RangeGridModal (existing, shown after reveal)

/ dashboard page
├── Training card → links to /training
├── DrillSuggestions
└── Quick stats summary (optional)
```

### 6. Training Page State Machine

```
CONFIGURING → TRAINING → CONFIGURING (reopen)
                ↓
            (session complete → summary redirect)
```

- Page loads → config dialog auto-opens
- User clicks "Start Training" → dialog closes, session begins
- Gear icon → reopen dialog with session-level fields locked
- Session complete → redirect to /summary/[id]

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large training loop extraction | Keep session page working; training page gets its own loop |
| Dialog z-index conflicts | Follow existing z-index layering (table < seats < dealer < center < dialog) |
| Mobile layout | Config dialog uses `max-w-lg w-[95vw]` responsive pattern |

## RESEARCH COMPLETE
