/**
 * Webhook routes for Chargily Pay
 */

import { Router, Request, Response, NextFunction } from 'express';
import { webhookService } from '../../services/webhook.service.js';
import { AppError } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * Webhook endpoint - receives events from Chargily
 * POST /api/v1/webhooks/chargily
 */
router.post('/chargily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get raw body (should be configured in Express)
    const rawBody = JSON.stringify(req.body);

    // Get signature from header
    const signature = req.get('X-Signature') || req.get('x-signature') || '';

    if (!signature) {
      throw new AppError(400, 'Missing webhook signature');
    }

    // Process webhook
    const result = await webhookService.processWebhook(rawBody, signature);

    // Return 200 to acknowledge receipt
    res.json({
      status: 'received',
      eventId: result.event.id,
    });
  } catch (error) {
    logger.error({ error }, 'Webhook processing error');

    // Still return 200 to avoid retries for validation errors
    if (error instanceof AppError && error.statusCode === 400) {
      return res.status(200).json({
        status: 'error',
        message: error.message,
      });
    }

    next(error);
  }
});

/**
 * List webhook logs (admin endpoint - requires authentication)
 * GET /api/v1/webhooks/logs
 */
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await webhookService.listWebhooks({
      eventType: req.query.eventType as string,
      processed: req.query.processed === 'true' ? true : req.query.processed === 'false' ? false : undefined,
      limit: Number(req.query.limit) || 100,
      offset: Number(req.query.offset) || 0,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Get webhook statistics (admin endpoint)
 * GET /api/v1/webhooks/stats
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await webhookService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * Manually retry failed webhooks (admin endpoint)
 * POST /api/v1/webhooks/retry
 */
router.post('/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await webhookService.retryFailedWebhooks();
    res.json({
      status: 'success',
      message: 'Failed webhooks retried',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
