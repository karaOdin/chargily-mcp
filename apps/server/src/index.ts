/**
 * Chargily MCP Server - Main Entry Point
 */

import { app } from './app.js';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './utils/database.js';
import { redis, disconnectRedis } from './utils/redis.js';

// ============================================================================
// STARTUP
// ============================================================================

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Verify Redis connection (optional for MVP)
    try {
      await redis.ping();
      logger.info('✅ Redis connected');
    } catch (error) {
      logger.warn('⚠️  Redis not available - continuing without Redis (MVP mode)');
    }

    // Start HTTP server
    const server = app.listen(config.port, config.host, () => {
      logger.info({
        port: config.port,
        host: config.host,
        environment: config.nodeEnv,
        mode: config.chargilyMode,
      }, '🚀 Chargily MCP Server started successfully');

      logger.info(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🎉 CHARGILY MCP PLATFORM - RUNNING! 🎉                ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

📍 Server URL: http://${config.host}:${config.port}
📍 Health Check: http://${config.host}:${config.port}/health
📍 API Docs: http://${config.host}:${config.port}/docs

🔧 Configuration:
   - Environment: ${config.nodeEnv}
   - Chargily Mode: ${config.chargilyMode}
   - Database: ${config.databaseUrl.split('@')[1] || 'connected'}
   - Redis: ${config.redisUrl}

🎯 Ready to accept requests!
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        // Close database connection
        await disconnectDatabase();

        // Close Redis connection
        await disconnectRedis();

        logger.info('✅ Shutdown complete');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error({ error }, '❌ Failed to start server');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error }, '❌ Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, '❌ Unhandled rejection');
  process.exit(1);
});

// Start the server
startServer();
