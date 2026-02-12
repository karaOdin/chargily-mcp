import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// src/types.ts
var AuthError = class extends Error {
  constructor(message, code, statusCode = 401) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "AuthError";
  }
};
var ApiKeyManager = class {
  testPrefix = "test_sk_";
  livePrefix = "live_sk_";
  /**
   * Generate a new API key
   */
  async generateApiKey(userId, scopes, options) {
    const prefix = options?.isTest ? this.testPrefix : this.livePrefix;
    const randomPart = randomBytes(32).toString("hex");
    const plainKey = `${prefix}${randomPart}`;
    const hashedKey = await bcrypt.hash(plainKey, 10);
    const apiKey = {
      id: this.generateId(),
      key: plainKey.substring(0, 16) + "...",
      hashedKey,
      userId,
      tenantId: options?.tenantId,
      scopes,
      name: options?.name,
      expiresAt: options?.expiresIn ? new Date(Date.now() + options.expiresIn * 1e3) : void 0,
      createdAt: /* @__PURE__ */ new Date()
    };
    return { apiKey, plainKey };
  }
  /**
   * Verify API key and return auth context
   */
  async verifyApiKey(plainKey, storedApiKey) {
    if (storedApiKey.revokedAt) {
      throw new AuthError("API key has been revoked", "api_key_revoked", 401);
    }
    if (storedApiKey.expiresAt && storedApiKey.expiresAt < /* @__PURE__ */ new Date()) {
      throw new AuthError("API key has expired", "api_key_expired", 401);
    }
    const isValid = await bcrypt.compare(plainKey, storedApiKey.hashedKey);
    if (!isValid) {
      throw new AuthError("Invalid API key", "invalid_api_key", 401);
    }
    return {
      userId: storedApiKey.userId,
      tenantId: storedApiKey.tenantId,
      scopes: storedApiKey.scopes,
      method: "api_key",
      expiresAt: storedApiKey.expiresAt
    };
  }
  /**
   * Extract API key from Authorization header
   */
  extractFromHeader(authHeader) {
    if (!authHeader) return null;
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return null;
    const key = match[1];
    if (!key.startsWith(this.testPrefix) && !key.startsWith(this.livePrefix)) {
      return null;
    }
    return key;
  }
  /**
   * Hash API key for lookup
   */
  hashForLookup(plainKey) {
    return createHash("sha256").update(plainKey).digest("hex");
  }
  generateId() {
    return `key_${randomBytes(16).toString("hex")}`;
  }
};
var JWTManager = class {
  constructor(config) {
    this.config = config;
  }
  /**
   * Generate access token
   */
  generateAccessToken(userId, scopes, tenantId) {
    const payload = {
      sub: userId,
      tid: tenantId,
      scopes,
      iat: Math.floor(Date.now() / 1e3),
      exp: Math.floor(Date.now() / 1e3) + this.config.accessTokenTTL,
      iss: this.config.issuer,
      aud: this.config.audience
    };
    return jwt.sign(payload, this.config.secret, {
      algorithm: "HS256"
    });
  }
  /**
   * Generate refresh token
   */
  generateRefreshToken(userId, tenantId) {
    const payload = {
      sub: userId,
      tid: tenantId,
      type: "refresh",
      iat: Math.floor(Date.now() / 1e3),
      exp: Math.floor(Date.now() / 1e3) + this.config.refreshTokenTTL,
      iss: this.config.issuer,
      aud: this.config.audience
    };
    return jwt.sign(payload, this.config.secret, {
      algorithm: "HS256"
    });
  }
  /**
   * Verify and decode JWT
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.config.secret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ["HS256"]
      });
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError("Token has expired", "token_expired", 401);
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError("Invalid token", "invalid_token", 401);
      }
      throw new AuthError("Token verification failed", "token_error", 401);
    }
  }
  /**
   * Convert JWT payload to auth context
   */
  toAuthContext(payload) {
    return {
      userId: payload.sub,
      tenantId: payload.tid,
      scopes: payload.scopes,
      method: "jwt",
      expiresAt: new Date(payload.exp * 1e3)
    };
  }
  /**
   * Extract JWT from Authorization header
   */
  extractFromHeader(authHeader) {
    if (!authHeader) return null;
    const match = authHeader.match(/^Bearer (.+)$/);
    return match ? match[1] : null;
  }
  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken, getUserScopes) {
    const payload = this.verifyToken(refreshToken);
    if (payload.type !== "refresh") {
      throw new AuthError("Invalid refresh token", "invalid_token", 401);
    }
    const scopes = await getUserScopes(payload.sub, payload.tid);
    const newAccessToken = this.generateAccessToken(
      payload.sub,
      scopes,
      payload.tid
    );
    const newRefreshToken = this.generateRefreshToken(payload.sub, payload.tid);
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }
};
var OAuthManager = class {
  constructor(config) {
    this.config = config;
  }
  /**
   * Generate authorization code
   */
  generateAuthorizationCode(clientId, userId, redirectUri, scopes) {
    const code = this.generateSecureToken();
    return {
      code,
      clientId,
      userId,
      redirectUri,
      scopes,
      expiresAt: new Date(
        Date.now() + this.config.authorizationCodeTTL * 1e3
      ),
      createdAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(_code, clientId, redirectUri, storedCode) {
    if (storedCode.usedAt) {
      throw new AuthError(
        "Authorization code already used",
        "invalid_grant",
        400
      );
    }
    if (storedCode.expiresAt < /* @__PURE__ */ new Date()) {
      throw new AuthError(
        "Authorization code expired",
        "invalid_grant",
        400
      );
    }
    if (storedCode.clientId !== clientId) {
      throw new AuthError(
        "Invalid client",
        "invalid_client",
        401
      );
    }
    if (storedCode.redirectUri !== redirectUri) {
      throw new AuthError(
        "Invalid redirect URI",
        "invalid_grant",
        400
      );
    }
    const accessToken = this.generateSecureToken();
    const refreshToken = this.generateSecureToken();
    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.config.accessTokenTTL,
      scope: storedCode.scopes.join(" "),
      createdAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Refresh access token
   */
  async refreshToken(_refreshToken, storedToken) {
    const newAccessToken = this.generateSecureToken();
    return {
      accessToken: newAccessToken,
      refreshToken: storedToken.refreshToken,
      tokenType: "Bearer",
      expiresIn: this.config.accessTokenTTL,
      scope: storedToken.scope,
      createdAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Validate access token
   */
  validateAccessToken(token) {
    const expiresAt = new Date(
      token.createdAt.getTime() + token.expiresIn * 1e3
    );
    if (expiresAt < /* @__PURE__ */ new Date()) {
      throw new AuthError("Access token expired", "token_expired", 401);
    }
    return {
      userId: "",
      // Would be retrieved from token storage
      scopes: token.scope.split(" "),
      method: "oauth",
      expiresAt
    };
  }
  /**
   * Build authorization URL
   */
  buildAuthorizationUrl(authEndpoint, clientId, redirectUri, scopes, state) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      ...state && { state }
    });
    return `${authEndpoint}?${params.toString()}`;
  }
  generateSecureToken() {
    return randomBytes(32).toString("base64url");
  }
};

// src/scopes.ts
var SCOPES = {
  // Balance
  BALANCE_READ: "balance:read",
  // Customers
  CUSTOMERS_READ: "customers:read",
  CUSTOMERS_WRITE: "customers:write",
  CUSTOMERS_DELETE: "customers:delete",
  // Products
  PRODUCTS_READ: "products:read",
  PRODUCTS_WRITE: "products:write",
  PRODUCTS_DELETE: "products:delete",
  // Prices
  PRICES_READ: "prices:read",
  PRICES_WRITE: "prices:write",
  // Checkouts
  CHECKOUTS_READ: "checkouts:read",
  CHECKOUTS_CREATE: "checkouts:create",
  CHECKOUTS_CANCEL: "checkouts:cancel",
  CHECKOUTS_EXPIRE: "checkouts:expire",
  // Payment Links
  PAYMENT_LINKS_READ: "payment_links:read",
  PAYMENT_LINKS_CREATE: "payment_links:create",
  PAYMENT_LINKS_WRITE: "payment_links:write",
  // Webhooks
  WEBHOOKS_READ: "webhooks:read",
  WEBHOOKS_CONFIGURE: "webhooks:configure",
  // Reports
  REPORTS_READ: "reports:read",
  // Analytics
  ANALYTICS_READ: "analytics:read",
  // Settlements
  SETTLEMENTS_READ: "settlements:read",
  // Admin
  ADMIN: "admin"
};
var SCOPE_HIERARCHY = {
  "admin": Object.values(SCOPES),
  "customers:*": [
    SCOPES.CUSTOMERS_READ,
    SCOPES.CUSTOMERS_WRITE,
    SCOPES.CUSTOMERS_DELETE
  ],
  "products:*": [
    SCOPES.PRODUCTS_READ,
    SCOPES.PRODUCTS_WRITE,
    SCOPES.PRODUCTS_DELETE
  ],
  "checkouts:*": [
    SCOPES.CHECKOUTS_READ,
    SCOPES.CHECKOUTS_CREATE,
    SCOPES.CHECKOUTS_CANCEL,
    SCOPES.CHECKOUTS_EXPIRE
  ]
};
var ScopeManager = class {
  /**
   * Check if user has required scopes
   */
  hasScopes(userScopes, requiredScopes) {
    const expandedUserScopes = this.expandScopes(userScopes);
    return requiredScopes.every(
      (required) => expandedUserScopes.includes(required)
    );
  }
  /**
   * Require scopes or throw error
   */
  requireScopes(userScopes, requiredScopes) {
    if (!this.hasScopes(userScopes, requiredScopes)) {
      throw new AuthError(
        `Missing required scopes: ${requiredScopes.join(", ")}`,
        "insufficient_scope",
        403
      );
    }
  }
  /**
   * Expand wildcard scopes
   */
  expandScopes(scopes) {
    const expanded = /* @__PURE__ */ new Set();
    for (const scope of scopes) {
      if (SCOPE_HIERARCHY[scope]) {
        SCOPE_HIERARCHY[scope].forEach((s) => expanded.add(s));
      } else {
        expanded.add(scope);
      }
    }
    return Array.from(expanded);
  }
  /**
   * Validate scope format
   */
  validateScope(scope) {
    const pattern = /^[a-z_]+:[a-z_*]+$/;
    return pattern.test(scope) || scope === "admin";
  }
  /**
   * Get all available scopes
   */
  getAllScopes() {
    return Object.values(SCOPES);
  }
  /**
   * Group scopes by resource
   */
  groupByResource(scopes) {
    const grouped = {};
    for (const scope of scopes) {
      const [resource] = scope.split(":");
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(scope);
    }
    return grouped;
  }
};

// src/middleware.ts
var AuthMiddleware = class {
  constructor(config) {
    this.config = config;
  }
  /**
   * Authenticate request and return auth context
   */
  async authenticate(authHeader) {
    if (!authHeader) {
      throw new AuthError("Missing authorization header", "unauthorized", 401);
    }
    const apiKey = this.config.apiKeyManager.extractFromHeader(authHeader);
    if (apiKey) {
      return this.authenticateApiKey(apiKey);
    }
    const jwt2 = this.config.jwtManager.extractFromHeader(authHeader);
    if (jwt2) {
      return this.authenticateJWT(jwt2);
    }
    throw new AuthError("Invalid authorization format", "invalid_auth", 401);
  }
  /**
   * Authenticate using API key
   */
  async authenticateApiKey(plainKey) {
    const hash = this.config.apiKeyManager.hashForLookup(plainKey);
    const storedKey = await this.config.getApiKeyByHash(hash);
    if (!storedKey) {
      throw new AuthError("Invalid API key", "invalid_api_key", 401);
    }
    return this.config.apiKeyManager.verifyApiKey(plainKey, storedKey);
  }
  /**
   * Authenticate using JWT
   */
  async authenticateJWT(token) {
    const payload = this.config.jwtManager.verifyToken(token);
    return this.config.jwtManager.toAuthContext(payload);
  }
  /**
   * Authorize request for required scopes
   */
  authorize(authContext, requiredScopes) {
    this.config.scopeManager.requireScopes(
      authContext.scopes,
      requiredScopes
    );
  }
  /**
   * Combined authenticate and authorize
   */
  async authenticateAndAuthorize(authHeader, requiredScopes) {
    const authContext = await this.authenticate(authHeader);
    this.authorize(authContext, requiredScopes);
    return authContext;
  }
  /**
   * Extract tenant ID from auth context
   */
  getTenantId(authContext) {
    return authContext.tenantId;
  }
  /**
   * Check if user is admin
   */
  isAdmin(authContext) {
    return authContext.scopes.includes("admin");
  }
};

export { ApiKeyManager, AuthError, AuthMiddleware, JWTManager, OAuthManager, SCOPES, ScopeManager };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map