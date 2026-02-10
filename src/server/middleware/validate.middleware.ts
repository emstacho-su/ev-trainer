/**
 * Overview: Request validation middleware using Zod schemas.
 * Interacts with: Route handlers for request body validation.
 * Importance: Ensures type-safe request handling with consistent error responses.
 */

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "./error.middleware";

export function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const message = firstIssue
        ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid request body";

      throw new AppError(400, "INVALID_ARGUMENT", message);
    }

    // Attach parsed body to request for type-safe access in handlers
    req.body = result.data;
    next();
  };
}
