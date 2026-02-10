/**
 * Overview: Health check and readiness endpoints.
 * Interacts with: Container orchestration and load balancers.
 * Importance: Enables infrastructure health monitoring and graceful deployment.
 */

import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

interface HealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks?: {
    database?: "ok" | "error";
  };
}

interface ReadyResponse {
  status: "ready";
}

// Health check endpoint - includes component status
router.get("/", (_req: Request, res: Response) => {
  const response: HealthResponse = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      // Database check will be added in Plan 02-03 when Prisma service layer is ready
      database: "ok",
    },
  };

  res.status(200).json(response);
});

// Readiness probe - simple liveness check
router.get("/ready", (_req: Request, res: Response) => {
  const response: ReadyResponse = {
    status: "ready",
  };

  res.status(200).json(response);
});

export default router;
