/**
 * Authentication routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../../services/auth.service.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { AppError } from '../../middleware/error-handler.js';
import { authRateLimiter } from '../../middleware/rate-limit.js';
import { userRepository } from '../../repositories/index.js';
import bcrypt from 'bcryptjs';

const router = Router();

// Apply strict rate limiting to all auth endpoints (5 requests per 15 minutes)
router.use(authRateLimiter.middleware());

/**
 * Signup - Create new user account
 */
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      throw new AppError(400, 'Email and password are required', 'validation_error');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await userRepository.create({
      email,
      password: hashedPassword,
      name,
      chargilyMode: 'sandbox', // Start in sandbox mode
    });

    // Generate JWT for immediate login
    const tokens = authService.generateJWT(user);

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Login - Get JWT token
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(400, 'Email and password are required', 'validation_error');
    }

    // Find user
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new AppError(401, 'Invalid credentials', 'invalid_credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      throw new AppError(401, 'Invalid credentials', 'invalid_credentials');
    }

    // Generate JWT
    const tokens = authService.generateJWT(user);

    // Update last login
    await userRepository.update(user.id, { lastLogin: new Date() });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        chargilyMode: user.chargilyMode,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Generate API key
 */
router.post('/api-keys', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/api-keys', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
router.delete('/api-keys/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
 * Get current user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated', 'unauthorized');
    }

    const user = await userRepository.findById(req.user.id);

    if (!user) {
      throw new AppError(404, 'User not found', 'user_not_found');
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        chargilyMode: user.chargilyMode,
        hasChargilyKey: !!user.chargilyApiKey,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update user settings (Chargily API key, mode, etc.)
 */
router.patch('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated', 'unauthorized');
    }

    const { chargilyApiKey, chargilyMode, name } = req.body;
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (chargilyMode !== undefined) {
      if (!['sandbox', 'production'].includes(chargilyMode)) {
        throw new AppError(400, 'Invalid mode. Must be sandbox or production', 'validation_error');
      }
      updateData.chargilyMode = chargilyMode;
    }
    if (chargilyApiKey !== undefined) {
      // TODO: Encrypt the API key before storing
      updateData.chargilyApiKey = chargilyApiKey;
    }

    const user = await userRepository.update(req.user.id, updateData);

    res.json({
      message: 'Settings updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        chargilyMode: user.chargilyMode,
        hasChargilyKey: !!user.chargilyApiKey,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Verify token (for testing)
 */
router.get('/verify', authenticate, async (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    user: req.user,
  });
});

export default router;
