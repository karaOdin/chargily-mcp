/**
 * Authentication middleware
 */

import type { AuthContext } from './types';
import { AuthError } from './types';
import { ApiKeyManager } from './api-key';
import { JWTManager } from './jwt';
import { ScopeManager } from './scopes';

export interface AuthMiddlewareConfig {
  apiKeyManager: ApiKeyManager;
  jwtManager: JWTManager;
  scopeManager: ScopeManager;
  getApiKeyByHash: (hash: string) => Promise<any>;
  getUserById: (userId: string) => Promise<any>;
}

export class AuthMiddleware {
  constructor(private config: AuthMiddlewareConfig) {}

  /**
   * Authenticate request and return auth context
   */
  async authenticate(authHeader: string): Promise<AuthContext> {
    if (!authHeader) {
      throw new AuthError('Missing authorization header', 'unauthorized', 401);
    }

    // Try API key authentication
    const apiKey = this.config.apiKeyManager.extractFromHeader(authHeader);
    if (apiKey) {
      return this.authenticateApiKey(apiKey);
    }

    // Try JWT authentication
    const jwt = this.config.jwtManager.extractFromHeader(authHeader);
    if (jwt) {
      return this.authenticateJWT(jwt);
    }

    throw new AuthError('Invalid authorization format', 'invalid_auth', 401);
  }

  /**
   * Authenticate using API key
   */
  private async authenticateApiKey(plainKey: string): Promise<AuthContext> {
    const hash = this.config.apiKeyManager.hashForLookup(plainKey);
    const storedKey = await this.config.getApiKeyByHash(hash);

    if (!storedKey) {
      throw new AuthError('Invalid API key', 'invalid_api_key', 401);
    }

    return this.config.apiKeyManager.verifyApiKey(plainKey, storedKey);
  }

  /**
   * Authenticate using JWT
   */
  private async authenticateJWT(token: string): Promise<AuthContext> {
    const payload = this.config.jwtManager.verifyToken(token);
    return this.config.jwtManager.toAuthContext(payload);
  }

  /**
   * Authorize request for required scopes
   */
  authorize(authContext: AuthContext, requiredScopes: string[]): void {
    this.config.scopeManager.requireScopes(
      authContext.scopes,
      requiredScopes
    );
  }

  /**
   * Combined authenticate and authorize
   */
  async authenticateAndAuthorize(
    authHeader: string,
    requiredScopes: string[]
  ): Promise<AuthContext> {
    const authContext = await this.authenticate(authHeader);
    this.authorize(authContext, requiredScopes);
    return authContext;
  }

  /**
   * Extract tenant ID from auth context
   */
  getTenantId(authContext: AuthContext): string | undefined {
    return authContext.tenantId;
  }

  /**
   * Check if user is admin
   */
  isAdmin(authContext: AuthContext): boolean {
    return authContext.scopes.includes('admin');
  }
}
