# Technology Stack

**Analysis Date:** 2026-02-03

## Languages

**Primary:**
- TypeScript 5.9.3 - Full codebase (src/, app/, lib/, components/)
- JavaScript - Configuration files (next.config.js, postcss.config.js, tailwind.config.js)
- CSS - Styling (src/app/globals.css with Tailwind directives)

**Secondary:**
- JSX/TSX - React components and page layouts

## Runtime

**Environment:**
- Node.js (version specified in package.json via Next.js compatibility)
- Browser (React 19.2.4 for client-side rendering)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (implied, standard npm lockfile present in git repo)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack framework for routing, API routes, and SSR
  - Location: `src/app/` follows Next.js App Router pattern
  - API routes in `src/app/api/` (session handlers, stats, training)
  - Page routes in `src/app/` (train, review, stats, setup, summary)

**Frontend:**
- React 19.2.4 - UI component library
  - React DOM 19.2.4 - Browser rendering
  - Server Components for page layouts
  - Client Components for interactive UI

**Styling:**
- Tailwind CSS - Utility-first CSS framework
  - Config: `tailwind.config.js`
  - Content paths: `./src/app/**/*.{ts,tsx}`, `./src/lib/**/*.{ts,tsx}`
  - Postcss integration via `postcss.config.js`
  - Autoprefixer for vendor prefixes

**Testing:**
- Vitest 4.0.18 - Unit and integration test runner
  - Config: `vitest.config.ts`
  - Coverage: `@vitest/coverage-v8` 4.0.18
  - Test environment: Node.js
  - Test patterns: `src/**/*.test.ts` (co-located with source)

**Build/Dev:**
- TypeScript 5.9.3 - Type checking and compilation
  - Config: `tsconfig.json` with strict mode enabled
  - Target: ES2020
  - Module resolution: bundler (Next.js compatible)
- PostCSS - CSS transformation pipeline (via tailwind.config.js)

## Key Dependencies

**Critical:**
- next 16.1.6 - Server rendering, routing, and API middleware
- react 19.2.4 - Component framework (required by Next.js)
- react-dom 19.2.4 - DOM rendering

**Testing:**
- vitest 4.0.18 - Test execution and assertion library
- @vitest/coverage-v8 4.0.18 - Code coverage reporting

**Type Definitions:**
- @types/node 25.1.0 - Node.js type definitions (used in engine, session storage)
- @types/react 19.2.10 - React type definitions
- @types/react-dom 19.2.3 - React DOM type definitions

## Configuration

**Environment:**
- No .env configuration required for development
- No external API keys or secrets in codebase
- All data sourced from bundled pack (public/packs/ev-dev-pack-v1.json)
- Session state stored in browser localStorage (client-side only)

**Build:**
- `next.config.js` - Default configuration, no custom webpack or build rules
- `tsconfig.json` - Strict mode, ES2020 target, JSX support
- `vitest.config.ts` - Node environment, HTML coverage reports
- `tailwind.config.js` - Default theme, no custom plugins

## Platform Requirements

**Development:**
- Node.js (v18+, inferred from Next.js 16.x compatibility)
- npm 10.x (compatible with Next.js 16)
- Windows, macOS, or Linux (cross-platform)

**Production:**
- Node.js runtime for Next.js server
- Static file serving for public/packs/ bundle
- Browser: modern JavaScript support (ES2020)
- localStorage support for session persistence

## Asset Bundling

**Data Bundles:**
- `public/packs/ev-dev-pack-v1.json` (3.1 KB) - Bundled poker spots training dataset
  - Loaded server-side via `src/lib/v2/packs/loadBundledPack.ts`
  - Cached in memory after first load
  - No dynamic external pack loading

**Static Files:**
- Served from `public/` directory (Next.js default)
- Pack JSON files loaded via filesystem at runtime (server-side only)

---

*Stack analysis: 2026-02-03*
