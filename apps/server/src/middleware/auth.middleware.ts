/**
 * Authentication middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { AppError } from './error-handler.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        tenantId?: string;
        scopes: string[];
        method: 'api_key' | 'jwt';
      };
    }
  }
}

/**
 * Authenticate request using API key or JWT
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.get('authorization');
    if (!authHeader) {
      throw new AppError(401, 'Missing authorization header', 'unauthorized');
    }

    // Extract token
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      throw new AppError(401, 'Invalid authorization format', 'invalid_auth');
    }

    const token = match[1];

    // Try API key first (support both mcp_sk_ and legacy test_sk_/live_sk_ prefixes)
    if (token.startsWith('mcp_sk_') || token.startsWith('test_sk_') || token.startsWith('live_sk_')) {
      const authContext = await authService.verifyApiKey(token);
      req.user = {
        id: authContext.userId,
        email: authContext.user?.email,
        tenantId: authContext.tenantId,
        scopes: authContext.scopes,
        method: 'api_key',
      };
    } else {
      // Try JWT
      const payload = authService.verifyJWT(token);
      req.user = {
        id: payload.sub,
        tenantId: payload.tid,
        scopes: payload.scopes,
        method: 'jwt',
      };
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require specific scopes
 */
export function requireScopes(...scopes: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'Not authenticated', 'unauthorized');
      }

      authService.requireScopes(req.user.scopes, scopes);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Optional authentication (sets user if present)
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.get('authorization');
    if (authHeader) {
      await authenticate(req, _res, () => {});
    }
    next();
  } catch {
    // Ignore auth errors for optional auth
    next();
  }
}
