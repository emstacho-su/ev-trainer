/**
 * Overview: Prisma-backed session store implementing SessionStoreBackend.
 * Interacts with: PostgreSQL database via Prisma, sessionStore module.
 * Importance: Enables persistent session storage across server restarts.
 */

import {
  Prisma,
  type Session as PrismaSession,
  type SessionEntry as PrismaSessionEntry,
} from "@prisma/client";
import prisma from "../../prisma/client";
import type { DecisionGrade } from "../../engine/trainingOrchestrator";
import type { Spot } from "../../engine/spot";
import type { SpotFilterInput } from "../filters/spotFilters";
import type {
  SessionEntry,
  SessionMode,
  SessionRecord,
  SessionStoreBackend,
} from "../sessionStore";

/**
 * PrismaSessionStoreBackend persists session records to PostgreSQL.
 *
 * Key behaviors:
 * - Deterministic lookup via runtimeKey (hash of seed + sessionId)
 * - JSON serialization for Spot, DecisionGrade, and SpotFilterInput
 * - Atomic transactions for session + entries updates
 */
export class PrismaSessionStoreBackend implements SessionStoreBackend {
  /**
   * Retrieve a session record by runtimeKey.
   * Returns undefined if not found.
   */
  async get(key: string): Promise<SessionRecord | undefined> {
    const session = await prisma.session.findUnique({
      where: { runtimeKey: key },
      include: { entries: { orderBy: { index: "asc" } } },
    });

    if (!session) {
      return undefined;
    }

    return this.mapPrismaToSessionRecord(session, session.entries);
  }

  /**
   * Create or update a session record.
   * Uses upsert pattern with transaction for atomicity.
   */
  async set(key: string, value: SessionRecord): Promise<void> {
    // Prepare currentSpot for Prisma JSON field (handle null explicitly)
    const currentSpotJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
      value.currentSpot === null
        ? Prisma.JsonNull
        : (value.currentSpot as unknown as Prisma.InputJsonValue);

    await prisma.$transaction(async (tx) => {
      // Upsert session
      const session = await tx.session.upsert({
        where: { runtimeKey: key },
        create: {
          runtimeKey: key,
          sessionId: value.sessionId,
          seed: value.seed,
          mode: value.mode,
          packId: value.packId,
          filters: value.filters as unknown as Prisma.InputJsonValue,
          decisionIndex: value.decisionIndex,
          decisionsPerSession: value.decisionsPerSession,
          currentSpot: currentSpotJson,
          isComplete: false,
        },
        update: {
          decisionIndex: value.decisionIndex,
          currentSpot: currentSpotJson,
        },
      });

      // Delete existing entries and recreate
      await tx.sessionEntry.deleteMany({
        where: { sessionId: session.id },
      });

      if (value.entries.length > 0) {
        await tx.sessionEntry.createMany({
          data: value.entries.map((entry) => ({
            sessionId: session.id,
            index: entry.index,
            spotId: entry.spotId,
            spot: entry.spot as unknown as Prisma.InputJsonValue,
            actionId: entry.actionId,
            result: entry.result
              ? (entry.result as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          })),
        });
      }
    });
  }

  /**
   * Clear all sessions and entries.
   * Uses cascade delete on entries via foreign key constraint.
   */
  async clear(): Promise<void> {
    await prisma.session.deleteMany();
  }

  /**
   * Map Prisma models to SessionRecord interface.
   */
  private mapPrismaToSessionRecord(
    session: PrismaSession,
    entries: PrismaSessionEntry[]
  ): SessionRecord {
    return {
      sessionId: session.sessionId,
      seed: session.seed,
      mode: session.mode as SessionMode,
      packId: session.packId,
      filters: session.filters as unknown as SpotFilterInput,
      decisionIndex: session.decisionIndex,
      decisionsPerSession: session.decisionsPerSession,
      currentSpot: session.currentSpot as unknown as Spot | null,
      entries: entries.map((entry) => this.mapPrismaEntry(entry)),
    };
  }

  /**
   * Map a single Prisma SessionEntry to SessionEntry interface.
   */
  private mapPrismaEntry(entry: PrismaSessionEntry): SessionEntry {
    return {
      index: entry.index,
      spotId: entry.spotId,
      spot: entry.spot as unknown as Spot,
      actionId: entry.actionId,
      result: entry.result as unknown as DecisionGrade | undefined,
    };
  }
}
