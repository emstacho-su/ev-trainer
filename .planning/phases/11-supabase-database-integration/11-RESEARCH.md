# Phase 11: Supabase Database Integration - Research

**Researched:** 2026-02-17
**Domain:** Supabase Cloud (Auth, Database, Storage, Realtime) + Next.js 16 App Router integration
**Confidence:** HIGH

## Summary

This phase replaces the existing Express/PostgreSQL/Prisma backend with Supabase Cloud. The migration covers four major domains: authentication (Supabase Auth replacing custom JWT/Argon2), database schema (Supabase PostgreSQL replacing Prisma ORM), file storage (Supabase Storage replacing bundled JSON files), and real-time sync (Supabase Realtime for cross-tab/cross-device session sync). The Express server remains only for CPU-intensive solver operations.

The Supabase ecosystem is mature and well-documented for Next.js App Router integration. The `@supabase/ssr` package (v0.8.0) handles cookie-based session management for SSR. The deprecated `@supabase/auth-ui-react` package should NOT be used -- Supabase shipped an official UI Library built on shadcn/ui (already in the project) that provides password-based and social auth components. The Supabase CLI handles migrations, type generation, and project management.

**Primary recommendation:** Use `@supabase/supabase-js` v2.96+ with `@supabase/ssr` v0.8+ for Next.js integration. Use the official Supabase UI Library (shadcn-based) instead of the abandoned `@supabase/auth-ui-react`. Manage schema with Supabase CLI migrations. Develop against Supabase Cloud directly (no local Supabase needed given two-device workflow).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.96.0 | Supabase client SDK | Official JS client for all Supabase services |
| `@supabase/ssr` | ^0.8.0 | SSR cookie management | Official Next.js SSR integration, replaces deprecated auth-helpers |
| `supabase` (CLI) | ^2.76.9 | CLI for migrations, types, project mgmt | Official toolchain for schema management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase UI Library | latest | Pre-built auth components (shadcn-based) | Login/signup UI pages |
| `zod` | ^4.3.6 (already installed) | Input validation | Server Action validation, form validation |
| `next-themes` | ^0.4.6 (already installed) | Dark theme | Already integrated, compatible |

### Packages to REMOVE After Migration
| Package | Reason |
|---------|--------|
| `@prisma/client` | Replaced by Supabase client |
| `@prisma/adapter-pg` | Replaced by Supabase client |
| `prisma` | Replaced by Supabase CLI migrations |
| `pg` | Replaced by Supabase client (manages connections internally) |
| `argon2` | Replaced by Supabase Auth (handles hashing) |
| `jose` | Replaced by Supabase Auth (handles JWT) |
| `express` | Replaced by Next.js API routes / Server Actions (solver stays) |
| `express-rate-limit` | Supabase has built-in rate limiting |
| `helmet` | No Express server needed |
| `cors` | No Express server needed |
| `compression` | Next.js handles compression |
| `cookie-parser` | Supabase SSR handles cookies |
| `resend` | Supabase built-in email service |

### NOT Using (Important)
| Package | Why NOT |
|---------|---------|
| `@supabase/auth-ui-react` | Abandoned since Feb 2024, not maintained. Use Supabase UI Library instead |
| `@supabase/auth-helpers-nextjs` | Deprecated, replaced by `@supabase/ssr` |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D supabase
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    supabase/
      client.ts          # Browser client (createBrowserClient)
      server.ts          # Server client (createServerClient + cookies)
      middleware.ts       # Middleware client for token refresh
      types.ts           # Re-export generated Database types
    supabase.types.ts    # Generated types (supabase gen types output)
  app/
    auth/
      login/page.tsx     # Login page with email/password + OAuth
      signup/page.tsx    # Signup page
      callback/route.ts  # OAuth callback (code exchange)
      confirm/route.ts   # Email confirmation handler
    (protected)/         # Route group for authenticated pages
      ...
  middleware.ts          # Root middleware for token refresh
supabase/
  migrations/            # SQL migration files (timestamped)
  config.toml            # Supabase project config (for local dev)
  seed.sql               # Seed data
```

### Pattern 1: Three Supabase Clients
**What:** Separate client instances for browser, server, and middleware contexts
**When to use:** Always -- this is the canonical Next.js App Router pattern
**Why:** Each context has different cookie access patterns

```typescript
// src/lib/supabase/client.ts -- Browser Client
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

```typescript
// src/lib/supabase/server.ts -- Server Client (Server Components, Server Actions, Route Handlers)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/supabase.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component -- can't set cookies, middleware handles this
          }
        },
      },
    }
  )
}
```

```typescript
// src/lib/supabase/middleware.ts -- Middleware Client
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: use getUser() not getSession() for security
  // getUser() validates the JWT against Supabase servers
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login (except public routes)
  if (!user && !request.nextUrl.pathname.startsWith('/auth') &&
      !request.nextUrl.pathname.startsWith('/train') &&
      request.nextUrl.pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

### Pattern 2: Hybrid API Approach
**What:** Direct Supabase client for simple reads, Next.js Server Actions for mutations and complex logic
**When to use:** All data access decisions

```
Simple read (spots, user profile, session history):
  Client Component -> supabase.from('spots').select() -> Direct DB read

Mutation / complex logic (grade decision, solver call, session lifecycle):
  Client Component -> Server Action -> createClient() -> DB + business logic

Solver compute (CFR+ heavy computation):
  Client Component -> Express API -> solver computation
```

### Pattern 3: Auth State Management
**What:** `onAuthStateChange()` listener in a React context provider
**When to use:** All authenticated pages

```typescript
// src/app/providers/AuthProvider.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

const AuthContext = createContext<{ user: User | null; loading: boolean }>({
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

### Pattern 4: OAuth Callback Route
**What:** Server-side code exchange for PKCE flow
**When to use:** Google and GitHub OAuth

```typescript
// src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

### Pattern 5: RLS + App-Level Authorization (Defense in Depth)
**What:** Database policies enforce row-level access; application code adds business logic checks
**When to use:** All tables with user data

```sql
-- RLS Policy: users can only read their own sessions
CREATE POLICY "Users read own sessions"
  ON training_sessions FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- RLS Policy: users can only insert their own sessions
CREATE POLICY "Users insert own sessions"
  ON training_sessions FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- RLS Policy: anonymous users can read public spots
CREATE POLICY "Anyone can read system spots"
  ON spots FOR SELECT
  USING (is_system = true OR created_by = (SELECT auth.uid()));
```

### Pattern 6: Realtime Subscription for Cross-Tab Sync
**What:** Subscribe to session changes for cross-tab/cross-device sync
**When to use:** Training session state sync

```typescript
const channel = supabase
  .channel('session-sync')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'training_sessions',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    // Update local state with new session data
  })
  .subscribe()

// Cleanup
return () => { supabase.removeChannel(channel) }
```

### Anti-Patterns to Avoid
- **Using getSession() on server:** Use `getUser()` instead -- `getSession()` does NOT revalidate the JWT token. Supabase docs emphasize: "Never trust `supabase.auth.getSession()` inside server code."
- **Exposing service_role key:** Never use the service_role key on the client. It bypasses ALL RLS policies. Only use in trusted server environments.
- **Individual cookie methods:** Use `getAll()` and `setAll()` exclusively -- the individual `get`, `set`, `remove` methods are deprecated in `@supabase/ssr`.
- **Putting complex business logic in RLS:** Keep RLS policies simple (ownership checks). Complex validation belongs in Server Actions/API routes.
- **Skipping RLS on new tables:** 83% of Supabase security breaches involve missing RLS. Enable RLS on EVERY table immediately.
- **Global Supabase client variable in server code:** Create a new client per request to ensure proper session isolation.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session management | Custom JWT/refresh tokens | Supabase Auth | Handles token rotation, expiry, storage automatically |
| Password hashing | Argon2 integration | Supabase Auth | Built-in bcrypt, managed securely |
| OAuth flow | Manual OAuth state/callback | `signInWithOAuth()` | PKCE flow built in, handles redirects |
| Cookie-based sessions | Manual cookie management | `@supabase/ssr` | Handles server/client cookie sync |
| Database migration tracking | Custom migration system | `supabase migration new/up/push` | Timestamped, tracked, version-controlled |
| TypeScript types for DB | Manual type definitions | `supabase gen types` | Auto-generated from live schema |
| File storage + CDN | S3 setup + CloudFront | Supabase Storage | Built-in CDN, RLS policies, direct client upload |
| Real-time subscriptions | WebSocket server | Supabase Realtime | Built-in Postgres change detection |
| Rate limiting | express-rate-limit | Supabase built-in | Managed at infrastructure level |
| Email sending | Resend/SMTP setup | Supabase built-in email | Works for auth flows out of the box |
| Auth UI components | Custom login/signup forms | Supabase UI Library (shadcn) | Pre-built, themed, maintained |

**Key insight:** Supabase provides a vertically integrated backend. Almost every infrastructure concern (auth, storage, real-time, email, rate limiting) is handled by the platform. The migration removes ~15 npm packages worth of hand-rolled infrastructure.

## Common Pitfalls

### Pitfall 1: getSession() vs getUser() on Server
**What goes wrong:** Using `getSession()` in Server Components/Actions returns stale session data without verifying the JWT.
**Why it happens:** `getSession()` reads from local storage/cookies without contacting Supabase Auth servers. The token could be expired or tampered with.
**How to avoid:** Always use `getUser()` in server code -- it makes a request to Supabase Auth to verify the JWT.
**Warning signs:** Stale user data, sessions that don't expire, auth bypasses.

### Pitfall 2: Missing RLS on New Tables
**What goes wrong:** Tables created without RLS are publicly accessible via the REST API (anon key gives full access).
**Why it happens:** Supabase creates tables with RLS disabled by default. Developers forget to enable it.
**How to avoid:** Enable RLS immediately after creating any table. Add this as step 1 in every migration file.
**Warning signs:** Data accessible without authentication in browser console.

### Pitfall 3: RLS Performance on Large Tables
**What goes wrong:** Queries slow down dramatically as table grows because RLS policies scan every row.
**Why it happens:** Missing indexes on columns used in RLS policies (e.g., `user_id`).
**How to avoid:** Always create an index on columns referenced in RLS policies. Use `(SELECT auth.uid())` instead of `auth.uid()` (wrapping in SELECT enables query planner caching -- documented 99.99% improvement).
**Warning signs:** Slow queries that were fast with small data.

### Pitfall 4: Cookie Sync Between Server and Browser
**What goes wrong:** User appears logged out in Server Components but logged in on client (or vice versa).
**Why it happens:** Middleware not properly refreshing tokens, or response cookies not propagated.
**How to avoid:** Middleware must call `getUser()` (which triggers token refresh), then propagate cookies via both `request.cookies.set()` AND `supabaseResponse.cookies.set()`.
**Warning signs:** Inconsistent auth state between SSR and client hydration.

### Pitfall 5: Realtime + RLS Interaction
**What goes wrong:** Realtime subscriptions don't receive expected changes.
**Why it happens:** RLS policies block the subscription from seeing rows. DELETE events only contain primary key by default.
**How to avoid:** Ensure RLS policies grant SELECT access for the subscribing user. Enable replica identity FULL for tables where you need full row data on UPDATE/DELETE: `ALTER TABLE tablename REPLICA IDENTITY FULL;`
**Warning signs:** Subscription connected but no events received.

### Pitfall 6: Supabase Client Instance Per Request
**What goes wrong:** Shared Supabase client across requests leaks session state between users.
**Why it happens:** Creating a singleton server client (as was done with Prisma) reuses auth context.
**How to avoid:** Always create a new Supabase client per request in server code. The `createClient()` from `server.ts` handles this by reading cookies fresh each time.
**Warning signs:** Users seeing other users' data, random auth errors.

### Pitfall 7: Anonymous User Handling with is_anonymous
**What goes wrong:** Anonymous users get full authenticated user privileges.
**Why it happens:** Supabase anonymous sign-ins use the `authenticated` role, same as permanent users.
**How to avoid:** Use the `is_anonymous` JWT claim in RLS policies. Use RESTRICTIVE policies (not permissive) for anonymous checks to ensure they can't be bypassed.
**Warning signs:** Anonymous users able to access premium features.

## Code Examples

### Database Schema Migration
```sql
-- supabase/migrations/001_initial_schema.sql

-- Enable RLS on all tables FIRST
-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'FREE',
  trainer_preferences JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Spots table (replaces bundled JSON packs)
CREATE TABLE spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id TEXT NOT NULL UNIQUE,          -- Deterministic spot identifier
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Spot data
  street TEXT NOT NULL,                   -- PREFLOP, FLOP, TURN, RIVER
  hero_position TEXT NOT NULL,
  villain_position TEXT,
  board TEXT[] NOT NULL DEFAULT '{}',
  hero_to_act TEXT NOT NULL,
  positions TEXT[] NOT NULL,
  stacks_bb JSONB NOT NULL,
  pot_bb NUMERIC(10,2) NOT NULL,
  history TEXT[] NOT NULL DEFAULT '{}',
  hero_hand TEXT[],

  -- Metadata
  pot_type TEXT NOT NULL,                 -- SRP, 3BP, 4BP
  effective_stack_bb NUMERIC(10,2) NOT NULL,
  scenario_type TEXT,                     -- RFI, FacingOpen, 3Bet, BlindDefense
  difficulty_rating NUMERIC(4,2),         -- Auto-rated from solver EV spread
  tags TEXT[] NOT NULL DEFAULT '{}',      -- Position, street, stack depth tags

  -- Sharing
  share_code TEXT UNIQUE,                 -- For shareable links

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_spots_system ON spots (is_system) WHERE is_system = true;
CREATE INDEX idx_spots_created_by ON spots (created_by);
CREATE INDEX idx_spots_tags ON spots USING GIN (tags);
CREATE INDEX idx_spots_street ON spots (street);
CREATE INDEX idx_spots_hero_position ON spots (hero_position);
CREATE INDEX idx_spots_pot_type ON spots (pot_type);

-- Training sessions
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  seed TEXT NOT NULL,
  mode TEXT NOT NULL,                     -- TRAINING, PRACTICE
  filters JSONB NOT NULL DEFAULT '{}',
  decision_index INT NOT NULL DEFAULT 0,
  decisions_per_session INT NOT NULL DEFAULT 10,
  current_spot JSONB,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  target_stack_bb NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(session_id, seed)
);
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sessions_user_created ON training_sessions (user_id, created_at);

-- Session entries (individual decisions)
CREATE TABLE session_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  index INT NOT NULL,
  spot_id TEXT NOT NULL,
  spot JSONB NOT NULL,
  action_id TEXT NOT NULL,
  result JSONB,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(session_id, index)
);
ALTER TABLE session_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_entries_session ON session_entries (session_id, index);
CREATE INDEX idx_entries_flagged ON session_entries (session_id, is_flagged) WHERE is_flagged = true;

-- Daily stats (pre-aggregated)
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_decisions INT NOT NULL DEFAULT 0,
  correct_decisions INT NOT NULL DEFAULT 0,
  avg_ev_loss NUMERIC(10,4) NOT NULL DEFAULT 0,
  sessions_completed INT NOT NULL DEFAULT 0,

  UNIQUE(user_id, date)
);
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_daily_stats_user_date ON daily_stats (user_id, date);

-- Spot stats (per-spot performance)
CREATE TABLE spot_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id TEXT NOT NULL,
  street TEXT NOT NULL,
  hero_position TEXT NOT NULL,
  villain_position TEXT,
  total_decisions INT NOT NULL DEFAULT 0,
  correct_decisions INT NOT NULL DEFAULT 0,
  avg_ev_loss NUMERIC(10,4) NOT NULL DEFAULT 0,
  last_practiced TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, spot_id)
);
ALTER TABLE spot_stats ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_spot_stats_user ON spot_stats (user_id, spot_id);
CREATE INDEX idx_spot_stats_user_position ON spot_stats (user_id, hero_position);
CREATE INDEX idx_spot_stats_user_last ON spot_stats (user_id, last_practiced);
```

### RLS Policies
```sql
-- Profiles: users can only access their own
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Auto-create profile on signup (via trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Spots: system spots readable by all, user spots by owner
CREATE POLICY "Read system spots" ON spots
  FOR SELECT USING (is_system = true);

CREATE POLICY "Read own spots" ON spots
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

CREATE POLICY "Read shared spots" ON spots
  FOR SELECT USING (share_code IS NOT NULL);

CREATE POLICY "Insert own spots" ON spots
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid()) AND
    is_system = false AND
    ((SELECT (auth.jwt()->>'is_anonymous')::boolean) IS NOT true)
  );

-- Sessions: users can only access their own
CREATE POLICY "Users manage own sessions" ON training_sessions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Session entries: access through session ownership
CREATE POLICY "Users access own session entries" ON session_entries
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT id FROM training_sessions
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Stats: users can only access their own
CREATE POLICY "Users manage own daily stats" ON daily_stats
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users manage own spot stats" ON spot_stats
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
```

### Supabase Client Direct Read (Simple Query)
```typescript
// Client-side: reading spots with filters
const { data: spots, error } = await supabase
  .from('spots')
  .select('*')
  .eq('street', 'PREFLOP')
  .eq('hero_position', 'BTN')
  .contains('tags', ['SRP'])
  .order('created_at', { ascending: false })
  .limit(50)
```

### Server Action (Complex Mutation)
```typescript
// src/app/actions/session.ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function submitDecision(
  sessionId: string,
  spotId: string,
  actionId: string,
  spot: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Business logic: grade the decision
  const grade = gradeDecision(spot, actionId)

  // Write to database
  const { error } = await supabase
    .from('session_entries')
    .insert({
      session_id: sessionId,
      spot_id: spotId,
      action_id: actionId,
      spot: spot,
      result: grade,
      index: 0, // computed
    })

  if (error) throw error
  return grade
}
```

### Type Generation Script
```json
// package.json script
{
  "scripts": {
    "gen:types": "npx supabase gen types --lang=typescript --project-id \"$PROJECT_REF\" > src/lib/supabase.types.ts"
  }
}
```

### Storage: Upload/Download Solver Output
```typescript
// Upload solver output JSON to Storage
const { error: uploadError } = await supabase.storage
  .from('solver-outputs')
  .upload(`spots/${spotId}/output.json`, JSON.stringify(solverOutput), {
    contentType: 'application/json',
    upsert: true,
  })

// Download solver output
const { data, error } = await supabase.storage
  .from('solver-outputs')
  .download(`spots/${spotId}/output.json`)
const output = JSON.parse(await data.text())
```

### Guest Access Pattern (localStorage + anonymous tracking)
```typescript
// Guest limiting stays client-side via localStorage (existing pattern)
// No Supabase anonymous sign-in needed -- simpler approach
function isGuestUser(): boolean {
  // No Supabase session = guest
  const supabase = createClient()
  // Check synchronously from cached state
  return !supabase.auth.getSession()
}

// Spots are public-read (RLS allows SELECT for system spots)
// Guest users query spots directly without auth
// localStorage tracks guest hand count (existing 50/day limit)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Must use ssr package, helpers are deprecated |
| `@supabase/auth-ui-react` | Supabase UI Library (shadcn) | Apr 2025 | Use official shadcn-based components |
| Individual cookie methods (get/set/remove) | `getAll()`/`setAll()` | 2024 | Individual methods deprecated in ssr package |
| `getSession()` on server | `getUser()` on server | 2024 | Security requirement -- getSession doesn't validate JWT |
| `auth.uid()` direct in RLS | `(SELECT auth.uid())` wrapped | 2025 | Massive performance improvement (caching) |
| Manual Prisma migrations | `supabase migration new` + `db push` | N/A | Supabase-native migration tooling |
| Express API + Prisma queries | Supabase client direct + Server Actions | N/A | Eliminates entire backend server |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Use `@supabase/ssr` instead (all future fixes go to ssr)
- `@supabase/auth-ui-react`: Abandoned Feb 2024, use Supabase UI Library
- Individual cookie methods in `@supabase/ssr`: Use `getAll()` and `setAll()` only

## Supabase Schema Design Decisions

### Leveraging auth.users
Supabase Auth manages `auth.users` automatically. The `profiles` table extends it via FK to `auth.users(id)`. A database trigger auto-creates a profile row on user signup. This replaces the custom `User` model with password hash, OAuth fields, etc.

### JSON vs Relational for Spots
The `spot` column on `session_entries` stores the full Spot object as JSONB (same as Prisma's Json field). This preserves the existing pattern where the complete spot data is stored with each decision for replay. The `spots` table (for the spot library) uses relational columns for queryable metadata.

### Tag-Based Organization
Spots use a `tags TEXT[]` column with GIN index instead of a hierarchical pack structure. Tags cover position, street, stack depth, pot type. This enables flexible filtering: `spots.contains('tags', ['BTN', 'SRP', '100bb'])`.

### UUID Primary Keys
Supabase uses UUID by default (matching `auth.users.id`). This replaces Prisma's `cuid()` IDs. UUIDs are globally unique, sortable, and don't expose row counts.

## Migration Strategy Details

### Incremental Swap Order (Recommended)
1. **Supabase project setup** -- Create project, configure env vars, install packages
2. **Client utilities** -- Create browser/server/middleware clients, type generation
3. **Auth migration** -- Supabase Auth replaces JWT/Argon2/OAuth. Build login/signup pages.
4. **Schema migration** -- Create tables via Supabase migrations. Parallel to existing Prisma schema.
5. **Spot database** -- Migrate bundled JSON packs to Supabase `spots` table + Storage
6. **Session data layer** -- Replace SessionStore + sessionHandlers with Supabase client calls
7. **Stats data layer** -- Replace Prisma aggregation queries with Supabase queries
8. **Realtime** -- Add cross-tab/cross-device sync
9. **Cleanup** -- Remove Express server (except solver), Prisma, old auth code

### What the Express Server Keeps
Only the solver compute route (`/api/postflop/solve`). This stays as a separate process because CFR+ solver is CPU-intensive and would block Next.js. After migration, this is the ONLY Express endpoint. It could later become a Supabase Edge Function if performance allows.

## Open Questions

Things that couldn't be fully resolved:

1. **Supabase UI Library installation method**
   - What we know: It's shadcn-based and supports Next.js. Uses `npx` style block installation.
   - What's unclear: Exact CLI command for installing auth blocks into an existing project with shadcn already set up.
   - Recommendation: Test `npx shadcn add` pattern from supabase.com/ui during implementation. Fall back to manually copying component code if CLI conflicts with existing shadcn setup.

2. **Solver output caching strategy**
   - What we know: Supabase Storage handles file storage with CDN. Solver outputs are JSON blobs.
   - What's unclear: Optimal caching TTL and whether to store in Storage vs JSONB column vs both.
   - Recommendation: Store in JSONB column on spots table for quick access, with Storage as backup for large outputs. Cache in-memory on client after first fetch.

3. **Spot difficulty rating algorithm**
   - What we know: Auto-rated based on solver EV spread (close decisions = harder spots).
   - What's unclear: Exact formula for converting EV spread to difficulty rating.
   - Recommendation: Use normalized EV spread: `difficulty = 1 - (maxEV - minEV) / maxEV`. Scale to 1-10. Implement as a database function or compute in Server Action during spot creation.

4. **Realtime subscription scale**
   - What we know: Supabase Realtime supports postgres_changes. Each change event requires RLS checks.
   - What's unclear: Whether training session sync at scale (many users, frequent updates) will create database bottlenecks.
   - Recommendation: Use Broadcast (ephemeral messages) instead of postgres_changes for high-frequency updates. Fall back to postgres_changes for session completion events only.

## Sources

### Primary (HIGH confidence)
- [Supabase Auth Server-Side Setup for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) - Complete SSR auth setup
- [Creating a Supabase Client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) - Three client types
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) - RLS patterns and performance
- [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) - Migration workflow
- [Supabase Storage](https://supabase.com/docs/guides/storage) - File storage patterns
- [Postgres Changes Realtime](https://supabase.com/docs/guides/realtime/postgres-changes) - Subscription setup
- [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) - Guest user pattern
- [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google) - Google provider setup
- [GitHub OAuth](https://supabase.com/docs/guides/auth/social-login/auth-github) - GitHub provider setup
- [TypeScript Type Generation](https://supabase.com/docs/guides/api/rest/generating-types) - CLI type gen
- [onAuthStateChange API](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) - Auth event listener
- [Supabase UI Library](https://supabase.com/ui/docs/getting-started/introduction) - Official shadcn-based components
- npm registry: `@supabase/supabase-js` v2.96.0, `@supabase/ssr` v0.8.0, `supabase` CLI v2.76.9

### Secondary (MEDIUM confidence)
- [Supabase Common Mistakes](https://hrekov.com/blog/supabase-common-mistakes) - Pitfalls compilation
- [RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) - Performance tips
- [API Routes vs Server Actions](https://makerkit.dev/docs/next-supabase/how-to/api/api-routes-vs-server-actions) - Hybrid approach
- [Supabase Best Practices](https://www.leanware.co/insights/supabase-best-practices) - General guidance

### Tertiary (LOW confidence)
- Supabase UI Library exact installation CLI for existing projects - needs validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified via npm registry and official docs
- Architecture (client patterns): HIGH - Official Supabase docs provide exact code
- Architecture (schema design): MEDIUM - Designed based on existing Prisma schema + Supabase patterns
- Auth migration: HIGH - Well-documented in official docs
- Storage patterns: HIGH - Official docs with code examples
- Realtime patterns: MEDIUM - Documented but scale concerns need validation
- Pitfalls: HIGH - Multiple sources agree on key issues (RLS, getSession, cookies)

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable ecosystem, 30-day validity)
