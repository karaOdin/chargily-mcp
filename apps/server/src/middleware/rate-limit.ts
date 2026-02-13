/**
 * Rate Limiting Middleware
 * Token bucket algorithm using Redis
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../utils/redis.js';
import { logger } from '../utils/logger.js';

export interface RateLimitConfig {
  points: number; // Number of requests allowed
  duration: number; // Time window in seconds
  blockDuration?: number; // Block duration in seconds after limit exceeded
}

const DEFAULT_CONFIG: RateLimitConfig = {
  points: 100, // 100 requests
  duration: 60, // per minute
  blockDuration: 60, // block for 1 minute
};

export class RateLimiter {
  private config: RateLimitConfig;
  private keyPrefix: string;

  constructor(config: Partial<RateLimitConfig> = {}, keyPrefix = 'ratelimit') {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.keyPrefix = keyPrefix;
  }

  /**
   * Create Express middleware
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Get identifier (user ID, API key, or IP)
        const identifier = this.getIdentifier(req);

        // Check rate limit
        const result = await this.consume(identifier);

        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', this.config.points);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetAt);

        if (!result.allowed) {
          res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
            retryAfter: result.retryAfter,
          });
          return;
        }

        next();
      } catch (error) {
        // On error, allow request but log
        logger.error({ error }, 'Rate limit check failed');
        next();
      }
    };
  }

  /**
   * Consume a token from the bucket
   */
  private async consume(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter: number;
  }> {
    const key = `${this.keyPrefix}:${identifier}`;
    const now = Date.now();

    if (!redis) {
      // Redis not available, allow request
      return {
        allowed: true,
        remaining: this.config.points,
        resetAt: now + this.config.duration * 1000,
        retryAfter: 0,
      };
    }

    // Get current state
    const data = await redis.get(key);
    let state: { tokens: number; lastRefill: number } = data
      ? JSON.parse(data)
      : { tokens: this.config.points, lastRefill: now };

    // Calculate tokens to add based on time elapsed
    const elapsed = (now - state.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsed / this.config.duration * this.config.points);

    if (tokensToAdd > 0) {
      state.tokens = Math.min(state.tokens + tokensToAdd, this.config.points);
      state.lastRefill = now;
    }

    // Check if request can be allowed
    const allowed = state.tokens > 0;

    if (allowed) {
      state.tokens -= 1;
    }

    // Save state
    await redis.setex(
      key,
      this.config.duration * 2, // TTL double the window
      JSON.stringify(state)
    );

    // Calculate reset time
    const resetAt = state.lastRefill + this.config.duration * 1000;
    const retryAfter = allowed
      ? 0
      : Math.ceil((resetAt - now) / 1000);

    return {
      allowed,
      remaining: Math.max(0, state.tokens),
      resetAt,
      retryAfter,
    };
  }

  /**
   * Get identifier for rate limiting
   */
  private getIdentifier(req: Request): string {
    // Try user ID from auth context
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    // Try API key
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const key = authHeader.substring(7);
      return `apikey:${key.substring(0, 16)}`;
    }

    // Fallback to IP address
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `${this.keyPrefix}:${identifier}`;
    if (redis) {
      await redis.del(key);
    }
  }

  /**
   * Get current state for an identifier
   */
  async getState(identifier: string): Promise<{
    tokens: number;
    limit: number;
    resetAt: number;
  } | null> {
    const key = `${this.keyPrefix}:${identifier}`;

    if (!redis) {
      return null;
    }

    const data = await redis.get(key);
    if (!data) {
      return {
        tokens: this.config.points,
        limit: this.config.points,
        resetAt: Date.now() + this.config.duration * 1000,
      };
    }

    const state: { tokens: number; lastRefill: number } = JSON.parse(data);
    return {
      tokens: state.tokens,
      limit: this.config.points,
      resetAt: state.lastRefill + this.config.duration * 1000,
    };
  }
}

/**
 * Pre-configured rate limiters
 */

// General API rate limiter (100 req/min)
export const apiRateLimiter = new RateLimiter({
  points: 100,
  duration: 60,
});

// Strict rate limiter for sensitive operations (10 req/min)
export const strictRateLimiter = new RateLimiter({
  points: 10,
  duration: 60,
  blockDuration: 300, // 5 minutes
}, 'ratelimit:strict');

// Auth endpoints rate limiter (5 attempts per 15 min)
export const authRateLimiter = new RateLimiter({
  points: 5,
  duration: 900, // 15 minutes
  blockDuration: 3600, // 1 hour
}, 'ratelimit:auth');

// Webhook rate limiter (1000 req/min for high volume)
export const webhookRateLimiter = new RateLimiter({
  points: 1000,
  duration: 60,
}, 'ratelimit:webhook');

/**
 * Apply rate limiting based on MCP tool limits
 */
export function toolRateLimiter(toolRateLimit: number) {
  return new RateLimiter({
    points: toolRateLimit,
    duration: 60,
  }, 'ratelimit:tool').middleware();
}
