/**
 * prisma/seed-stats.ts
 *
 * Seed script for populating realistic stats dashboard data.
 * Creates a test user with 30 days of DailyStat records, SpotStat records
 * for all 6-max position matchups, and 10-15 complete Session records.
 *
 * Run with: npx tsx prisma/seed-stats.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Prisma setup (mirrors src/lib/prisma/client.ts but standalone)
// ---------------------------------------------------------------------------

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a random integer in [min, max] (inclusive). */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Returns a random float in [min, max] rounded to `decimals` places. */
function randFloat(min: number, max: number, decimals = 4): number {
  const raw = Math.random() * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(raw * factor) / factor;
}

/** Deterministic-ish seed for position accuracy bias. */
function positionAccuracyBias(pos: string): number {
  // BTN/CO strong, SB/BB weak
  const bias: Record<string, number> = {
    BTN: 0.85,
    CO: 0.80,
    HJ: 0.72,
    UTG: 0.68,
    SB: 0.58,
    BB: 0.55,
  };
  return bias[pos] ?? 0.70;
}

/** Clamp a number to [min, max]. */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_EMAIL = 'test@example.com';
const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;
const MODES = ['TRAINING', 'PRACTICE'] as const;
const PACK_IDS = ['6max-preflop', '6max-postflop', 'mtt-preflop'];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed() {
  console.log('=== EV Trainer Stats Seed Script ===\n');

  // -------------------------------------------------------------------------
  // 1. Upsert test user
  // -------------------------------------------------------------------------
  console.log(`[1/4] Upserting test user: ${TEST_EMAIL}`);

  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      email: TEST_EMAIL,
      passwordHash: null,
      subscriptionTier: 'FREE',
    },
  });

  console.log(`      User id: ${user.id}\n`);

  // -------------------------------------------------------------------------
  // 2. Clean up existing test data (in dependency order)
  // -------------------------------------------------------------------------
  console.log('[2/4] Cleaning up existing test data...');

  // SessionEntry rows are cascade-deleted when their Session is deleted,
  // so we only need to explicitly delete Sessions (which cascades to entries).
  const deletedSessions = await prisma.session.deleteMany({
    where: { userId: user.id },
  });
  const deletedDaily = await prisma.dailyStat.deleteMany({
    where: { userId: user.id },
  });
  const deletedSpot = await prisma.spotStat.deleteMany({
    where: { userId: user.id },
  });

  console.log(`      Removed ${deletedSessions.count} sessions, ${deletedDaily.count} daily stats, ${deletedSpot.count} spot stats.\n`);

  // -------------------------------------------------------------------------
  // 3. Generate 30 days of DailyStat records
  // -------------------------------------------------------------------------
  console.log('[3/4] Generating 30 days of DailyStat records...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyStatData: {
    userId: string;
    date: Date;
    totalDecisions: number;
    correctDecisions: number;
    avgEvLoss: number;
    sessionsCompleted: number;
  }[] = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const totalDecisions = randInt(20, 80);

    // Simulate improvement over time: accuracy trending up, evLoss trending down.
    // dayProgress: 0.0 on oldest day, 1.0 on today
    const dayProgress = (29 - i) / 29;

    // Accuracy: 50-85%, trending upward with noise
    const baseAccuracy = 0.50 + dayProgress * 0.25;
    const noisyAccuracy = clamp(baseAccuracy + randFloat(-0.08, 0.08, 4), 0.40, 0.92);
    const correctDecisions = Math.round(totalDecisions * noisyAccuracy);

    // EV loss: 2.5 → 0.1 BB trending down with noise
    const baseEvLoss = 2.5 - dayProgress * 2.0;
    const noisyEvLoss = clamp(baseEvLoss + randFloat(-0.3, 0.3, 4), 0.1, 2.8);

    const sessionsCompleted = randInt(1, 4);

    dailyStatData.push({
      userId: user.id,
      date,
      totalDecisions,
      correctDecisions,
      avgEvLoss: parseFloat(noisyEvLoss.toFixed(4)),
      sessionsCompleted,
    });
  }

  await prisma.dailyStat.createMany({ data: dailyStatData });
  console.log(`      Created ${dailyStatData.length} DailyStat records.\n`);

  // -------------------------------------------------------------------------
  // 4a. Generate SpotStat records for all 6-max position matchups
  // -------------------------------------------------------------------------
  console.log('[4a/4] Generating SpotStat records for position matchups...');

  const spotStatData: {
    userId: string;
    spotId: string;
    street: string;
    heroPosition: string;
    villainPosition: string | null;
    totalDecisions: number;
    correctDecisions: number;
    avgEvLoss: number;
    lastPracticed: Date;
  }[] = [];

  // All hero vs villain matchups (hero !== villain)
  for (const hero of POSITIONS) {
    for (const villain of POSITIONS) {
      if (hero === villain) continue;

      const heroBias = positionAccuracyBias(hero);
      // Add small random noise per matchup
      const accuracy = clamp(heroBias + randFloat(-0.12, 0.12, 4), 0.30, 0.95);
      const totalDecisions = randInt(5, 100);
      const correctDecisions = Math.round(totalDecisions * accuracy);
      const avgEvLoss = clamp(
        (1 - accuracy) * 3.0 + randFloat(-0.2, 0.2, 4),
        0.05,
        3.5
      );

      // lastPracticed: random day in last 30 days
      const lastPracticed = new Date(today);
      lastPracticed.setDate(today.getDate() - randInt(0, 29));

      const spotId = `preflop:${hero}v${villain}`;

      spotStatData.push({
        userId: user.id,
        spotId,
        street: 'preflop',
        heroPosition: hero,
        villainPosition: villain,
        totalDecisions,
        correctDecisions,
        avgEvLoss: parseFloat(avgEvLoss.toFixed(4)),
        lastPracticed,
      });
    }

    // Also add a single-position (no villain) spot per hero for general drills
    const heroBias = positionAccuracyBias(hero);
    const accuracy = clamp(heroBias + randFloat(-0.10, 0.10, 4), 0.35, 0.95);
    const totalDecisions = randInt(10, 60);
    const correctDecisions = Math.round(totalDecisions * accuracy);
    const avgEvLoss = clamp(
      (1 - accuracy) * 2.5 + randFloat(-0.15, 0.15, 4),
      0.05,
      3.0
    );
    const lastPracticed = new Date(today);
    lastPracticed.setDate(today.getDate() - randInt(0, 14));

    spotStatData.push({
      userId: user.id,
      spotId: `preflop:${hero}`,
      street: 'preflop',
      heroPosition: hero,
      villainPosition: null,
      totalDecisions,
      correctDecisions,
      avgEvLoss: parseFloat(avgEvLoss.toFixed(4)),
      lastPracticed,
    });
  }

  // Add a handful of postflop spots for variety
  const postflopScenarios = [
    { street: 'flop', hero: 'BTN', villain: 'BB' },
    { street: 'flop', hero: 'CO', villain: 'BB' },
    { street: 'flop', hero: 'SB', villain: 'BB' },
    { street: 'turn', hero: 'BTN', villain: 'BB' },
    { street: 'turn', hero: 'CO', villain: 'SB' },
    { street: 'river', hero: 'BTN', villain: 'BB' },
  ];

  for (const scenario of postflopScenarios) {
    const heroBias = positionAccuracyBias(scenario.hero);
    const accuracy = clamp(heroBias * 0.9 + randFloat(-0.10, 0.10, 4), 0.25, 0.90);
    const totalDecisions = randInt(5, 40);
    const correctDecisions = Math.round(totalDecisions * accuracy);
    const avgEvLoss = clamp(
      (1 - accuracy) * 4.0 + randFloat(-0.3, 0.3, 4),
      0.1,
      4.5
    );
    const lastPracticed = new Date(today);
    lastPracticed.setDate(today.getDate() - randInt(0, 20));

    spotStatData.push({
      userId: user.id,
      spotId: `${scenario.street}:${scenario.hero}v${scenario.villain}:${randInt(100, 999)}`,
      street: scenario.street,
      heroPosition: scenario.hero,
      villainPosition: scenario.villain,
      totalDecisions,
      correctDecisions,
      avgEvLoss: parseFloat(avgEvLoss.toFixed(4)),
      lastPracticed,
    });
  }

  await prisma.spotStat.createMany({ data: spotStatData });
  console.log(`      Created ${spotStatData.length} SpotStat records.\n`);

  // -------------------------------------------------------------------------
  // 4b. Generate 10-15 complete Sessions with SessionEntry children
  // -------------------------------------------------------------------------
  const sessionCount = randInt(10, 15);
  console.log(`[4b/4] Generating ${sessionCount} complete Session records...`);

  // Track flag budget: 2-3 flagged entries spread across all sessions
  let flagBudget = randInt(2, 3);

  for (let s = 0; s < sessionCount; s++) {
    const sessionIndex = s + 1;
    const daysAgo = randInt(0, 29);
    const createdAt = new Date(today);
    createdAt.setDate(today.getDate() - daysAgo);
    // Give sessions a realistic time spread within the day
    createdAt.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59), 0);

    const entryCount = randInt(10, 25);
    const mode = MODES[randInt(0, MODES.length - 1)];
    const packId = PACK_IDS[randInt(0, PACK_IDS.length - 1)];

    // Unique identifiers
    const sessionId = `seed-session-${s}-${Date.now()}`;
    const seed = `seed-rng-${s}-${Math.random().toString(36).slice(2)}`;
    const runtimeKey = `${sessionId}:${seed}`;

    // Choose random hero position for this session
    const heroPos = POSITIONS[randInt(0, POSITIONS.length - 1)];
    const villainPos = POSITIONS.filter(p => p !== heroPos)[randInt(0, 4)];

    // Build entries
    const entries: {
      index: number;
      spotId: string;
      spot: object;
      actionId: string;
      result: object | null;
      isFlagged: boolean;
      createdAt: Date;
    }[] = [];

    // Session-level accuracy (varies per session, weakly correlated with hero position bias)
    const sessionAccuracyBase = positionAccuracyBias(heroPos);
    const sessionAccuracy = clamp(
      sessionAccuracyBase + randFloat(-0.15, 0.15, 4),
      0.30,
      0.95
    );

    for (let e = 0; e < entryCount; e++) {
      const isBestAction = Math.random() < sessionAccuracy;
      const evLoss = isBestAction
        ? randFloat(0, 0.3, 4)
        : randFloat(0.4, 3.5, 4);

      const allActions = [
        {
          actionId: 'FOLD',
          ev: randFloat(-2.0, 0.0, 4),
          frequency: randFloat(0.1, 0.5, 4),
        },
        {
          actionId: 'CALL',
          ev: randFloat(-1.0, 1.5, 4),
          frequency: randFloat(0.2, 0.6, 4),
        },
        {
          actionId: 'RAISE',
          ev: randFloat(-0.5, 2.0, 4),
          frequency: randFloat(0.1, 0.4, 4),
        },
      ];

      const actionId = allActions[randInt(0, allActions.length - 1)].actionId;

      const result = {
        isBestAction,
        evLoss,
        allActions,
      };

      // Decide if flagged: consume budget at random, but only for mistakes
      let isFlagged = false;
      if (flagBudget > 0 && !isBestAction && Math.random() < 0.15) {
        isFlagged = true;
        flagBudget--;
      }

      const entryCreatedAt = new Date(createdAt);
      entryCreatedAt.setSeconds(createdAt.getSeconds() + e * randInt(10, 45));

      const spotId = `preflop:${heroPos}v${villainPos}:spot${e}`;

      entries.push({
        index: e,
        spotId,
        spot: {
          id: spotId,
          street: 'preflop',
          heroPosition: heroPos,
          villainPosition: villainPos,
          handDescription: `${heroPos} vs ${villainPos} preflop spot #${e + 1}`,
          board: [],
        },
        actionId,
        result,
        isFlagged,
        createdAt: entryCreatedAt,
      });
    }

    // Create the session with nested entries
    const session = await prisma.session.create({
      data: {
        runtimeKey,
        sessionId,
        seed,
        userId: user.id,
        mode,
        packId,
        filters: {
          positions: [heroPos],
          streets: ['preflop'],
        },
        decisionIndex: entryCount,
        decisionsPerSession: entryCount,
        currentSpot: null,
        isComplete: true,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + entryCount * 30_000),
        entries: {
          create: entries,
        },
      },
    });

    console.log(
      `      Session ${sessionIndex}/${sessionCount}: id=${session.id} entries=${entries.length} flagged=${entries.filter(e => e.isFlagged).length}`
    );
  }

  console.log();
  console.log('=== Seed complete ===');
  console.log(`User email : ${TEST_EMAIL}`);
  console.log(`User id    : ${user.id}`);
  console.log(`Daily stats: 30 days`);
  console.log(`Spot stats : ${spotStatData.length} matchups`);
  console.log(`Sessions   : ${sessionCount} complete`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
    console.log('\nPrisma disconnected. Done.');
  });
