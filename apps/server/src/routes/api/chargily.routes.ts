/**
 * Chargily API routes
 */

import { Router } from 'express';
import { chargilyService } from '../../services/chargily.service.js';
import { AppError } from '../../middleware/error-handler.js';

const router = Router();

// Helper to get user context from request
function getContext(req: any) {
  return {
    userId: req.user?.id || 'system',
    tenantId: req.user?.tenantId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

// ============================================================================
// BALANCE
// ============================================================================

router.get('/balance', async (req, res, next) => {
  try {
    const balance = await chargilyService.getBalance(getContext(req));
    res.json(balance);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// CUSTOMERS
// ============================================================================

router.post('/customers', async (req, res, next) => {
  try {
    const customer = await chargilyService.createCustomer(req.body, getContext(req));
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

router.get('/customers/:id', async (req, res, next) => {
  try {
    const customer = await chargilyService.getCustomer(req.params.id, getContext(req));
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

router.get('/customers', async (req, res, next) => {
  try {
    const customers = await chargilyService.listCustomers(
      {
        page: Number(req.query.page) || 1,
        per_page: Number(req.query.per_page) || 20,
      },
      getContext(req)
    );
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

router.patch('/customers/:id', async (req, res, next) => {
  try {
    const customer = await chargilyService.updateCustomer(
      req.params.id,
      req.body,
      getContext(req)
    );
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

router.delete('/customers/:id', async (req, res, next) => {
  try {
    const result = await chargilyService.deleteCustomer(req.params.id, getContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// PRODUCTS (V2)
// ============================================================================

router.post('/products', async (req, res, next) => {
  try {
    const product = await chargilyService.createProduct(req.body, getContext(req));
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

router.get('/products/:id', async (req, res, next) => {
  try {
    const product = await chargilyService.getProduct(req.params.id, getContext(req));
    res.json(product);
  } catch (error) {
    next(error);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const products = await chargilyService.listProducts(
      {
        page: Number(req.query.page) || 1,
        per_page: Number(req.query.per_page) || 20,
      },
      getContext(req)
    );
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// PRICES (V2)
// ============================================================================

router.post('/prices', async (req, res, next) => {
  try {
    const price = await chargilyService.createPrice(req.body, getContext(req));
    res.status(201).json(price);
  } catch (error) {
    next(error);
  }
});

router.get('/prices/:id', async (req, res, next) => {
  try {
    const price = await chargilyService.getPrice(req.params.id, getContext(req));
    res.json(price);
  } catch (error) {
    next(error);
  }
});

router.get('/prices', async (req, res, next) => {
  try {
    const prices = await chargilyService.listPrices(
      {
        product_id: req.query.product_id as string,
        page: Number(req.query.page) || 1,
        per_page: Number(req.query.per_page) || 20,
      },
      getContext(req)
    );
    res.json(prices);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// CHECKOUTS
// ============================================================================

router.post('/checkouts', async (req, res, next) => {
  try {
    const checkout = await chargilyService.createCheckout(req.body, getContext(req));
    res.status(201).json(checkout);
  } catch (error) {
    next(error);
  }
});

router.get('/checkouts/:id', async (req, res, next) => {
  try {
    const checkout = await chargilyService.getCheckout(req.params.id, getContext(req));
    res.json(checkout);
  } catch (error) {
    next(error);
  }
});

router.get('/checkouts', async (req, res, next) => {
  try {
    const checkouts = await chargilyService.listCheckouts(
      {
        page: Number(req.query.page) || 1,
        per_page: Number(req.query.per_page) || 20,
      },
      getContext(req)
    );
    res.json(checkouts);
  } catch (error) {
    next(error);
  }
});

router.post('/checkouts/:id/expire', async (req, res, next) => {
  try {
    const checkout = await chargilyService.expireCheckout(req.params.id, getContext(req));
    res.json(checkout);
  } catch (error) {
    next(error);
  }
});

export default router;
