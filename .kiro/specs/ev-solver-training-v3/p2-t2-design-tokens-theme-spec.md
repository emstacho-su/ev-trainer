# P2.T2 Design Tokens and Theme System Spec

Date: 2026-02-04
Task: P2.T2
Spec: `ev-solver-training-v3`

## 1. Objective
Define an original, reusable light/dark theme system with EV-first semantic tokens, centralized token ownership, and deterministic theme behavior.

## 2. Token Taxonomy
- Global/Base tokens: primitive values for color, spacing, radius, typography, elevation, and focus.
- Semantic tokens: intent-driven aliases used by surfaces and states (text, border, alert, EV).
- Component tokens: optional per-component aliases derived from semantic tokens (introduced only when reuse is proven).

## 3. Naming Grammar
- Format: `--<category>-<name>-<variant?>`
- Examples:
  - `--color-text-primary`
  - `--space-4`
  - `--radius-lg`
  - `--shadow-2`
- Rules:
  - MUST use lowercase kebab-case.
  - MUST encode intent over hue (`ev-positive`, not `green-500`).
  - MUST avoid proprietary naming.

## 4. Canonical Token Source
- Authoritative file: `src/app/globals.css`
- Theme selectors:
  - system baseline via `@media (prefers-color-scheme: dark)`
  - manual overrides via `html[data-theme="light"]` and `html[data-theme="dark"]`
- No duplicate token definitions outside this file.

## 5. Token Catalog

### 5.1 Color Tokens (24)
| Token | Light Value | Dark Value | Purpose | Usage Example |
|---|---|---|---|---|
| `--color-bg` | `#f4f3ef` | `#121416` | app background | `body` background |
| `--color-surface-1` | `#ffffff` | `#1a1d22` | primary surface | card containers |
| `--color-surface-2` | `#f8f6f2` | `#20242b` | muted surface | list row backgrounds |
| `--color-surface-3` | `#ece8de` | `#2c3139` | elevated muted surface | secondary panels |
| `--color-text-primary` | `#1a1b1e` | `#edf1f6` | main text | headings/body text |
| `--color-text-secondary` | `#4a4f56` | `#b4beca` | secondary text | helper labels |
| `--color-text-inverse` | `#ffffff` | `#0c1117` | text on strong actions | primary button text |
| `--color-border-subtle` | `#d7d2c8` | `#39414d` | standard border | cards/inputs |
| `--color-border-strong` | `#9a9387` | `#586373` | emphasized border | secondary buttons |
| `--color-focus-ring` | `#1b79ff` | `#7fb2ff` | keyboard focus outline | `:focus-visible` |
| `--color-action-primary` | `#1f2937` | `#e2e8f0` | primary CTA surface | submit buttons |
| `--color-action-primary-hover` | `#111827` | `#f8fafc` | primary CTA hover | hover state |
| `--color-action-secondary` | `#ffffff` | `#20242b` | secondary CTA surface | neutral buttons |
| `--color-action-secondary-hover` | `#f3efe8` | `#2b3038` | secondary CTA hover | hover state |
| `--color-ev-positive` | `#0f766e` | `#5eead4` | positive EV semantics | best-action emphasis |
| `--color-ev-neutral` | `#a16207` | `#fcd34d` | near-neutral EV semantics | average EV badge |
| `--color-ev-negative` | `#b91c1c` | `#fca5a5` | negative EV semantics | leak severity text |
| `--color-ev-accent` | `#334155` | `#93c5fd` | EV contextual accent | EV metadata labels |
| `--color-alert-error-bg` | `#fef2f2` | `#3b1212` | error background | error alerts |
| `--color-alert-error-border` | `#fca5a5` | `#7f1d1d` | error border | error alerts |
| `--color-alert-error-text` | `#991b1b` | `#fecaca` | error text | error alerts |
| `--color-alert-warning-bg` | `#fffbeb` | `#3d2b12` | warning background | warning alerts |
| `--color-alert-warning-border` | `#fcd34d` | `#7c4a03` | warning border | warning alerts |
| `--color-alert-warning-text` | `#92400e` | `#fde68a` | warning text | warning alerts |

### 5.2 Spacing Tokens (8)
| Token | Value | Purpose | Usage Example |
|---|---|---|---|
| `--space-1` | `0.25rem` | micro spacing | icon/text gap |
| `--space-2` | `0.5rem` | tight spacing | button vertical padding |
| `--space-3` | `0.75rem` | compact spacing | small card padding |
| `--space-4` | `1rem` | base spacing | standard component padding |
| `--space-5` | `1.25rem` | medium spacing | section spacing |
| `--space-6` | `1.5rem` | large spacing | card padding |
| `--space-8` | `2rem` | x-large spacing | page section gaps |
| `--space-10` | `2.5rem` | layout spacing | large container offsets |

### 5.3 Radius Tokens (4)
| Token | Value | Purpose | Usage Example |
|---|---|---|---|
| `--radius-sm` | `0.375rem` | small rounding | badges |
| `--radius-md` | `0.5rem` | default rounding | buttons |
| `--radius-lg` | `0.75rem` | card rounding | panels |
| `--radius-xl` | `1rem` | large surface rounding | hero containers |

### 5.4 Typography Tokens (5)
| Token | Value | Purpose | Usage Example |
|---|---|---|---|
| `--font-size-xs` | `0.75rem` | metadata text | labels |
| `--font-size-sm` | `0.875rem` | small UI text | button labels |
| `--font-size-md` | `1rem` | body text | paragraphs |
| `--font-size-lg` | `1.125rem` | section title | card titles |
| `--font-size-xl` | `1.5rem` | page title | h1 displays |

### 5.5 Elevation Tokens (2)
| Token | Value | Purpose | Usage Example |
|---|---|---|---|
| `--shadow-1` | `0 1px 2px rgb(0 0 0 / 0.06)` | subtle depth | cards |
| `--shadow-2` | `0 8px 24px rgb(15 23 42 / 0.08)` | elevated depth | overlay surfaces |

### 5.6 Focus Tokens (3)
| Token | Value | Purpose | Usage Example |
|---|---|---|---|
| `--focus-ring-width` | `2px` | focus thickness | `:focus-visible` |
| `--color-focus-ring` | theme value | focus color | keyboard navigation |
| `--radius-md` | `0.5rem` | rounded focus edge alignment | buttons/inputs |

## 6. Tailwind Bridge
- File: `tailwind.config.js`
- Mapped categories:
  - `theme.extend.colors` -> CSS variable color tokens
  - `theme.extend.spacing` -> spacing tokens
  - `theme.extend.borderRadius` -> radius tokens
  - `theme.extend.boxShadow` -> elevation tokens
  - `theme.extend.fontSize` -> typography tokens
- Dark mode selector strategy: `darkMode: ["selector", "[data-theme="dark"]"]`

## 7. Theme Mode Strategy
- Storage key: `ev-theme-mode`
- Modes: `system | light | dark`
- Pre-first-paint behavior:
  - inline script in `src/app/layout.tsx` reads storage and sets `data-theme` before app hydration
- Runtime behavior:
  - `ThemeModeToggle` cycles modes deterministically: `system -> light -> dark -> system`
  - mode persists in `localStorage`

## 8. Surface Usage Guide
Representative mappings:
- Setup surface (`src/app/setup/[mode]/page.tsx`): `app-page`, `alert-error`, `link-subtle`
- Session surface (`src/app/session/[id]/page.tsx`): `app-page`, `alert-error`, `alert-warning`, `btn-secondary`
- Summary surface (`src/app/summary/[id]/page.tsx` + `src/components/SummaryStatsCards.tsx`): `app-page`, `btn-primary`, `surface-card`, `ev-neutral`
- Review surface (`src/app/review/[id]/page.tsx`): `app-page`, `surface-card`, alert classes
- Home surface (`src/app/page.tsx` + `src/components/ModeEntryCard.tsx` + `src/components/RecentSessionsList.tsx`): `surface-card`, `text-muted`, semantic button classes

Do:
- Use semantic classes/tokens for all new component colors and spacing.
- Prefer intent tokens (`ev-negative`) over hue tokens.

Do not:
- Add raw hex colors in component/page files.
- Add duplicate token constants outside `globals.css`.

## 9. Accessibility Constraints
- Contrast targets:
  - normal text >= 4.5:1
  - non-text UI/focus >= 3:1
- Focus visibility:
  - minimum 2px perimeter-equivalent outline via `:focus-visible`
- Keyboard support expectations stay aligned with APG interaction guidance.

## 10. Implementation Plan
1. Centralize tokens in `globals.css`.
2. Add Tailwind bridge mappings in `tailwind.config.js`.
3. Add deterministic theme mode utilities + toggle component.
4. Migrate representative surfaces to semantic token classes.
5. Run gates and verify no new raw hex in component/page code.

## 11. Migration Note
Existing `stone-*`, `red-*`, and `amber-*` classes are migrated incrementally.
Priority order:
1. Shared components used by setup/session/summary/review/train.
2. Remaining page-local status/feedback blocks.
3. Lower-priority preview and legacy helper surfaces.
