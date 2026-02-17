/**
 * Overview: Postflop solver API route definitions.
 * Interacts with: mockPostflopSolver for solver output.
 * Importance: Enables server-side postflop solving for given board/street configurations.
 *
 * This is the ONLY Express route. The solver is CPU-intensive and stays on Express
 * rather than running in a Next.js serverless function.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { mockSolvePostflop } from '../../lib/postflop/solver/mockPostflopSolver';
import type { PostflopConfig } from '../../lib/solver/postflopSolver';
import type { Street } from '../../lib/engine/types';
import type { ActionAbstractionConfig, Card, PositionRelative } from '../../lib/solver/types';

// Zod schema for POST /solve request body
const SolveRequestSchema = z.object({
  street: z.enum(['FLOP', 'TURN', 'RIVER']),
  board: z.array(z.string()).min(3).max(5),
  potBb: z.number().positive(),
  stackBb: z.number().positive(),
  heroPosition: z.enum(['IP', 'OOP']),
});

// Minimal default action abstraction for mock solving
const DEFAULT_ACTION_ABSTRACTION: ActionAbstractionConfig = {
  betSizes: {
    PREFLOP: [],
    FLOP: [0.33, 0.75],
    TURN: [0.33, 0.75],
    RIVER: [0.33, 0.75],
  },
  raiseSizes: {
    PREFLOP: [2.2],
    FLOP: [2.2],
    TURN: [2.2],
    RIVER: [2.2],
  },
  includeAllIn: true,
  allInThreshold: 2.0,
};

const router = Router();

// POST /solve - Run mock postflop solver for given board configuration
router.post('/solve', (req: Request, res: Response) => {
  // Inline Zod validation (replaces deleted validate middleware)
  const result = SolveRequestSchema.safeParse(req.body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const message = firstIssue
      ? `${firstIssue.path.join('.')}: ${firstIssue.message}`
      : 'Invalid request body';
    res.status(400).json({ error: { code: 'INVALID_ARGUMENT', message } });
    return;
  }

  const { street, board, potBb, stackBb, heroPosition } = result.data;

  // Construct minimal PostflopConfig for the mock solver
  const config: PostflopConfig = {
    street: street as Street,
    board: board as Card[],
    heroRange: [],
    villainRange: [],
    potBb,
    stackBb,
    heroPosition: heroPosition as PositionRelative,
    actionAbstraction: DEFAULT_ACTION_ABSTRACTION,
    // CFRConfig defaults
    maxIterations: 0,
    targetExploitability: 0,
    checkConvergenceEvery: 1,
  };

  const output = mockSolvePostflop(config);
  res.json(output);
});

export default router;
