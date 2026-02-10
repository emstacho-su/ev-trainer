/**
 * Overview: Authentication middleware for Express routes.
 * Interacts with: Token service for JWT verification, route handlers via req.user.
 * Importance: Protects routes and provides user context to handlers.
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './token.service';
import type { AuthUser } from './auth.types';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyAccessToken(token);
    req.user = { userId: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired access token' },
    });
  }
}

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyAccessToken(token);
    req.user = { userId: payload.sub, email: payload.email };
  } catch {
    // Invalid token is okay for optional auth - just don't set user
  }

  next();
}
