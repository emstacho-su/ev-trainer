/**
 * Overview: Express controllers for session API endpoints.
 * Interacts with: async session handlers from v2 API layer.
 * Importance: Adapts async handlers to Express request/response pattern.
 */

import type { Request, Response } from "express";
import {
  handleStart,
  handleNext,
  handleSubmit,
  handleGetSession,
} from "../../lib/v2/api/sessionHandlers";

export async function startSession(req: Request, res: Response): Promise<void> {
  const result = await handleStart(req.body, req.user?.userId);
  res.status(result.status).json(result.body);
}

export async function nextDecision(req: Request, res: Response): Promise<void> {
  const result = await handleNext(req.body, req.user?.userId);
  res.status(result.status).json(result.body);
}

export async function submitDecision(req: Request, res: Response): Promise<void> {
  const result = await handleSubmit(req.body, req.user?.userId);
  res.status(result.status).json(result.body);
}

export async function getSessionDetails(req: Request, res: Response): Promise<void> {
  const sessionIdParam = req.params.sessionId;
  const sessionId = typeof sessionIdParam === "string" ? sessionIdParam : "";
  const seedParam = req.query.seed;
  const seed = typeof seedParam === "string" ? seedParam : null;
  const result = await handleGetSession(sessionId, seed, req.user?.userId);
  res.status(result.status).json(result.body);
}
