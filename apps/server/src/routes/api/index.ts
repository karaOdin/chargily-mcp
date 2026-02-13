/**
 * API routes index
 */

import { Router } from 'express';
import chargilyRoutes from './chargily.routes.js';
import authRoutes from './auth.routes.js';
import webhookRoutes from './webhooks.routes.js';
import approvalsRoutes from './approvals.routes.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

// Auth routes (public)
router.use('/auth', authRoutes);

// Webhook routes (public endpoint for Chargily, protected admin endpoints)
router.use('/webhooks', webhookRoutes);

// Protected Chargily routes
router.use('/chargily', authenticate, chargilyRoutes);

// Approval workflow routes (protected)
router.use('/approvals', approvalsRoutes);

// API info
router.get('/', (_req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: {
      balance: 'GET /api/v1/chargily/balance',
      customers: {
        create: 'POST /api/v1/chargily/customers',
        get: 'GET /api/v1/chargily/customers/:id',
        list: 'GET /api/v1/chargily/customers',
        update: 'PATCH /api/v1/chargily/customers/:id',
        delete: 'DELETE /api/v1/chargily/customers/:id',
      },
      products: {
        create: 'POST /api/v1/chargily/products',
        get: 'GET /api/v1/chargily/products/:id',
        list: 'GET /api/v1/chargily/products',
      },
      prices: {
        create: 'POST /api/v1/chargily/prices',
        get: 'GET /api/v1/chargily/prices/:id',
        list: 'GET /api/v1/chargily/prices',
      },
      checkouts: {
        create: 'POST /api/v1/chargily/checkouts',
        get: 'GET /api/v1/chargily/checkouts/:id',
        list: 'GET /api/v1/chargily/checkouts',
        expire: 'POST /api/v1/chargily/checkouts/:id/expire',
      },
      paymentLinks: {
        create: 'POST /api/v1/chargily/payment-links',
        get: 'GET /api/v1/chargily/payment-links/:id',
        list: 'GET /api/v1/chargily/payment-links',
        update: 'PATCH /api/v1/chargily/payment-links/:id',
      },
      webhooks: {
        receive: 'POST /api/v1/webhooks/chargily',
        logs: 'GET /api/v1/webhooks/logs',
        stats: 'GET /api/v1/webhooks/stats',
        retry: 'POST /api/v1/webhooks/retry',
      },
      approvals: {
        pending: 'GET /api/v1/approvals/pending',
        approve: 'POST /api/v1/approvals/:id/approve',
        reject: 'POST /api/v1/approvals/:id/reject',
        stats: 'GET /api/v1/approvals/stats',
      },
    },
  });
});

export default router;
