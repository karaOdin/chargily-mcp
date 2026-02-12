/**
 * API routes index
 */

import { Router } from 'express';
import chargilyRoutes from './chargily.routes.js';
import authRoutes from './auth.routes.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

// Auth routes (public)
router.use('/auth', authRoutes);

// Protected Chargily routes
router.use('/chargily', authenticate, chargilyRoutes);

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
      checkouts: {
        create: 'POST /api/v1/chargily/checkouts',
        get: 'GET /api/v1/chargily/checkouts/:id',
        list: 'GET /api/v1/chargily/checkouts',
        expire: 'POST /api/v1/chargily/checkouts/:id/expire',
      },
    },
  });
});

export default router;
