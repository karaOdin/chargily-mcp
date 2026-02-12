/**
 * Authentication and authorization types
 */
type AuthMethod = 'api_key' | 'oauth' | 'jwt';
interface AuthContext {
    userId: string;
    tenantId?: string;
    scopes: string[];
    method: AuthMethod;
    expiresAt?: Date;
    metadata?: Record<string, any>;
}
interface ApiKey {
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
interface JWTPayload {
    sub: string;
    tid?: string;
    scopes: string[];
    iat: number;
    exp: number;
    iss: string;
    aud: string;
}
interface OAuthToken {
    accessToken: string;
    refreshToken?: string;
    tokenType: 'Bearer';
    expiresIn: number;
    scope: string;
    createdAt: Date;
}
interface OAuthAuthorizationCode {
    code: string;
    clientId: string;
    userId: string;
    redirectUri: string;
    scopes: string[];
    expiresAt: Date;
    createdAt: Date;
    usedAt?: Date;
}
declare class AuthError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode?: number);
}

/**
 * API Key authentication
 */

declare class ApiKeyManager {
    private readonly testPrefix;
    private readonly livePrefix;
    /**
     * Generate a new API key
     */
    generateApiKey(userId: string, scopes: string[], options?: {
        tenantId?: string;
        name?: string;
        expiresIn?: number;
        isTest?: boolean;
    }): Promise<{
        apiKey: ApiKey;
        plainKey: string;
    }>;
    /**
     * Verify API key and return auth context
     */
    verifyApiKey(plainKey: string, storedApiKey: ApiKey): Promise<AuthContext>;
    /**
     * Extract API key from Authorization header
     */
    extractFromHeader(authHeader: string): string | null;
    /**
     * Hash API key for lookup
     */
    hashForLookup(plainKey: string): string;
    private generateId;
}

/**
 * JWT authentication
 */

interface JWTConfig {
    secret: string;
    issuer: string;
    audience: string;
    accessTokenTTL: number;
    refreshTokenTTL: number;
}
declare class JWTManager {
    private config;
    constructor(config: JWTConfig);
    /**
     * Generate access token
     */
    generateAccessToken(userId: string, scopes: string[], tenantId?: string): string;
    /**
     * Generate refresh token
     */
    generateRefreshToken(userId: string, tenantId?: string): string;
    /**
     * Verify and decode JWT
     */
    verifyToken(token: string): JWTPayload;
    /**
     * Convert JWT payload to auth context
     */
    toAuthContext(payload: JWTPayload): AuthContext;
    /**
     * Extract JWT from Authorization header
     */
    extractFromHeader(authHeader: string): string | null;
    /**
     * Refresh access token using refresh token
     */
    refreshAccessToken(refreshToken: string, getUserScopes: (userId: string, tenantId?: string) => Promise<string[]>): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
}

/**
 * OAuth 2.1 implementation
 */

interface OAuthConfig {
    authorizationCodeTTL: number;
    accessTokenTTL: number;
    refreshTokenTTL: number;
}
declare class OAuthManager {
    private config;
    constructor(config: OAuthConfig);
    /**
     * Generate authorization code
     */
    generateAuthorizationCode(clientId: string, userId: string, redirectUri: string, scopes: string[]): OAuthAuthorizationCode;
    /**
     * Exchange authorization code for tokens
     */
    exchangeCodeForTokens(_code: string, clientId: string, redirectUri: string, storedCode: OAuthAuthorizationCode): Promise<OAuthToken>;
    /**
     * Refresh access token
     */
    refreshToken(_refreshToken: string, storedToken: OAuthToken): Promise<OAuthToken>;
    /**
     * Validate access token
     */
    validateAccessToken(token: OAuthToken): AuthContext;
    /**
     * Build authorization URL
     */
    buildAuthorizationUrl(authEndpoint: string, clientId: string, redirectUri: string, scopes: string[], state?: string): string;
    private generateSecureToken;
}

/**
 * Scope management and validation
 */
declare const SCOPES: {
    readonly BALANCE_READ: "balance:read";
    readonly CUSTOMERS_READ: "customers:read";
    readonly CUSTOMERS_WRITE: "customers:write";
    readonly CUSTOMERS_DELETE: "customers:delete";
    readonly PRODUCTS_READ: "products:read";
    readonly PRODUCTS_WRITE: "products:write";
    readonly PRODUCTS_DELETE: "products:delete";
    readonly PRICES_READ: "prices:read";
    readonly PRICES_WRITE: "prices:write";
    readonly CHECKOUTS_READ: "checkouts:read";
    readonly CHECKOUTS_CREATE: "checkouts:create";
    readonly CHECKOUTS_CANCEL: "checkouts:cancel";
    readonly CHECKOUTS_EXPIRE: "checkouts:expire";
    readonly PAYMENT_LINKS_READ: "payment_links:read";
    readonly PAYMENT_LINKS_CREATE: "payment_links:create";
    readonly PAYMENT_LINKS_WRITE: "payment_links:write";
    readonly WEBHOOKS_READ: "webhooks:read";
    readonly WEBHOOKS_CONFIGURE: "webhooks:configure";
    readonly REPORTS_READ: "reports:read";
    readonly ANALYTICS_READ: "analytics:read";
    readonly SETTLEMENTS_READ: "settlements:read";
    readonly ADMIN: "admin";
};
type Scope = typeof SCOPES[keyof typeof SCOPES];
declare class ScopeManager {
    /**
     * Check if user has required scopes
     */
    hasScopes(userScopes: string[], requiredScopes: string[]): boolean;
    /**
     * Require scopes or throw error
     */
    requireScopes(userScopes: string[], requiredScopes: string[]): void;
    /**
     * Expand wildcard scopes
     */
    expandScopes(scopes: string[]): string[];
    /**
     * Validate scope format
     */
    validateScope(scope: string): boolean;
    /**
     * Get all available scopes
     */
    getAllScopes(): string[];
    /**
     * Group scopes by resource
     */
    groupByResource(scopes: string[]): Record<string, string[]>;
}

/**
 * Authentication middleware
 */

interface AuthMiddlewareConfig {
    apiKeyManager: ApiKeyManager;
    jwtManager: JWTManager;
    scopeManager: ScopeManager;
    getApiKeyByHash: (hash: string) => Promise<any>;
    getUserById: (userId: string) => Promise<any>;
}
declare class AuthMiddleware {
    private config;
    constructor(config: AuthMiddlewareConfig);
    /**
     * Authenticate request and return auth context
     */
    authenticate(authHeader: string): Promise<AuthContext>;
    /**
     * Authenticate using API key
     */
    private authenticateApiKey;
    /**
     * Authenticate using JWT
     */
    private authenticateJWT;
    /**
     * Authorize request for required scopes
     */
    authorize(authContext: AuthContext, requiredScopes: string[]): void;
    /**
     * Combined authenticate and authorize
     */
    authenticateAndAuthorize(authHeader: string, requiredScopes: string[]): Promise<AuthContext>;
    /**
     * Extract tenant ID from auth context
     */
    getTenantId(authContext: AuthContext): string | undefined;
    /**
     * Check if user is admin
     */
    isAdmin(authContext: AuthContext): boolean;
}

export { type ApiKey, ApiKeyManager, type AuthContext, AuthError, type AuthMethod, AuthMiddleware, type AuthMiddlewareConfig, type JWTConfig, JWTManager, type JWTPayload, type OAuthAuthorizationCode, type OAuthConfig, OAuthManager, type OAuthToken, SCOPES, type Scope, ScopeManager };
