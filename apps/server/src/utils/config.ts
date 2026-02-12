/**
 * Configuration management
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Configuration schema
const ConfigSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),

  // Database
  databaseUrl: z.string(),

  // Redis
  redisUrl: z.string().default('redis://localhost:6379'),

  // Chargily API
  chargilyMode: z.enum(['sandbox', 'production']).default('sandbox'),
  chargilyTestApiKey: z.string().optional(),
  chargilyLiveApiKey: z.string().optional(),
  chargilyWebhookSecret: z.string().optional(),

  // Authentication
  jwtSecret: z.string().min(32),
  jwtAccessTokenTtl: z.coerce.number().default(3600),
  jwtRefreshTokenTtl: z.coerce.number().default(2592000),

  // OAuth
  oauthIssuer: z.string().default('https://api.chargily-mcp.com'),
  oauthAuthorizationCodeTtl: z.coerce.number().default(600),
  oauthAccessTokenTtl: z.coerce.number().default(3600),
  oauthRefreshTokenTtl: z.coerce.number().default(2592000),

  // Approval workflow
  approvalExpirationSeconds: z.coerce.number().default(300),

  // Rate limiting
  rateLimitEnabled: z.coerce.boolean().default(true),
  rateLimitWindowMs: z.coerce.number().default(60000),
  rateLimitMaxRequests: z.coerce.number().default(100),

  // CORS
  corsOrigin: z.string().default('*'),
  corsCredentials: z.coerce.boolean().default(true),

  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Monitoring
  prometheusEnabled: z.coerce.boolean().default(true),

  // Multi-tenancy
  multiTenantEnabled: z.coerce.boolean().default(true),
});

export type Config = z.infer<typeof ConfigSchema>;

// Parse and validate configuration
function loadConfig(): Config {
  const raw = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    host: process.env.HOST,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    chargilyMode: process.env.CHARGILY_MODE,
    chargilyTestApiKey: process.env.CHARGILY_TEST_API_KEY,
    chargilyLiveApiKey: process.env.CHARGILY_LIVE_API_KEY,
    chargilyWebhookSecret: process.env.CHARGILY_WEBHOOK_SECRET,
    jwtSecret: process.env.JWT_SECRET,
    jwtAccessTokenTtl: process.env.JWT_ACCESS_TOKEN_TTL,
    jwtRefreshTokenTtl: process.env.JWT_REFRESH_TOKEN_TTL,
    oauthIssuer: process.env.OAUTH_ISSUER,
    oauthAuthorizationCodeTtl: process.env.OAUTH_AUTHORIZATION_CODE_TTL,
    oauthAccessTokenTtl: process.env.OAUTH_ACCESS_TOKEN_TTL,
    oauthRefreshTokenTtl: process.env.OAUTH_REFRESH_TOKEN_TTL,
    approvalExpirationSeconds: process.env.APPROVAL_EXPIRATION_SECONDS,
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
    corsOrigin: process.env.CORS_ORIGIN,
    corsCredentials: process.env.CORS_CREDENTIALS,
    logLevel: process.env.LOG_LEVEL,
    prometheusEnabled: process.env.PROMETHEUS_ENABLED,
    multiTenantEnabled: process.env.MULTI_TENANT_ENABLED,
  };

  try {
    return ConfigSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error('Invalid configuration');
  }
}

export const config = loadConfig();

// Get Chargily API key based on mode
export function getChargilyApiKey(): string {
  if (config.chargilyMode === 'production') {
    if (!config.chargilyLiveApiKey) {
      throw new Error('CHARGILY_LIVE_API_KEY is required in production mode');
    }
    return config.chargilyLiveApiKey;
  } else {
    if (!config.chargilyTestApiKey) {
      throw new Error('CHARGILY_TEST_API_KEY is required in sandbox mode');
    }
    return config.chargilyTestApiKey;
  }
}
