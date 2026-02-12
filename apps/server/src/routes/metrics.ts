/**
 * Metrics routes - Prometheus metrics endpoint
 */

import { Router } from 'express';
import { metricsService } from '../services/metrics.service.js';

const router = Router();

/**
 * Prometheus metrics endpoint
 * GET /metrics
 */
router.get('/metrics', async (_req, res) => {
  try {
    const metrics = await metricsService.getMetrics();

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    res.status(500).send('# Error generating metrics');
  }
});

/**
 * System stats endpoint (JSON format for dashboards)
 * GET /stats
 */
router.get('/stats', async (_req, res) => {
  try {
    const stats = await metricsService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
