# Stack Research

**Domain:** GTO Poker Training Platform (CFR+ Solver, Range Visualization, Animated UI, Backend Infrastructure)
**Researched:** 2026-02-03
**Confidence:** HIGH (versions verified via npm registry)

## Recommended Stack

### Core Technologies (Existing - Preserve)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | ^16.1.6 | Frontend framework, SSR, routing | Already in v2, App Router is mature, excellent DX |
| React | ^19.2.4 | UI component library | Already in v2, latest stable with Suspense/RSC |
| TypeScript | ^5.9.3 | Type safety | Already in v2, strict mode enables safe refactoring |
| Tailwind CSS | ^4.1.18 | Utility-first styling | Already in v2 (upgrade from 3.x), faster JIT, better dark mode |
| Vitest | ^4.0.18 | Testing framework | Already in v2, fast, Vite-compatible |

### Core Technologies (New - V3 Additions)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Express | ^5.2.1 | Backend API server | Mature, explicit routing, WebSocket-ready, separates concerns from Next.js |
| PostgreSQL | 16+ | Relational database | Relational model fits user/session/hand data, AWS RDS compatible |
| Prisma | ^7.3.0 | ORM + migrations | Type-safe queries, excellent TS integration, auto-generated client |
| Framer Motion | ^12.31.0 | Animations | Industry standard for React animations, spring physics, gesture support |

### CFR+ Solver Stack

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | ^5.9.3 | Solver implementation | Same as frontend, enables client-side solving without WASM complexity |
| seedrandom | ^3.0.5 | Deterministic RNG | Already pattern in v2's rng.ts, reproducible solver runs |
| (Custom) GameTree | - | Tree structure | Build from scratch, no suitable library exists for poker CFR |
| (Custom) CardAbstraction | - | Hand clustering | Build from scratch, domain-specific to poker equity calculations |
| Web Workers | Browser API | Background solving | Offload CFR iterations, keep UI responsive |

### Range Visualization Stack

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| CSS Grid | Native | 13x13 matrix layout | Perfect fit for range grids, no library needed |
| Tailwind CSS | ^4.1.18 | Grid styling, colors | Already in stack, handles color gradients for frequency heatmaps |
| Framer Motion | ^12.31.0 | Hover/selection animations | Consistent with rest of UI animations |
| @radix-ui/react-tooltip | ^1.2.8 | Cell tooltips | Accessible, unstyled, composable |

### Backend Infrastructure Stack

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Express | ^5.2.1 | HTTP server | Latest stable, async middleware, TS support |
| Prisma | ^7.3.0 | Database ORM | Type-safe, migrations, PostgreSQL driver included |
| @prisma/client | ^7.3.0 | Generated query client | Auto-generated from schema, fully typed |
| Zod | ^4.3.6 | Runtime validation | Parse request bodies, validate input, infer TS types |
| helmet | ^8.1.0 | Security headers | CSP, HSTS, XSS protection out of box |
| cors | ^2.8.6 | CORS middleware | Required for Next.js frontend to call Express backend |
| tsx | ^4.21.0 | Dev runner | Fast TypeScript execution without compile step |

### Authentication Stack

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| next-auth | ^4.24.13 | Auth framework | Proven in Next.js ecosystem, OAuth + credentials providers |
| bcryptjs | ^3.0.3 | Password hashing | Pure JS, no native deps, sufficient for web app |
| jose | ^6.1.3 | JWT utilities | Modern, small, standards-compliant JWT handling |

### Animated UI Stack

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Framer Motion | ^12.31.0 | Component animations | Declarative, spring physics, layout animations |
| Tailwind CSS | ^4.1.18 | Dark theme, gradients | Built-in dark mode, custom color palettes |
| clsx | ^2.1.1 | Conditional classes | Clean className composition |
| tailwind-merge | ^3.4.0 | Class merging | Resolve Tailwind class conflicts |
| @radix-ui/react-slider | ^1.3.6 | Bet sizing sliders | Accessible, unstyled, customizable |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | ^5.0.11 | Client state management | Replace prop drilling for session/settings state |
| @tanstack/react-query | ^5.90.20 | Server state caching | API request deduplication, caching, optimistic updates |
| uuid | ^13.0.0 | Unique IDs | Session IDs, user IDs (prefer v4) |
| date-fns | ^4.x | Date formatting | Session timestamps, analytics date ranges |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tsx | Run TS directly | `npx tsx src/server/index.ts` for Express dev |
| prisma studio | DB GUI | `npx prisma studio` for debugging data |
| @types/express | Express types | Required for TypeScript Express development |
| ESLint | ^9.39.2 | Code linting | Flat config format in v9+ |

## Installation

```bash
# Core (frontend additions)
npm install framer-motion zustand @tanstack/react-query clsx tailwind-merge

# Radix UI components
npm install @radix-ui/react-tooltip @radix-ui/react-slider

# Backend core
npm install express cors helmet zod

# Database
npm install prisma @prisma/client

# Authentication
npm install next-auth bcryptjs jose

# Dev dependencies
npm install -D tsx @types/express @types/cors @types/bcryptjs
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Prisma | Drizzle ORM (0.45.1) | If you need raw SQL control or want smaller bundle; Drizzle is lighter but less mature migration tooling |
| Prisma | postgres.js (3.4.8) | If ORM overhead unacceptable and team prefers raw SQL with type inference |
| Framer Motion | react-spring (10.0.3) | If bundle size is critical; react-spring is smaller but less intuitive API |
| Framer Motion | CSS @keyframes | If only simple transitions needed; no library required |
| Express | Fastify | If HTTP performance is critical; Fastify is faster but less ecosystem support |
| Express | Hono | If edge/serverless deployment; lighter weight but less middleware ecosystem |
| next-auth | Lucia | If you want session-based auth without OAuth complexity; Lucia is simpler but less provider support |
| bcryptjs | argon2 (0.44.0) | If running server with native deps OK; argon2 is more secure but requires native build |
| zustand | Jotai | If atomic state preferred; similar API, matter of preference |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Redux | Over-engineered for this app size, boilerplate heavy | zustand (simpler API, less code) |
| MobX | Observable patterns unnecessary, steeper learning curve | zustand or React state |
| Mongoose | Wrong database (MongoDB), not relational | Prisma with PostgreSQL |
| Sequelize | Outdated patterns, weaker TypeScript support | Prisma (modern, type-safe) |
| Passport.js | Low-level, requires manual session management | next-auth (batteries included) |
| jQuery | Obsolete in React ecosystem | React + Framer Motion |
| Lodash | Most utilities now native to ES2020+ | Native array/object methods |
| Moment.js | Deprecated, massive bundle | date-fns (tree-shakeable) |
| Animate.css | CSS-only, no React integration | Framer Motion (declarative React) |
| GSAP | Overkill for UI animations, licensing concerns | Framer Motion (MIT, React-native) |
| WebSocket libraries | Premature optimization | HTTP polling initially, add WS later if needed |

## CFR+ Algorithm Implementation Guidance

### Architecture Recommendation

```typescript
// Recommended module structure for solver
src/lib/solver/
  index.ts              // Public API: solve(), getStrategy()
  cfr.ts                // Core CFR+ iteration loop
  gameTree.ts           // Node types, tree construction
  abstraction/
    cards.ts            // Hand strength buckets, equity calculations
    actions.ts          // Bet size abstraction
  evaluation/
    equity.ts           // Monte Carlo equity evaluation
    handRanking.ts      // 7-card hand ranking
  workers/
    solverWorker.ts     // Web Worker for background solving
```

### CFR+ Core Concepts

**Regret Matching Plus (CFR+):**
- Use `Math.max(0, regret)` for regret updates (the "plus" in CFR+)
- Faster convergence than vanilla CFR for poker games
- Implementable in pure TypeScript, no WASM needed for preflop/simple postflop

**Abstraction Layers:**
1. **Card Abstraction**: Cluster 1326 preflop hands into ~169 canonical hands (suit-isomorphic)
2. **Bet Size Abstraction**: Discrete sizes (e.g., 33%, 50%, 75%, 100%, 150% pot)
3. **Board Abstraction**: For postflop, cluster by texture (rainbow/flush-draw, paired, etc.)

**Performance Considerations:**
- Preflop-only solving is tractable in browser (~10 seconds for full convergence)
- Postflop requires pre-solved lookup tables or simplified game trees
- Use Web Workers to prevent UI blocking during iterations

### Implementation Phases

**Phase 1: Preflop Only (Client-side)**
- ~169 canonical hands x ~6 positions x limited tree depth
- Solvable in browser, no backend needed
- Validate against known GTO preflop charts

**Phase 2: Postflop Lookups (Pre-computed)**
- Pre-solve common flop textures server-side
- Store strategies in database, fetch on demand
- Client queries pre-solved strategies

**Phase 3: Real-time Postflop (Future)**
- Requires significant optimization (WASM, Rust backend)
- Out of scope for v3

### Validation Strategy

```typescript
// Compare against known GTO values
const VALIDATION_SPOTS = [
  { scenario: "BTN open", action: "RAISE_2.5", expectedFreq: 0.42, tolerance: 0.02 },
  { scenario: "BB vs BTN open", action: "CALL", expectedFreq: 0.35, tolerance: 0.02 },
  // ... more known-good spots from PioSolver/GTO+
];
```

## Range Visualization Implementation

### 13x13 Grid Structure

```typescript
// Canonical hand grid (ranks high to low: A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2)
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// Grid[row][col] where:
// - Diagonal: pairs (AA, KK, QQ...)
// - Above diagonal: suited hands (AKs, AQs...)
// - Below diagonal: offsuit hands (AKo, AQo...)
```

### Color Coding Pattern

```typescript
// Action frequency to color mapping
const ACTION_COLORS = {
  FOLD: 'bg-blue-500',    // Cold, passive
  CALL: 'bg-green-500',   // Neutral, continuing
  RAISE: 'bg-red-500',    // Hot, aggressive
  MIXED: 'bg-gradient-to-r from-green-500 to-red-500', // Split frequency
};

// Frequency to opacity
const frequencyToOpacity = (freq: number) => Math.round(freq * 100);
```

### Component Structure

```tsx
// Recommended component hierarchy
<RangeGrid>
  <RangeCell hand="AKs" actions={[{ action: 'RAISE', freq: 0.85 }, { action: 'CALL', freq: 0.15 }]} />
  // ... 168 more cells
</RangeGrid>
```

## Dark Theme Implementation

### Color Palette (Poker Felt Aesthetic)

```javascript
// tailwind.config.js extend
theme: {
  extend: {
    colors: {
      felt: {
        900: '#0a0f0a', // Deep green-black background
        800: '#0f1a0f', // Card table surface
        700: '#1a2a1a', // Elevated surfaces
      },
      card: {
        red: '#dc2626',   // Hearts/Diamonds
        black: '#1f2937', // Spades/Clubs
        back: '#1e3a5f',  // Card back blue
      },
      chip: {
        white: '#f9fafb',
        red: '#ef4444',
        blue: '#3b82f6',
        green: '#22c55e',
        black: '#1f2937',
      },
    },
  },
}
```

### Animation Patterns

```tsx
// Card dealing animation
<motion.div
  initial={{ x: -200, y: -100, rotateZ: -15, opacity: 0 }}
  animate={{ x: 0, y: 0, rotateZ: 0, opacity: 1 }}
  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
>
  <Card suit="hearts" rank="A" />
</motion.div>

// Chip movement
<motion.div
  layout
  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
>
  <ChipStack amount={100} />
</motion.div>
```

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.x | react@19.x | Required pairing |
| prisma@7.x | @prisma/client@7.x | Must match versions exactly |
| next-auth@4.x | next@14-16 | Stable, v5 beta exists but less mature |
| framer-motion@12.x | react@18-19 | Full React 19 support |
| tailwindcss@4.x | postcss@8.x | Requires PostCSS 8+ |
| vitest@4.x | @vitest/coverage-v8@4.x | Must match major versions |
| express@5.x | typescript@5.x | Native Promise support in v5 |

## Stack Patterns by Variant

**If prioritizing bundle size:**
- Use react-spring instead of Framer Motion
- Use postgres.js instead of Prisma
- Skip zustand if prop drilling is manageable

**If prioritizing developer velocity:**
- Use full stack as recommended
- Prisma migrations save significant DB management time
- Framer Motion's declarative API is faster to implement

**If considering future mobile app:**
- Keep state management in zustand (portable to React Native)
- Keep business logic in pure TypeScript (no Next.js-specific code)
- Consider Tauri over Electron for desktop (Rust, smaller bundle)

## Sources

- npm registry (all package versions verified 2026-02-03 via `npm view [package] version`)
- Existing codebase analysis: package.json, tsconfig.json, tailwind.config.js
- CFR+ algorithm: Based on "Regret Matching+" academic literature and open-source poker solver implementations (OpenCFR, PokerCFR patterns)
- Range visualization: Standard poker industry conventions (GTO+, PioSolver, GTOWizard UI patterns adapted for originality)

---
*Stack research for: GTO Poker Training Platform v3*
*Researched: 2026-02-03*
*Verified versions: All packages verified via npm registry*
