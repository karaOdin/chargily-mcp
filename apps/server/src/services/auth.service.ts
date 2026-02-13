/**
 * Authentication service
 */

import { ApiKeyManager, JWTManager, ScopeManager } from '@chargily/mcp-auth';
import { userRepository, apiKeyRepository } from '../repositories/index.js';
import { config } from '../utils/config.js';
import { AppError } from '../middleware/error-handler.js';
import type { User } from '@prisma/client';

// Initialize auth managers
const apiKeyManager = new ApiKeyManager();
const jwtManager = new JWTManager({
  secret: config.jwtSecret,
  accessTokenTTL: config.jwtAccessTokenTtl,
  refreshTokenTTL: config.jwtRefreshTokenTtl,
  issuer: config.oauthIssuer,
  audience: config.oauthIssuer,
});
const scopeManager = new ScopeManager();

export class AuthService {
  /**
   * Generate API key for user
   */
  async generateApiKey(params: {
    userId: string;
    scopes: string[];
    name?: string;
    expiresIn?: number;
    isTest?: boolean;
  }) {
    // Generate API key
    const { apiKey, plainKey } = await apiKeyManager.generateApiKey(
      params.userId,
      params.scopes,
      {
        name: params.name,
        expiresIn: params.expiresIn,
        isTest: params.isTest,
      }
    );

    // Get user
    const user = await userRepository.findById(params.userId);
    if (!user) {
      throw new AppError(404, 'User not found', 'user_not_found');
    }

    // Store in database with BOTH hashes
    const lookupHash = apiKeyManager.hashForLookup(plainKey);

    const dbApiKey = await apiKeyRepository.create({
      key: apiKey.key,
      lookupHash: lookupHash,  // SHA-256 for fast lookup
      hashedKey: apiKey.hashedKey,  // bcrypt for verification
      name: apiKey.name,
      user: { connect: { id: params.userId } },
      tenantId: user.tenantId,
      scopes: apiKey.scopes,
      isTest: params.isTest || false,
      expiresAt: apiKey.expiresAt,
    });

    return {
      apiKey: dbApiKey,
      plainKey, // Return this ONCE only
    };
  }

  /**
   * Verify API key
   */
  async verifyApiKey(plainKey: string) {
    // Hash the key for lookup
    const hashedKey = apiKeyManager.hashForLookup(plainKey);

    // Find in database
    const storedApiKey = await apiKeyRepository.findByHashedKey(hashedKey);
    if (!storedApiKey) {
      throw new AppError(401, 'Invalid API key', 'invalid_api_key');
    }

    // Verify with manager
    const authContext = await apiKeyManager.verifyApiKey(plainKey, {
      id: storedApiKey.id,
      key: storedApiKey.key,
      hashedKey: storedApiKey.hashedKey,
      userId: storedApiKey.userId,
      tenantId: storedApiKey.tenantId || undefined,
      scopes: storedApiKey.scopes as string[],
      expiresAt: storedApiKey.expiresAt || undefined,
      revokedAt: storedApiKey.revokedAt || undefined,
      createdAt: storedApiKey.createdAt,
    });

    // Update last used
    await apiKeyRepository.updateLastUsed(storedApiKey.id);

    return {
      ...authContext,
      user: storedApiKey.user,
    };
  }

  /**
   * Generate JWT tokens
   */
  generateJWT(user: User) {
    const scopes = ['balance:read', 'customers:*', 'checkouts:*']; // Default scopes

    const accessToken = jwtManager.generateAccessToken(
      user.id,
      scopes,
      user.tenantId || undefined
    );

    const refreshToken = jwtManager.generateRefreshToken(
      user.id,
      scopes,
      user.tenantId || undefined
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: config.jwtAccessTokenTtl,
    };
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token: string) {
    return jwtManager.verifyToken(token);
  }

  /**
   * Check if user has required scopes
   */
  checkScopes(userScopes: string[], requiredScopes: string[]): boolean {
    return scopeManager.hasScopes(userScopes, requiredScopes);
  }

  /**
   * Require scopes (throws error if missing)
   */
  requireScopes(userScopes: string[], requiredScopes: string[]): void {
    scopeManager.requireScopes(userScopes, requiredScopes);
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKeyId: string, revokedBy: string) {
    return apiKeyRepository.revoke(apiKeyId, revokedBy);
  }

  /**
   * List user's API keys
   */
  async listApiKeys(userId: string) {
    return apiKeyRepository.findByUser(userId);
  }
}

export const authService = new AuthService();
