/**
 * Authentication and authorization types
 */

export type AuthMethod = 'api_key' | 'oauth' | 'jwt';

export interface AuthContext {
  userId: string;
  tenantId?: string;
  scopes: string[];
  method: AuthMethod;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface ApiKey {
  id: string;
  key: string;
  hashedKey: string;
  userId: string;
  tenantId?: string;
  scopes: string[];
  name?: string;
  expiresAt?: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
}

export interface JWTPayload {
  sub: string; // user ID
  tid?: string; // tenant ID
  scopes: string[];
  iat: number; // issued at
  exp: number; // expires at
  iss: string; // issuer
  aud: string; // audience
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
  createdAt: Date;
}

export interface OAuthAuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: Date;
  createdAt: Date;
  usedAt?: Date;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
