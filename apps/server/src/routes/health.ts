/**
 * Health check routes
 */

import { Router } from 'express';
import { checkDatabaseHealth } from '../utils/database.js';
import { checkRedisHealth } from '../utils/redis.js';

const router = Router();

// Basic health check
router.get('/health', async (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Detailed health check
router.get('/health/detailed', async (_req, res) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const isHealthy = dbHealth && redisHealth;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: dbHealth ? 'ok' : 'down',
      redis: redisHealth ? 'ok' : 'down',
    },
    version: process.env.APP_VERSION || '1.0.0',
  });
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (_req, res) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  if (dbHealth && redisHealth) {
    res.status(200).send('OK');
  } else {
    res.status(503).send('NOT READY');
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (_req, res) => {
  res.status(200).send('OK');
});

export default router;
