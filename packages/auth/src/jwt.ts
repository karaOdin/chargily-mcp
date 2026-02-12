/**
 * JWT authentication
 */

import jwt from 'jsonwebtoken';
import type { JWTPayload, AuthContext } from './types';
import { AuthError } from './types';

export interface JWTConfig {
  secret: string;
  issuer: string;
  audience: string;
  accessTokenTTL: number; // seconds
  refreshTokenTTL: number; // seconds
}

export class JWTManager {
  constructor(private config: JWTConfig) {}

  /**
   * Generate access token
   */
  generateAccessToken(
    userId: string,
    scopes: string[],
    tenantId?: string
  ): string {
    const payload: JWTPayload = {
      sub: userId,
      tid: tenantId,
      scopes,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.accessTokenTTL,
      iss: this.config.issuer,
      aud: this.config.audience,
    };

    return jwt.sign(payload, this.config.secret, {
      algorithm: 'HS256',
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(
    userId: string,
    tenantId?: string
  ): string {
    const payload = {
      sub: userId,
      tid: tenantId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenTTL,
      iss: this.config.issuer,
      aud: this.config.audience,
    };

    return jwt.sign(payload, this.config.secret, {
      algorithm: 'HS256',
    });
  }

  /**
   * Verify and decode JWT
   */
  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.config.secret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['HS256'],
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError('Token has expired', 'token_expired', 401);
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError('Invalid token', 'invalid_token', 401);
      }
      throw new AuthError('Token verification failed', 'token_error', 401);
    }
  }

  /**
   * Convert JWT payload to auth context
   */
  toAuthContext(payload: JWTPayload): AuthContext {
    return {
      userId: payload.sub,
      tenantId: payload.tid,
      scopes: payload.scopes,
      method: 'jwt',
      expiresAt: new Date(payload.exp * 1000),
    };
  }

  /**
   * Extract JWT from Authorization header
   */
  extractFromHeader(authHeader: string): string | null {
    if (!authHeader) return null;

    const match = authHeader.match(/^Bearer (.+)$/);
    return match ? match[1] : null;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    getUserScopes: (userId: string, tenantId?: string) => Promise<string[]>
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.verifyToken(refreshToken);

    if ((payload as any).type !== 'refresh') {
      throw new AuthError('Invalid refresh token', 'invalid_token', 401);
    }

    // Get current scopes for user
    const scopes = await getUserScopes(payload.sub, payload.tid);

    const newAccessToken = this.generateAccessToken(
      payload.sub,
      scopes,
      payload.tid
    );
    const newRefreshToken = this.generateRefreshToken(payload.sub, payload.tid);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
