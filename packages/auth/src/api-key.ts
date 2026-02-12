/**
 * API Key authentication
 */

import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import type { ApiKey, AuthContext } from './types';
import { AuthError } from './types';

export class ApiKeyManager {
  private readonly testPrefix = 'test_sk_';
  private readonly livePrefix = 'live_sk_';

  /**
   * Generate a new API key
   */
  async generateApiKey(
    userId: string,
    scopes: string[],
    options?: {
      tenantId?: string;
      name?: string;
      expiresIn?: number; // seconds
      isTest?: boolean;
    }
  ): Promise<{ apiKey: ApiKey; plainKey: string }> {
    const prefix = options?.isTest ? this.testPrefix : this.livePrefix;
    const randomPart = randomBytes(32).toString('hex');
    const plainKey = `${prefix}${randomPart}`;

    const hashedKey = await bcrypt.hash(plainKey, 10);

    const apiKey: ApiKey = {
      id: this.generateId(),
      key: plainKey.substring(0, 16) + '...',
      hashedKey,
      userId,
      tenantId: options?.tenantId,
      scopes,
      name: options?.name,
      expiresAt: options?.expiresIn
        ? new Date(Date.now() + options.expiresIn * 1000)
        : undefined,
      createdAt: new Date(),
    };

    return { apiKey, plainKey };
  }

  /**
   * Verify API key and return auth context
   */
  async verifyApiKey(
    plainKey: string,
    storedApiKey: ApiKey
  ): Promise<AuthContext> {
    // Check if revoked
    if (storedApiKey.revokedAt) {
      throw new AuthError('API key has been revoked', 'api_key_revoked', 401);
    }

    // Check if expired
    if (storedApiKey.expiresAt && storedApiKey.expiresAt < new Date()) {
      throw new AuthError('API key has expired', 'api_key_expired', 401);
    }

    // Verify hash
    const isValid = await bcrypt.compare(plainKey, storedApiKey.hashedKey);
    if (!isValid) {
      throw new AuthError('Invalid API key', 'invalid_api_key', 401);
    }

    return {
      userId: storedApiKey.userId,
      tenantId: storedApiKey.tenantId,
      scopes: storedApiKey.scopes,
      method: 'api_key',
      expiresAt: storedApiKey.expiresAt,
    };
  }

  /**
   * Extract API key from Authorization header
   */
  extractFromHeader(authHeader: string): string | null {
    if (!authHeader) return null;

    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return null;

    const key = match[1];
    if (
      !key.startsWith(this.testPrefix) &&
      !key.startsWith(this.livePrefix)
    ) {
      return null;
    }

    return key;
  }

  /**
   * Hash API key for lookup
   */
  hashForLookup(plainKey: string): string {
    return createHash('sha256').update(plainKey).digest('hex');
  }

  private generateId(): string {
    return `key_${randomBytes(16).toString('hex')}`;
  }
}
