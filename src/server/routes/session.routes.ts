/**
 * Overview: Session API route definitions with validation.
 * Interacts with: session controllers and validation middleware.
 * Importance: Defines session lifecycle endpoints with request validation.
 */

import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.middleware";
import { optionalAuth, requireAuth } from "../auth/auth.middleware";
import {
  startSession,
  nextDecision,
  submitDecision,
  getSessionDetails,
} from "../controllers/session.controller";

const router = Router();

// Zod schemas for request validation
const SessionModeSchema = z.enum(["TRAINING", "PRACTICE"]);

const StreetSchema = z.enum(["PREFLOP", "FLOP", "TURN", "RIVER"]);

const PositionSchema = z.enum(["SB", "BB", "UTG", "UTG+1", "MP", "MP+1", "HJ", "CO", "BTN"]);

const PotTypeSchema = z.enum(["SRP", "3BET", "4BET", "5BET+", "LIMP", "ANY"]);

const EffectiveStackBucketSchema = z.enum(["SHALLOW", "MEDIUM", "DEEP"]);

const SpotFilterSchema = z.object({
  street: StreetSchema.optional(),
  heroPosition: PositionSchema.optional(),
  villainPosition: PositionSchema.optional(),
  potType: PotTypeSchema.optional(),
  effectiveStackBbBucket: EffectiveStackBucketSchema.optional(),
}).optional();

const StartSessionSchema = z.object({
  seed: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  mode: SessionModeSchema,
  packId: z.string().min(1).optional(),
  filters: SpotFilterSchema,
  decisionsPerSession: z.number().int().positive().optional(),
});

const NextDecisionSchema = z.object({
  seed: z.string().min(1),
  sessionId: z.string().min(1),
});

// Spot schema for submit validation (simplified - full validation in handler)
const SpotSchema = z.object({
  schemaVersion: z.number(),
  spotId: z.string(),
  gameType: z.string(),
  blinds: z.object({
    sb: z.number(),
    bb: z.number(),
    ante: z.number(),
  }),
  positions: z.array(z.string()),
  stacksBb: z.record(z.string(), z.number()),
  potBb: z.number(),
  board: z.array(z.string()),
  history: z.array(z.any()),
  heroToAct: z.string(),
  hero: z.string().optional(),
  heroHand: z.array(z.string()).optional(),
}).passthrough(); // Allow additional fields

const SubmitDecisionSchema = z.object({
  seed: z.string().min(1),
  sessionId: z.string().min(1),
  spot: SpotSchema,
  actionId: z.string().min(1),
});

// Routes
// Session lifecycle - optionalAuth (guests allowed, but attach userId if logged in)
router.post("/start", optionalAuth, validate(StartSessionSchema), startSession);
router.post("/next", optionalAuth, validate(NextDecisionSchema), nextDecision);
router.post("/submit", optionalAuth, validate(SubmitDecisionSchema), submitDecision);
router.get("/:sessionId", optionalAuth, getSessionDetails);

// User-specific queries - requireAuth (must be logged in to view own history)
router.get("/history", requireAuth, (req, res) => {
  res.json({ message: 'Session history endpoint - to be implemented' });
});

export default router;
