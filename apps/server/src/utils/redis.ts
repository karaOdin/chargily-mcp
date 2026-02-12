/**
 * Redis connection management
 */

import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

// Create Redis client
export const redis = new Redis(config.redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

// Event handlers
redis.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error({ error }, '❌ Redis connection error');
});

redis.on('close', () => {
  logger.info('Redis connection closed');
});

// Health check
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return false;
  }
}

// Disconnect
export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis disconnected');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from Redis');
  }
}
