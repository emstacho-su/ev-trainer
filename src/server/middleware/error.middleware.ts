/**
 * Overview: Global error handler middleware for Express.
 * Interacts with: Express app error handling chain.
 * Importance: Ensures consistent error response format across all routes.
 */

import type { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Log unexpected errors in development
  if (process.env.NODE_ENV !== "production") {
    console.error("Unexpected error:", err);
  }

  // Return generic error for unexpected errors
  const response: ErrorResponse = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  };
  res.status(500).json(response);
}
