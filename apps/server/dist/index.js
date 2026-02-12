import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { ChargilyClient, parseWebhookEvent, isValidWebhookEvent, verifyWebhookSignature } from '@chargily/mcp-core';
import { ApiKeyManager, JWTManager, ScopeManager } from '@chargily/mcp-auth';

// src/app.ts
var isDevelopment = process.env.NODE_ENV === "development";
var logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDevelopment ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss Z",
      ignore: "pid,hostname"
    }
  } : void 0
});
var httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === "/health" || req.url === "/metrics"
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) {
      return "error";
    }
    if (res.statusCode >= 400) {
      return "warn";
    }
    return "info";
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  }
});
dotenv.config();
var ConfigSchema = z.object({
  // Environment
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  port: z.coerce.number().default(3e3),
  host: z.string().default("0.0.0.0"),
  // Database
  databaseUrl: z.string(),
  // Redis
  redisUrl: z.string().default("redis://localhost:6379"),
  // Chargily API
  chargilyMode: z.enum(["sandbox", "production"]).default("sandbox"),
  chargilyTestApiKey: z.string().optional(),
  chargilyLiveApiKey: z.string().optional(),
  chargilyWebhookSecret: z.string().optional(),
  // Authentication
  jwtSecret: z.string().min(32),
  jwtAccessTokenTtl: z.coerce.number().default(3600),
  jwtRefreshTokenTtl: z.coerce.number().default(2592e3),
  // OAuth
  oauthIssuer: z.string().default("https://api.chargily-mcp.com"),
  oauthAuthorizationCodeTtl: z.coerce.number().default(600),
  oauthAccessTokenTtl: z.coerce.number().default(3600),
  oauthRefreshTokenTtl: z.coerce.number().default(2592e3),
  // Approval workflow
  approvalExpirationSeconds: z.coerce.number().default(300),
  // Rate limiting
  rateLimitEnabled: z.coerce.boolean().default(true),
  rateLimitWindowMs: z.coerce.number().default(6e4),
  rateLimitMaxRequests: z.coerce.number().default(100),
  // CORS
  corsOrigin: z.string().default("*"),
  corsCredentials: z.coerce.boolean().default(true),
  // Logging
  logLevel: z.enum(["error", "warn", "info", "debug", "trace"]).default("info"),
  // Monitoring
  prometheusEnabled: z.coerce.boolean().default(true),
  // Multi-tenancy
  multiTenantEnabled: z.coerce.boolean().default(true)
});
function loadConfig() {
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
    multiTenantEnabled: process.env.MULTI_TENANT_ENABLED
  };
  try {
    return ConfigSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("\u274C Configuration validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
    }
    throw new Error("Invalid configuration");
  }
}
var config = loadConfig();
function getChargilyApiKey() {
  if (config.chargilyMode === "production") {
    if (!config.chargilyLiveApiKey) {
      throw new Error("CHARGILY_LIVE_API_KEY is required in production mode");
    }
    return config.chargilyLiveApiKey;
  } else {
    if (!config.chargilyTestApiKey) {
      throw new Error("CHARGILY_TEST_API_KEY is required in sandbox mode");
    }
    return config.chargilyTestApiKey;
  }
}

// src/middleware/error-handler.ts
var AppError = class extends Error {
  constructor(statusCode, message, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = "AppError";
  }
};
function errorHandler(error, req, res, _next) {
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers
    }
  }, "Request error");
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code || "error",
        message: error.message,
        details: error.details
      }
    });
  }
  if (error.name === "ZodError") {
    return res.status(400).json({
      error: {
        code: "validation_error",
        message: "Invalid request data",
        details: error.errors
      }
    });
  }
  const isDevelopment2 = process.env.NODE_ENV === "development";
  res.status(500).json({
    error: {
      code: "internal_error",
      message: isDevelopment2 ? error.message : "Internal server error",
      stack: isDevelopment2 ? error.stack : void 0
    }
  });
}
function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: "not_found",
      message: `Route ${req.method} ${req.url} not found`
    }
  });
}
var prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"]
});
async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info("\u2705 Database connected successfully");
  } catch (error) {
    logger.error({ error }, "\u274C Failed to connect to database");
    throw error;
  }
}
async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info("Database disconnected");
  } catch (error) {
    logger.error({ error }, "Error disconnecting from database");
  }
}
async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, "Database health check failed");
    return false;
  }
}
var redis = new Redis(config.redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2e3);
    return delay;
  },
  maxRetriesPerRequest: 3
});
redis.on("connect", () => {
  logger.info("\u2705 Redis connected successfully");
});
redis.on("error", (error) => {
  logger.error({ error }, "\u274C Redis connection error");
});
redis.on("close", () => {
  logger.info("Redis connection closed");
});
async function checkRedisHealth() {
  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch (error) {
    logger.error({ error }, "Redis health check failed");
    return false;
  }
}
async function disconnectRedis() {
  try {
    await redis.quit();
    logger.info("Redis disconnected");
  } catch (error) {
    logger.error({ error }, "Error disconnecting from Redis");
  }
}

// src/routes/health.ts
var router = Router();
router.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime()
  });
});
router.get("/health/detailed", async (_req, res) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth()
  ]);
  const isHealthy = dbHealth && redisHealth;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime(),
    checks: {
      database: dbHealth ? "ok" : "down",
      redis: redisHealth ? "ok" : "down"
    },
    version: process.env.APP_VERSION || "1.0.0"
  });
});
router.get("/ready", async (_req, res) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth()
  ]);
  if (dbHealth && redisHealth) {
    res.status(200).send("OK");
  } else {
    res.status(503).send("NOT READY");
  }
});
router.get("/live", (_req, res) => {
  res.status(200).send("OK");
});
var health_default = router;
var prisma2 = new PrismaClient();
var MetricsService = class {
  /**
   * Get application metrics for Prometheus
   */
  async getMetrics() {
    const metrics = [];
    metrics.push("# HELP chargily_mcp_info Application information");
    metrics.push("# TYPE chargily_mcp_info gauge");
    metrics.push(`chargily_mcp_info{version="${process.env.APP_VERSION || "1.0.0"}"} 1`);
    metrics.push("# HELP chargily_mcp_uptime_seconds Application uptime in seconds");
    metrics.push("# TYPE chargily_mcp_uptime_seconds counter");
    metrics.push(`chargily_mcp_uptime_seconds ${process.uptime()}`);
    const memUsage = process.memoryUsage();
    metrics.push("# HELP chargily_mcp_memory_bytes Memory usage in bytes");
    metrics.push("# TYPE chargily_mcp_memory_bytes gauge");
    metrics.push(`chargily_mcp_memory_bytes{type="rss"} ${memUsage.rss}`);
    metrics.push(`chargily_mcp_memory_bytes{type="heap_total"} ${memUsage.heapTotal}`);
    metrics.push(`chargily_mcp_memory_bytes{type="heap_used"} ${memUsage.heapUsed}`);
    metrics.push(`chargily_mcp_memory_bytes{type="external"} ${memUsage.external}`);
    metrics.push("# HELP nodejs_eventloop_lag_seconds Event loop lag in seconds");
    metrics.push("# TYPE nodejs_eventloop_lag_seconds gauge");
    metrics.push(`nodejs_eventloop_lag_seconds ${await this.getEventLoopLag()}`);
    try {
      const [userCount, apiKeyCount, auditLogCount, webhookCount] = await Promise.all([
        prisma2.user.count(),
        prisma2.apiKey.count(),
        prisma2.auditLog.count(),
        prisma2.webhookLog.count()
      ]);
      metrics.push("# HELP chargily_mcp_users_total Total number of users");
      metrics.push("# TYPE chargily_mcp_users_total gauge");
      metrics.push(`chargily_mcp_users_total ${userCount}`);
      metrics.push("# HELP chargily_mcp_api_keys_total Total number of API keys");
      metrics.push("# TYPE chargily_mcp_api_keys_total gauge");
      metrics.push(`chargily_mcp_api_keys_total ${apiKeyCount}`);
      metrics.push("# HELP chargily_mcp_audit_logs_total Total number of audit logs");
      metrics.push("# TYPE chargily_mcp_audit_logs_total gauge");
      metrics.push(`chargily_mcp_audit_logs_total ${auditLogCount}`);
      metrics.push("# HELP chargily_mcp_webhooks_total Total number of webhooks");
      metrics.push("# TYPE chargily_mcp_webhooks_total gauge");
      metrics.push(`chargily_mcp_webhooks_total ${webhookCount}`);
      const [processedWebhooks, failedWebhooks] = await Promise.all([
        prisma2.webhookLog.count({ where: { processed: true } }),
        prisma2.webhookLog.count({ where: { processed: false } })
      ]);
      const totalWebhooks = processedWebhooks + failedWebhooks;
      const successRate = totalWebhooks > 0 ? processedWebhooks / totalWebhooks : 1;
      metrics.push("# HELP chargily_mcp_webhook_success_rate Webhook processing success rate");
      metrics.push("# TYPE chargily_mcp_webhook_success_rate gauge");
      metrics.push(`chargily_mcp_webhook_success_rate ${successRate}`);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
      const recentActivity = await prisma2.auditLog.count({
        where: {
          timestamp: {
            gte: oneHourAgo
          }
        }
      });
      metrics.push("# HELP chargily_mcp_requests_last_hour Requests in the last hour");
      metrics.push("# TYPE chargily_mcp_requests_last_hour gauge");
      metrics.push(`chargily_mcp_requests_last_hour ${recentActivity}`);
      const [successfulRequests, failedRequests] = await Promise.all([
        prisma2.auditLog.count({
          where: {
            timestamp: { gte: oneHourAgo },
            success: true
          }
        }),
        prisma2.auditLog.count({
          where: {
            timestamp: { gte: oneHourAgo },
            success: false
          }
        })
      ]);
      const totalRequests = successfulRequests + failedRequests;
      const apiSuccessRate = totalRequests > 0 ? successfulRequests / totalRequests : 1;
      metrics.push("# HELP chargily_mcp_api_success_rate API success rate (last hour)");
      metrics.push("# TYPE chargily_mcp_api_success_rate gauge");
      metrics.push(`chargily_mcp_api_success_rate ${apiSuccessRate}`);
    } catch (error) {
      metrics.push("# Database metrics unavailable");
    }
    return metrics.join("\n") + "\n";
  }
  /**
   * Measure event loop lag
   */
  async getEventLoopLag() {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        const lag = (Date.now() - start) / 1e3;
        resolve(lag);
      });
    });
  }
  /**
   * Get system stats (for dashboard)
   */
  async getStats() {
    try {
      const [userCount, apiKeyCount, auditLogCount, webhookCount] = await Promise.all([
        prisma2.user.count(),
        prisma2.apiKey.count(),
        prisma2.auditLog.count(),
        prisma2.webhookLog.count()
      ]);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
      const recentActivity = await prisma2.auditLog.count({
        where: {
          timestamp: {
            gte: oneHourAgo
          }
        }
      });
      const memUsage = process.memoryUsage();
      return {
        counts: {
          users: userCount,
          apiKeys: apiKeyCount,
          auditLogs: auditLogCount,
          webhooks: webhookCount
        },
        activity: {
          lastHour: recentActivity
        },
        system: {
          uptime: process.uptime(),
          memory: {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external
          },
          version: process.env.APP_VERSION || "1.0.0",
          nodeVersion: process.version,
          platform: process.platform
        }
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
};
var metricsService = new MetricsService();

// src/routes/metrics.ts
var router2 = Router();
router2.get("/metrics", async (_req, res) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(metrics);
  } catch (error) {
    res.status(500).send("# Error generating metrics");
  }
});
router2.get("/stats", async (_req, res) => {
  try {
    const stats = await metricsService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get stats",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
var metrics_default = router2;

// src/repositories/user.repository.ts
var UserRepository = class {
  /**
   * Create a new user
   */
  async create(data) {
    return prisma.user.create({ data });
  }
  /**
   * Find user by ID
   */
  async findById(id) {
    return prisma.user.findUnique({ where: { id } });
  }
  /**
   * Find user by email
   */
  async findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }
  /**
   * Find users by tenant
   */
  async findByTenant(tenantId) {
    return prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
  }
  /**
   * Update user
   */
  async update(id, data) {
    return prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
  }
  /**
   * Update last login
   */
  async updateLastLogin(id) {
    return prisma.user.update({
      where: { id },
      data: { lastLogin: /* @__PURE__ */ new Date() }
    });
  }
  /**
   * Delete user
   */
  async delete(id) {
    return prisma.user.delete({ where: { id } });
  }
  /**
   * List users with pagination
   */
  async list(options) {
    const where = {};
    if (options?.tenantId) {
      where.tenantId = options.tenantId;
    }
    if (options?.role) {
      where.role = options.role;
    }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { createdAt: "desc" }
      }),
      prisma.user.count({ where })
    ]);
    return { users, total };
  }
  /**
   * Check if user exists
   */
  async exists(email) {
    const count = await prisma.user.count({ where: { email } });
    return count > 0;
  }
};
var userRepository = new UserRepository();

// src/repositories/api-key.repository.ts
var ApiKeyRepository = class {
  /**
   * Create a new API key
   */
  async create(data) {
    return prisma.apiKey.create({ data });
  }
  /**
   * Find API key by ID
   */
  async findById(id) {
    return prisma.apiKey.findUnique({ where: { id } });
  }
  /**
   * Find API key by hashed key
   */
  async findByHashedKey(hashedKey) {
    return prisma.apiKey.findUnique({
      where: { hashedKey },
      include: { user: true }
    });
  }
  /**
   * Find API keys by user
   */
  async findByUser(userId) {
    return prisma.apiKey.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: /* @__PURE__ */ new Date() } }
        ]
      },
      orderBy: { createdAt: "desc" }
    });
  }
  /**
   * Update API key
   */
  async update(id, data) {
    return prisma.apiKey.update({
      where: { id },
      data: {
        ...data,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
  }
  /**
   * Update last used timestamp
   */
  async updateLastUsed(id) {
    return prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: /* @__PURE__ */ new Date() }
    });
  }
  /**
   * Revoke API key
   */
  async revoke(id, revokedBy) {
    return prisma.apiKey.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: /* @__PURE__ */ new Date(),
        revokedBy
      }
    });
  }
  /**
   * Delete API key
   */
  async delete(id) {
    return prisma.apiKey.delete({ where: { id } });
  }
  /**
   * List API keys with pagination
   */
  async list(options) {
    const where = {};
    if (options?.userId) {
      where.userId = options.userId;
    }
    if (options?.tenantId) {
      where.tenantId = options.tenantId;
    }
    if (options?.isActive !== void 0) {
      where.isActive = options.isActive;
    }
    const [apiKeys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { createdAt: "desc" },
        include: { user: true }
      }),
      prisma.apiKey.count({ where })
    ]);
    return { apiKeys, total };
  }
  /**
   * Clean up expired API keys
   */
  async cleanupExpired() {
    const result = await prisma.apiKey.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: /* @__PURE__ */ new Date() }
      },
      data: {
        isActive: false
      }
    });
    return result.count;
  }
};
var apiKeyRepository = new ApiKeyRepository();

// src/repositories/audit-log.repository.ts
var AuditLogRepository = class {
  /**
   * Create audit log entry
   */
  async create(data) {
    return prisma.auditLog.create({ data });
  }
  /**
   * Log action
   */
  async log(params) {
    return this.create({
      user: { connect: { id: params.userId } },
      tenantId: params.tenantId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      input: params.input || {},
      output: params.output || {},
      statusCode: params.statusCode,
      success: params.success,
      error: params.error,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      duration: params.duration,
      approvalId: params.approvalId,
      approved: params.approved || false,
      metadata: params.metadata
    });
  }
  /**
   * Find logs by user
   */
  async findByUser(userId, options) {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId },
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { timestamp: "desc" }
      }),
      prisma.auditLog.count({ where: { userId } })
    ]);
    return { logs, total };
  }
  /**
   * Find logs by tenant
   */
  async findByTenant(tenantId, options) {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId },
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { timestamp: "desc" }
      }),
      prisma.auditLog.count({ where: { tenantId } })
    ]);
    return { logs, total };
  }
  /**
   * Find logs by action
   */
  async findByAction(action, options) {
    const where = { action };
    if (options?.startDate || options?.endDate) {
      where.timestamp = {};
      if (options.startDate) {
        where.timestamp.gte = options.startDate;
      }
      if (options.endDate) {
        where.timestamp.lte = options.endDate;
      }
    }
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { timestamp: "desc" }
      }),
      prisma.auditLog.count({ where })
    ]);
    return { logs, total };
  }
  /**
   * Search logs with filters
   */
  async search(filters) {
    const where = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;
    if (filters.success !== void 0) where.success = filters.success;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: filters.skip || 0,
        take: filters.take || 50,
        orderBy: { timestamp: "desc" },
        include: { user: true }
      }),
      prisma.auditLog.count({ where })
    ]);
    return { logs, total };
  }
  /**
   * Get statistics
   */
  async getStats(filters) {
    const where = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }
    const [totalLogs, successCount, failureCount] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({ where: { ...where, success: true } }),
      prisma.auditLog.count({ where: { ...where, success: false } })
    ]);
    const logs = await prisma.auditLog.findMany({
      where,
      select: { action: true }
    });
    const actionMap = /* @__PURE__ */ new Map();
    logs.forEach((log) => {
      actionMap.set(log.action, (actionMap.get(log.action) || 0) + 1);
    });
    const actionCounts = Array.from(actionMap.entries()).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count);
    return {
      totalLogs,
      successCount,
      failureCount,
      actionCounts
    };
  }
  /**
   * Delete old logs (for retention policy)
   */
  async deleteOlderThan(days) {
    const cutoffDate = /* @__PURE__ */ new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate }
      }
    });
    return result.count;
  }
};
var auditLogRepository = new AuditLogRepository();
var prisma3 = new PrismaClient();
var WebhookRepository = class {
  /**
   * Log incoming webhook
   */
  async create(data) {
    return prisma3.webhookLog.create({
      data
    });
  }
  /**
   * Mark webhook as processed
   */
  async markProcessed(id, success, error) {
    return prisma3.webhookLog.update({
      where: { id },
      data: {
        processed: true,
        processedAt: /* @__PURE__ */ new Date(),
        error
      }
    });
  }
  /**
   * Increment retry count
   */
  async incrementRetry(id) {
    return prisma3.webhookLog.update({
      where: { id },
      data: {
        retryCount: {
          increment: 1
        }
      }
    });
  }
  /**
   * Find webhook by event ID
   */
  async findByEventId(eventId) {
    return prisma3.webhookLog.findUnique({
      where: { eventId }
    });
  }
  /**
   * List webhooks
   */
  async list(options) {
    const where = {};
    if (options?.eventType) {
      where.eventType = options.eventType;
    }
    if (options?.processed !== void 0) {
      where.processed = options.processed;
    }
    const [webhooks, total] = await Promise.all([
      prisma3.webhookLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: options?.limit || 100,
        skip: options?.offset || 0
      }),
      prisma3.webhookLog.count({ where })
    ]);
    return { webhooks, total };
  }
  /**
   * Get unprocessed webhooks for retry
   */
  async getUnprocessed(maxRetries = 5) {
    return prisma3.webhookLog.findMany({
      where: {
        processed: false,
        retryCount: {
          lt: maxRetries
        }
      },
      orderBy: { createdAt: "asc" },
      take: 100
    });
  }
  /**
   * Delete old webhook logs
   */
  async deleteOlderThan(days) {
    const cutoffDate = /* @__PURE__ */ new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const result = await prisma3.webhookLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });
    return result.count;
  }
};
var webhookRepository = new WebhookRepository();

// src/services/chargily.service.ts
var ChargilyService = class {
  client;
  constructor() {
    const apiKey = getChargilyApiKey();
    const mode = config.chargilyMode;
    this.client = new ChargilyClient({
      apiKey,
      mode,
      timeout: 3e4
    });
    logger.info({ mode }, "Chargily client initialized");
  }
  /**
   * Get account balance
   */
  async getBalance(context) {
    const startTime = Date.now();
    try {
      const balance = await this.client.getBalance();
      await this.logAudit({
        ...context,
        action: "get_balance",
        resource: "balance",
        output: balance,
        success: true,
        duration: Date.now() - startTime
      });
      return balance;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "get_balance",
        resource: "balance",
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Create customer
   */
  async createCustomer(data, context) {
    const startTime = Date.now();
    try {
      const customer = await this.client.createCustomer(data);
      await this.logAudit({
        ...context,
        action: "create_customer",
        resource: "customer",
        resourceId: customer.id,
        input: data,
        output: customer,
        success: true,
        duration: Date.now() - startTime
      });
      return customer;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "create_customer",
        resource: "customer",
        input: data,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Get customer
   */
  async getCustomer(id, context) {
    const startTime = Date.now();
    try {
      const customer = await this.client.getCustomer(id);
      await this.logAudit({
        ...context,
        action: "get_customer",
        resource: "customer",
        resourceId: id,
        output: customer,
        success: true,
        duration: Date.now() - startTime
      });
      return customer;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "get_customer",
        resource: "customer",
        resourceId: id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * List customers
   */
  async listCustomers(params, context) {
    const startTime = Date.now();
    try {
      const customers = await this.client.listCustomers(params);
      await this.logAudit({
        ...context,
        action: "list_customers",
        resource: "customer",
        input: params,
        output: { count: customers.data?.length || 0 },
        success: true,
        duration: Date.now() - startTime
      });
      return customers;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "list_customers",
        resource: "customer",
        input: params,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Update customer
   */
  async updateCustomer(id, data, context) {
    const startTime = Date.now();
    try {
      const customer = await this.client.updateCustomer(id, data);
      await this.logAudit({
        ...context,
        action: "update_customer",
        resource: "customer",
        resourceId: id,
        input: data,
        output: customer,
        success: true,
        duration: Date.now() - startTime
      });
      return customer;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "update_customer",
        resource: "customer",
        resourceId: id,
        input: data,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Delete customer
   */
  async deleteCustomer(id, context) {
    const startTime = Date.now();
    try {
      await this.client.deleteCustomer(id);
      await this.logAudit({
        ...context,
        action: "delete_customer",
        resource: "customer",
        resourceId: id,
        success: true,
        duration: Date.now() - startTime
      });
      return { success: true };
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "delete_customer",
        resource: "customer",
        resourceId: id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Create checkout
   */
  async createCheckout(data, context) {
    const startTime = Date.now();
    try {
      const checkout = await this.client.createCheckout(data);
      await this.logAudit({
        ...context,
        action: "create_checkout",
        resource: "checkout",
        resourceId: checkout.id,
        input: data,
        output: checkout,
        success: true,
        duration: Date.now() - startTime,
        approved: context.approved || false,
        approvalId: context.approvalId
      });
      return checkout;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "create_checkout",
        resource: "checkout",
        input: data,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Get checkout
   */
  async getCheckout(id, context) {
    const startTime = Date.now();
    try {
      const checkout = await this.client.getCheckout(id);
      await this.logAudit({
        ...context,
        action: "get_checkout",
        resource: "checkout",
        resourceId: id,
        output: checkout,
        success: true,
        duration: Date.now() - startTime
      });
      return checkout;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "get_checkout",
        resource: "checkout",
        resourceId: id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * List checkouts
   */
  async listCheckouts(params, context) {
    const startTime = Date.now();
    try {
      const checkouts = await this.client.listCheckouts(params);
      await this.logAudit({
        ...context,
        action: "list_checkouts",
        resource: "checkout",
        input: params,
        output: { count: checkouts.data?.length || 0 },
        success: true,
        duration: Date.now() - startTime
      });
      return checkouts;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "list_checkouts",
        resource: "checkout",
        input: params,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Expire checkout
   */
  async expireCheckout(id, context) {
    const startTime = Date.now();
    try {
      const checkout = await this.client.expireCheckout(id);
      await this.logAudit({
        ...context,
        action: "expire_checkout",
        resource: "checkout",
        resourceId: id,
        output: checkout,
        success: true,
        duration: Date.now() - startTime
      });
      return checkout;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "expire_checkout",
        resource: "checkout",
        resourceId: id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Create product
   */
  async createProduct(data, context) {
    const startTime = Date.now();
    try {
      const product = await this.client.createProduct(data);
      await this.logAudit({
        ...context,
        action: "create_product",
        resource: "product",
        resourceId: product.id,
        input: data,
        output: product,
        success: true,
        duration: Date.now() - startTime
      });
      return product;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "create_product",
        resource: "product",
        input: data,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Get product
   */
  async getProduct(id, context) {
    const startTime = Date.now();
    try {
      const product = await this.client.getProduct(id);
      await this.logAudit({
        ...context,
        action: "get_product",
        resource: "product",
        resourceId: id,
        output: product,
        success: true,
        duration: Date.now() - startTime
      });
      return product;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "get_product",
        resource: "product",
        resourceId: id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * List products
   */
  async listProducts(params, context) {
    const startTime = Date.now();
    try {
      const products = await this.client.listProducts(params);
      await this.logAudit({
        ...context,
        action: "list_products",
        resource: "product",
        input: params,
        output: { count: products.data?.length || 0 },
        success: true,
        duration: Date.now() - startTime
      });
      return products;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "list_products",
        resource: "product",
        input: params,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Create price
   */
  async createPrice(data, context) {
    const startTime = Date.now();
    try {
      const price = await this.client.createPrice({
        ...data,
        currency: "dzd"
      });
      await this.logAudit({
        ...context,
        action: "create_price",
        resource: "price",
        resourceId: price.id,
        input: data,
        output: price,
        success: true,
        duration: Date.now() - startTime
      });
      return price;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "create_price",
        resource: "price",
        input: data,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Get price
   */
  async getPrice(id, context) {
    const startTime = Date.now();
    try {
      const price = await this.client.getPrice(id);
      await this.logAudit({
        ...context,
        action: "get_price",
        resource: "price",
        resourceId: id,
        output: price,
        success: true,
        duration: Date.now() - startTime
      });
      return price;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "get_price",
        resource: "price",
        resourceId: id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * List prices
   */
  async listPrices(params, context) {
    const startTime = Date.now();
    try {
      const prices = await this.client.listPrices(params);
      await this.logAudit({
        ...context,
        action: "list_prices",
        resource: "price",
        input: params,
        output: { count: prices.data?.length || 0 },
        success: true,
        duration: Date.now() - startTime
      });
      return prices;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "list_prices",
        resource: "price",
        input: params,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Create payment link
   */
  async createPaymentLink(data, context) {
    const startTime = Date.now();
    try {
      const paymentLink = await this.client.createPaymentLink(data);
      await this.logAudit({
        ...context,
        action: "create_payment_link",
        resource: "payment_link",
        resourceId: paymentLink.id,
        input: data,
        output: paymentLink,
        success: true,
        duration: Date.now() - startTime
      });
      return paymentLink;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "create_payment_link",
        resource: "payment_link",
        input: data,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Get payment link
   */
  async getPaymentLink(id, context) {
    const startTime = Date.now();
    try {
      const paymentLink = await this.client.getPaymentLink(id);
      await this.logAudit({
        ...context,
        action: "get_payment_link",
        resource: "payment_link",
        resourceId: id,
        output: paymentLink,
        success: true,
        duration: Date.now() - startTime
      });
      return paymentLink;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "get_payment_link",
        resource: "payment_link",
        resourceId: id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * List payment links
   */
  async listPaymentLinks(params, context) {
    const startTime = Date.now();
    try {
      const paymentLinks = await this.client.listPaymentLinks(params);
      await this.logAudit({
        ...context,
        action: "list_payment_links",
        resource: "payment_link",
        input: params,
        output: { count: paymentLinks.data?.length || 0 },
        success: true,
        duration: Date.now() - startTime
      });
      return paymentLinks;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "list_payment_links",
        resource: "payment_link",
        input: params,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Update payment link
   */
  async updatePaymentLink(id, data, context) {
    const startTime = Date.now();
    try {
      const paymentLink = await this.client.updatePaymentLink(id, data);
      await this.logAudit({
        ...context,
        action: "update_payment_link",
        resource: "payment_link",
        resourceId: id,
        input: data,
        output: paymentLink,
        success: true,
        duration: Date.now() - startTime
      });
      return paymentLink;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: "update_payment_link",
        resource: "payment_link",
        resourceId: id,
        input: data,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
  /**
   * Log audit trail
   */
  async logAudit(params) {
    try {
      await auditLogRepository.log({
        ...params,
        statusCode: params.success ? 200 : 500
      });
    } catch (error) {
      logger.error({ error }, "Failed to log audit");
    }
  }
};
var chargilyService = new ChargilyService();

// src/routes/api/chargily.routes.ts
var router3 = Router();
function getContext(req) {
  return {
    userId: req.user?.id || "system",
    tenantId: req.user?.tenantId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  };
}
router3.get("/balance", async (req, res, next) => {
  try {
    const balance = await chargilyService.getBalance(getContext(req));
    res.json(balance);
  } catch (error) {
    next(error);
  }
});
router3.post("/customers", async (req, res, next) => {
  try {
    const customer = await chargilyService.createCustomer(req.body, getContext(req));
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});
router3.get("/customers/:id", async (req, res, next) => {
  try {
    const customer = await chargilyService.getCustomer(req.params.id, getContext(req));
    res.json(customer);
  } catch (error) {
    next(error);
  }
});
router3.get("/customers", async (req, res, next) => {
  try {
    const customers = await chargilyService.listCustomers(
      {
        page: Number(req.query.page) || 1,
        per_page: Number(req.query.per_page) || 20
      },
      getContext(req)
    );
    res.json(customers);
  } catch (error) {
    next(error);
  }
});
router3.patch("/customers/:id", async (req, res, next) => {
  try {
    const customer = await chargilyService.updateCustomer(
      req.params.id,
      req.body,
      getContext(req)
    );
    res.json(customer);
  } catch (error) {
    next(error);
  }
});
router3.delete("/customers/:id", async (req, res, next) => {
  try {
    const result = await chargilyService.deleteCustomer(req.params.id, getContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});
router3.post("/products", async (req, res, next) => {
  try {
    const product = await chargilyService.createProduct(req.body, getContext(req));
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});
router3.get("/products/:id", async (req, res, next) => {
  try {
    const product = await chargilyService.getProduct(req.params.id, getContext(req));
    res.json(product);
  } catch (error) {
    next(error);
  }
});
router3.get("/products", async (req, res, next) => {
  try {
    const products = await chargilyService.listProducts(
      {
        page: Number(req.query.page) || 1,
        per_page: Number(req.query.per_page) || 20
      },
      getContext(req)
    );
    res.json(products);
  } catch (error) {
    next(error);
  }
});
router3.post("/prices", async (req, res, next) => {
  try {
    const price = await chargilyService.createPrice(req.body, getContext(req));
    res.status(201).json(price);
  } catch (error) {
    next(error);
  }
});
router3.get("/prices/:id", async (req, res, next) => {
  try {
    const price = await chargilyService.getPrice(req.params.id, getContext(req));
    res.json(price);
  } catch (error) {
    next(error);
  }
});
router3.get("/prices", async (req, res, next) => {
  try {
    const prices = await chargilyService.listPrices(
      {
        product_id: req.query.product_id,
        page: Number(req.query.page) || 1,
        per_page: Number(req.query.per_page) || 20
      },
      getContext(req)
    );
    res.json(prices);
  } catch (error) {
    next(error);
  }
});
router3.post("/checkouts", async (req, res, next) => {
  try {
    const checkout = await chargilyService.createCheckout(req.body, getContext(req));
    res.status(201).json(checkout);
  } catch (error) {
    next(error);
  }
});
router3.get("/checkouts/:id", async (req, res, next) => {
  try {
    const checkout = await chargilyService.getCheckout(req.params.id, getContext(req));
    res.json(checkout);
  } catch (error) {
    next(error);
  }
});
router3.get("/checkouts", async (req, res, next) => {
  try {
    const checkouts = await chargilyService.listCheckouts(
      {
        page: Number(req.query.page) || 1,
        per_page: Number(req.query.per_page) || 20
      },
      getContext(req)
    );
    res.json(checkouts);
  } catch (error) {
    next(error);
  }
});
router3.post("/checkouts/:id/expire", async (req, res, next) => {
  try {
    const checkout = await chargilyService.expireCheckout(req.params.id, getContext(req));
    res.json(checkout);
  } catch (error) {
    next(error);
  }
});
router3.post("/payment-links", async (req, res, next) => {
  try {
    const paymentLink = await chargilyService.createPaymentLink(req.body, getContext(req));
    res.status(201).json(paymentLink);
  } catch (error) {
    next(error);
  }
});
router3.get("/payment-links/:id", async (req, res, next) => {
  try {
    const paymentLink = await chargilyService.getPaymentLink(req.params.id, getContext(req));
    res.json(paymentLink);
  } catch (error) {
    next(error);
  }
});
router3.get("/payment-links", async (req, res, next) => {
  try {
    const paymentLinks = await chargilyService.listPaymentLinks(
      {
        page: Number(req.query.page) || 1,
        per_page: Number(req.query.per_page) || 20,
        active: req.query.active === "true" ? true : req.query.active === "false" ? false : void 0
      },
      getContext(req)
    );
    res.json(paymentLinks);
  } catch (error) {
    next(error);
  }
});
router3.patch("/payment-links/:id", async (req, res, next) => {
  try {
    const paymentLink = await chargilyService.updatePaymentLink(
      req.params.id,
      req.body,
      getContext(req)
    );
    res.json(paymentLink);
  } catch (error) {
    next(error);
  }
});
var chargily_routes_default = router3;
var apiKeyManager = new ApiKeyManager();
var jwtManager = new JWTManager({
  secret: config.jwtSecret,
  accessTokenTTL: config.jwtAccessTokenTtl,
  refreshTokenTTL: config.jwtRefreshTokenTtl,
  issuer: config.oauthIssuer,
  audience: config.oauthIssuer
});
var scopeManager = new ScopeManager();
var AuthService = class {
  /**
   * Generate API key for user
   */
  async generateApiKey(params) {
    const { apiKey, plainKey } = await apiKeyManager.generateApiKey(
      params.userId,
      params.scopes,
      {
        name: params.name,
        expiresIn: params.expiresIn,
        isTest: params.isTest
      }
    );
    const user = await userRepository.findById(params.userId);
    if (!user) {
      throw new AppError(404, "User not found", "user_not_found");
    }
    const dbApiKey = await apiKeyRepository.create({
      key: apiKey.key,
      hashedKey: apiKey.hashedKey,
      name: apiKey.name,
      user: { connect: { id: params.userId } },
      tenantId: user.tenantId,
      scopes: apiKey.scopes,
      isTest: params.isTest || false,
      expiresAt: apiKey.expiresAt
    });
    return {
      apiKey: dbApiKey,
      plainKey
      // Return this ONCE only
    };
  }
  /**
   * Verify API key
   */
  async verifyApiKey(plainKey) {
    const hashedKey = apiKeyManager.hashForLookup(plainKey);
    const storedApiKey = await apiKeyRepository.findByHashedKey(hashedKey);
    if (!storedApiKey) {
      throw new AppError(401, "Invalid API key", "invalid_api_key");
    }
    const authContext = await apiKeyManager.verifyApiKey(plainKey, {
      id: storedApiKey.id,
      key: storedApiKey.key,
      hashedKey: storedApiKey.hashedKey,
      userId: storedApiKey.userId,
      tenantId: storedApiKey.tenantId || void 0,
      scopes: storedApiKey.scopes,
      expiresAt: storedApiKey.expiresAt || void 0,
      revokedAt: storedApiKey.revokedAt || void 0,
      createdAt: storedApiKey.createdAt
    });
    await apiKeyRepository.updateLastUsed(storedApiKey.id);
    return {
      ...authContext,
      user: storedApiKey.user
    };
  }
  /**
   * Generate JWT tokens
   */
  generateJWT(user) {
    const scopes = ["balance:read", "customers:*", "checkouts:*"];
    const accessToken = jwtManager.generateAccessToken(
      user.id,
      scopes,
      user.tenantId || void 0
    );
    const refreshToken = jwtManager.generateRefreshToken(
      user.id,
      scopes,
      user.tenantId || void 0
    );
    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: config.jwtAccessTokenTtl
    };
  }
  /**
   * Verify JWT token
   */
  verifyJWT(token) {
    return jwtManager.verifyToken(token);
  }
  /**
   * Check if user has required scopes
   */
  checkScopes(userScopes, requiredScopes) {
    return scopeManager.hasScopes(userScopes, requiredScopes);
  }
  /**
   * Require scopes (throws error if missing)
   */
  requireScopes(userScopes, requiredScopes) {
    scopeManager.requireScopes(userScopes, requiredScopes);
  }
  /**
   * Revoke API key
   */
  async revokeApiKey(apiKeyId, revokedBy) {
    return apiKeyRepository.revoke(apiKeyId, revokedBy);
  }
  /**
   * List user's API keys
   */
  async listApiKeys(userId) {
    return apiKeyRepository.findByUser(userId);
  }
};
var authService = new AuthService();

// src/middleware/auth.middleware.ts
async function authenticate(req, _res, next) {
  try {
    const authHeader = req.get("authorization");
    if (!authHeader) {
      throw new AppError(401, "Missing authorization header", "unauthorized");
    }
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      throw new AppError(401, "Invalid authorization format", "invalid_auth");
    }
    const token = match[1];
    if (token.startsWith("test_sk_") || token.startsWith("live_sk_")) {
      const authContext = await authService.verifyApiKey(token);
      req.user = {
        id: authContext.userId,
        email: authContext.user?.email,
        tenantId: authContext.tenantId,
        scopes: authContext.scopes,
        method: "api_key"
      };
    } else {
      const payload = authService.verifyJWT(token);
      req.user = {
        id: payload.sub,
        tenantId: payload.tid,
        scopes: payload.scopes,
        method: "jwt"
      };
    }
    next();
  } catch (error) {
    next(error);
  }
}

// src/routes/api/auth.routes.ts
var router4 = Router();
router4.post("/api-keys", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Not authenticated", "unauthorized");
    }
    const { name, scopes, expiresIn, isTest } = req.body;
    const result = await authService.generateApiKey({
      userId: req.user.id,
      name,
      scopes: scopes || ["balance:read", "customers:*", "checkouts:*"],
      expiresIn,
      isTest
    });
    res.status(201).json({
      apiKey: {
        id: result.apiKey.id,
        key: result.plainKey,
        // IMPORTANT: Only returned once!
        name: result.apiKey.name,
        scopes: result.apiKey.scopes,
        expiresAt: result.apiKey.expiresAt,
        createdAt: result.apiKey.createdAt
      },
      message: "API key created. Save this key securely - it will not be shown again."
    });
  } catch (error) {
    next(error);
  }
});
router4.get("/api-keys", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Not authenticated", "unauthorized");
    }
    const apiKeys = await authService.listApiKeys(req.user.id);
    res.json({
      apiKeys: apiKeys.map((key) => ({
        id: key.id,
        key: key.key,
        // Masked key
        name: key.name,
        scopes: key.scopes,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});
router4.delete("/api-keys/:id", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Not authenticated", "unauthorized");
    }
    await authService.revokeApiKey(req.params.id, req.user.id);
    res.json({ message: "API key revoked successfully" });
  } catch (error) {
    next(error);
  }
});
router4.get("/verify", authenticate, async (req, res) => {
  res.json({
    authenticated: true,
    user: req.user
  });
});
var auth_routes_default = router4;
var WebhookService = class {
  /**
   * Process incoming webhook
   */
  async processWebhook(rawPayload, signature) {
    let webhookLog;
    try {
      const event = parseWebhookEvent(rawPayload);
      if (!isValidWebhookEvent(event)) {
        throw new Error("Invalid webhook event structure");
      }
      const webhookSecret = config.chargilyWebhookSecret;
      if (!webhookSecret) {
        logger.warn("Webhook secret not configured - signature verification skipped");
      }
      const verified = webhookSecret ? verifyWebhookSignature(rawPayload, signature, webhookSecret) : false;
      if (webhookSecret && !verified) {
        throw new Error("Invalid webhook signature");
      }
      const existing = await webhookRepository.findByEventId(event.id);
      if (existing) {
        logger.info({ eventId: event.id }, "Duplicate webhook received, ignoring");
        return { status: "duplicate", event };
      }
      webhookLog = await webhookRepository.create({
        eventType: event.type,
        eventId: event.id,
        payload: event,
        signature,
        verified: verified || !webhookSecret
      });
      await this.handleEvent(event);
      await webhookRepository.markProcessed(webhookLog.id, true);
      logger.info(
        {
          eventId: event.id,
          eventType: event.type,
          verified
        },
        "Webhook processed successfully"
      );
      return { status: "success", event };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        {
          error: errorMessage,
          signature
        },
        "Webhook processing failed"
      );
      if (webhookLog) {
        await webhookRepository.markProcessed(webhookLog.id, false, errorMessage);
      }
      throw error;
    }
  }
  /**
   * Handle webhook event by type
   */
  async handleEvent(event) {
    const { type, data } = event;
    switch (type) {
      case "checkout.paid":
        await this.handleCheckoutPaid(data);
        break;
      case "checkout.failed":
        await this.handleCheckoutFailed(data);
        break;
      case "checkout.expired":
        await this.handleCheckoutExpired(data);
        break;
      default:
        logger.warn({ eventType: type }, "Unhandled webhook event type");
    }
  }
  /**
   * Handle successful checkout
   */
  async handleCheckoutPaid(checkout) {
    logger.info(
      {
        checkoutId: checkout.id,
        amount: checkout.amount,
        currency: checkout.currency
      },
      "Checkout paid"
    );
  }
  /**
   * Handle failed checkout
   */
  async handleCheckoutFailed(checkout) {
    logger.info(
      {
        checkoutId: checkout.id,
        amount: checkout.amount
      },
      "Checkout failed"
    );
  }
  /**
   * Handle expired checkout
   */
  async handleCheckoutExpired(checkout) {
    logger.info(
      {
        checkoutId: checkout.id
      },
      "Checkout expired"
    );
  }
  /**
   * Retry failed webhooks
   */
  async retryFailedWebhooks() {
    const unprocessed = await webhookRepository.getUnprocessed(5);
    logger.info({ count: unprocessed.length }, "Retrying failed webhooks");
    for (const webhook of unprocessed) {
      try {
        const event = webhook.payload;
        await this.handleEvent(event);
        await webhookRepository.markProcessed(webhook.id, true);
      } catch (error) {
        await webhookRepository.incrementRetry(webhook.id);
        logger.error(
          {
            webhookId: webhook.id,
            error: error instanceof Error ? error.message : "Unknown error"
          },
          "Webhook retry failed"
        );
      }
    }
  }
  /**
   * List webhook logs
   */
  async listWebhooks(options) {
    return webhookRepository.list(options);
  }
  /**
   * Get webhook statistics
   */
  async getStats() {
    const [total, processed, failed, byType] = await Promise.all([
      webhookRepository.list({ limit: 0 }),
      webhookRepository.list({ processed: true, limit: 0 }),
      webhookRepository.list({ processed: false, limit: 0 }),
      // Get counts by type (simplified)
      webhookRepository.list({ limit: 1e3 })
    ]);
    const typeStats = byType.webhooks.reduce((acc, webhook) => {
      acc[webhook.eventType] = (acc[webhook.eventType] || 0) + 1;
      return acc;
    }, {});
    return {
      total: total.total,
      processed: processed.total,
      failed: failed.total,
      byType: typeStats
    };
  }
};
var webhookService = new WebhookService();

// src/routes/api/webhooks.routes.ts
var router5 = Router();
router5.post("/chargily", async (req, res, next) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const signature = req.get("X-Signature") || req.get("x-signature") || "";
    if (!signature) {
      throw new AppError(400, "Missing webhook signature");
    }
    const result = await webhookService.processWebhook(rawBody, signature);
    res.json({
      status: "received",
      eventId: result.event.id
    });
  } catch (error) {
    logger.error({ error }, "Webhook processing error");
    if (error instanceof AppError && error.statusCode === 400) {
      return res.status(200).json({
        status: "error",
        message: error.message
      });
    }
    next(error);
  }
});
router5.get("/logs", async (req, res, next) => {
  try {
    const result = await webhookService.listWebhooks({
      eventType: req.query.eventType,
      processed: req.query.processed === "true" ? true : req.query.processed === "false" ? false : void 0,
      limit: Number(req.query.limit) || 100,
      offset: Number(req.query.offset) || 0
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});
router5.get("/stats", async (req, res, next) => {
  try {
    const stats = await webhookService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});
router5.post("/retry", async (req, res, next) => {
  try {
    await webhookService.retryFailedWebhooks();
    res.json({
      status: "success",
      message: "Failed webhooks retried"
    });
  } catch (error) {
    next(error);
  }
});
var webhooks_routes_default = router5;

// src/routes/api/index.ts
var router6 = Router();
router6.use("/auth", auth_routes_default);
router6.use("/webhooks", webhooks_routes_default);
router6.use("/chargily", authenticate, chargily_routes_default);
router6.get("/", (_req, res) => {
  res.json({
    version: "1.0.0",
    endpoints: {
      balance: "GET /api/v1/chargily/balance",
      customers: {
        create: "POST /api/v1/chargily/customers",
        get: "GET /api/v1/chargily/customers/:id",
        list: "GET /api/v1/chargily/customers",
        update: "PATCH /api/v1/chargily/customers/:id",
        delete: "DELETE /api/v1/chargily/customers/:id"
      },
      products: {
        create: "POST /api/v1/chargily/products",
        get: "GET /api/v1/chargily/products/:id",
        list: "GET /api/v1/chargily/products"
      },
      prices: {
        create: "POST /api/v1/chargily/prices",
        get: "GET /api/v1/chargily/prices/:id",
        list: "GET /api/v1/chargily/prices"
      },
      checkouts: {
        create: "POST /api/v1/chargily/checkouts",
        get: "GET /api/v1/chargily/checkouts/:id",
        list: "GET /api/v1/chargily/checkouts",
        expire: "POST /api/v1/chargily/checkouts/:id/expire"
      },
      paymentLinks: {
        create: "POST /api/v1/chargily/payment-links",
        get: "GET /api/v1/chargily/payment-links/:id",
        list: "GET /api/v1/chargily/payment-links",
        update: "PATCH /api/v1/chargily/payment-links/:id"
      },
      webhooks: {
        receive: "POST /api/v1/webhooks/chargily",
        logs: "GET /api/v1/webhooks/logs",
        stats: "GET /api/v1/webhooks/stats",
        retry: "POST /api/v1/webhooks/retry"
      }
    }
  });
});
var api_default = router6;

// src/app.ts
var app = express();
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: config.corsCredentials
}));
app.use(compression());
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || "10mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_REQUEST_SIZE || "10mb" }));
app.use(httpLogger);
app.use(health_default);
app.use(metrics_default);
app.use("/api/v1", api_default);
app.get("/", (_req, res) => {
  res.json({
    name: "Chargily MCP Platform",
    version: process.env.APP_VERSION || "1.0.0",
    status: "running",
    environment: config.nodeEnv,
    endpoints: {
      health: "/health",
      api: "/api/v1",
      mcp: "/mcp",
      docs: "/docs"
    }
  });
});
app.use(notFoundHandler);
app.use(errorHandler);

// src/index.ts
async function startServer() {
  try {
    await connectDatabase();
    await redis.ping();
    const server = app.listen(config.port, config.host, () => {
      logger.info({
        port: config.port,
        host: config.host,
        environment: config.nodeEnv,
        mode: config.chargilyMode
      }, "\u{1F680} Chargily MCP Server started successfully");
      logger.info(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551                                                          \u2551
\u2551   \u{1F389} CHARGILY MCP PLATFORM - RUNNING! \u{1F389}                \u2551
\u2551                                                          \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D

\u{1F4CD} Server URL: http://${config.host}:${config.port}
\u{1F4CD} Health Check: http://${config.host}:${config.port}/health
\u{1F4CD} API Docs: http://${config.host}:${config.port}/docs

\u{1F527} Configuration:
   - Environment: ${config.nodeEnv}
   - Chargily Mode: ${config.chargilyMode}
   - Database: ${config.databaseUrl.split("@")[1] || "connected"}
   - Redis: ${config.redisUrl}

\u{1F3AF} Ready to accept requests!
      `);
    });
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      server.close(async () => {
        logger.info("HTTP server closed");
        await disconnectDatabase();
        await disconnectRedis();
        logger.info("\u2705 Shutdown complete");
        process.exit(0);
      });
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, Number(process.env.SHUTDOWN_TIMEOUT_MS) || 1e4);
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error({ error }, "\u274C Failed to start server");
    process.exit(1);
  }
}
process.on("uncaughtException", (error) => {
  logger.error({ error }, "\u274C Uncaught exception");
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "\u274C Unhandled rejection");
  process.exit(1);
});
startServer();
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map