/**
 * Authentication routes
 */

import { Router } from 'express';
import { authService } from '../../services/auth.service.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { AppError } from '../../middleware/error-handler.js';

const router = Router();

/**
 * Generate API key
 */
router.post('/api-keys', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated', 'unauthorized');
    }

    const { name, scopes, expiresIn, isTest } = req.body;

    const result = await authService.generateApiKey({
      userId: req.user.id,
      name,
      scopes: scopes || ['balance:read', 'customers:*', 'checkouts:*'],
      expiresIn,
      isTest,
    });

    res.status(201).json({
      apiKey: {
        id: result.apiKey.id,
        key: result.plainKey, // IMPORTANT: Only returned once!
        name: result.apiKey.name,
        scopes: result.apiKey.scopes,
        expiresAt: result.apiKey.expiresAt,
        createdAt: result.apiKey.createdAt,
      },
      message: 'API key created. Save this key securely - it will not be shown again.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * List API keys
 */
router.get('/api-keys', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated', 'unauthorized');
    }

    const apiKeys = await authService.listApiKeys(req.user.id);

    res.json({
      apiKeys: apiKeys.map((key) => ({
        id: key.id,
        key: key.key, // Masked key
        name: key.name,
        scopes: key.scopes,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Revoke API key
 */
router.delete('/api-keys/:id', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated', 'unauthorized');
    }

    await authService.revokeApiKey(req.params.id, req.user.id);

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Verify token (for testing)
 */
router.get('/verify', authenticate, async (req, res) => {
  res.json({
    authenticated: true,
    user: req.user,
  });
});

export default router;
