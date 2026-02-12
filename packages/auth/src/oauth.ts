/**
 * OAuth 2.1 implementation
 */

import { randomBytes } from 'crypto';
import type { OAuthToken, OAuthAuthorizationCode, AuthContext } from './types';
import { AuthError } from './types';

export interface OAuthConfig {
  authorizationCodeTTL: number; // seconds
  accessTokenTTL: number; // seconds
  refreshTokenTTL: number; // seconds
}

export class OAuthManager {
  constructor(private config: OAuthConfig) {}

  /**
   * Generate authorization code
   */
  generateAuthorizationCode(
    clientId: string,
    userId: string,
    redirectUri: string,
    scopes: string[]
  ): OAuthAuthorizationCode {
    const code = this.generateSecureToken();

    return {
      code,
      clientId,
      userId,
      redirectUri,
      scopes,
      expiresAt: new Date(
        Date.now() + this.config.authorizationCodeTTL * 1000
      ),
      createdAt: new Date(),
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    _code: string,
    clientId: string,
    redirectUri: string,
    storedCode: OAuthAuthorizationCode
  ): Promise<OAuthToken> {
    // Validate code
    if (storedCode.usedAt) {
      throw new AuthError(
        'Authorization code already used',
        'invalid_grant',
        400
      );
    }

    if (storedCode.expiresAt < new Date()) {
      throw new AuthError(
        'Authorization code expired',
        'invalid_grant',
        400
      );
    }

    if (storedCode.clientId !== clientId) {
      throw new AuthError(
        'Invalid client',
        'invalid_client',
        401
      );
    }

    if (storedCode.redirectUri !== redirectUri) {
      throw new AuthError(
        'Invalid redirect URI',
        'invalid_grant',
        400
      );
    }

    // Generate tokens
    const accessToken = this.generateSecureToken();
    const refreshToken = this.generateSecureToken();

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenTTL,
      scope: storedCode.scopes.join(' '),
      createdAt: new Date(),
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    _refreshToken: string,
    storedToken: OAuthToken
  ): Promise<OAuthToken> {
    const newAccessToken = this.generateSecureToken();

    return {
      accessToken: newAccessToken,
      refreshToken: storedToken.refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenTTL,
      scope: storedToken.scope,
      createdAt: new Date(),
    };
  }

  /**
   * Validate access token
   */
  validateAccessToken(token: OAuthToken): AuthContext {
    const expiresAt = new Date(
      token.createdAt.getTime() + token.expiresIn * 1000
    );

    if (expiresAt < new Date()) {
      throw new AuthError('Access token expired', 'token_expired', 401);
    }

    return {
      userId: '', // Would be retrieved from token storage
      scopes: token.scope.split(' '),
      method: 'oauth',
      expiresAt,
    };
  }

  /**
   * Build authorization URL
   */
  buildAuthorizationUrl(
    authEndpoint: string,
    clientId: string,
    redirectUri: string,
    scopes: string[],
    state?: string
  ): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      ...(state && { state }),
    });

    return `${authEndpoint}?${params.toString()}`;
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
