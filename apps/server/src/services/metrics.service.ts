/**
 * Metrics Service - Prometheus metrics collection
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class MetricsService {
  /**
   * Get application metrics for Prometheus
   */
  async getMetrics(): Promise<string> {
    const metrics: string[] = [];

    // Add custom metrics
    metrics.push('# HELP chargily_mcp_info Application information');
    metrics.push('# TYPE chargily_mcp_info gauge');
    metrics.push(`chargily_mcp_info{version="${process.env.APP_VERSION || '1.0.0'}"} 1`);

    // Uptime
    metrics.push('# HELP chargily_mcp_uptime_seconds Application uptime in seconds');
    metrics.push('# TYPE chargily_mcp_uptime_seconds counter');
    metrics.push(`chargily_mcp_uptime_seconds ${process.uptime()}`);

    // Memory usage
    const memUsage = process.memoryUsage();
    metrics.push('# HELP chargily_mcp_memory_bytes Memory usage in bytes');
    metrics.push('# TYPE chargily_mcp_memory_bytes gauge');
    metrics.push(`chargily_mcp_memory_bytes{type="rss"} ${memUsage.rss}`);
    metrics.push(`chargily_mcp_memory_bytes{type="heap_total"} ${memUsage.heapTotal}`);
    metrics.push(`chargily_mcp_memory_bytes{type="heap_used"} ${memUsage.heapUsed}`);
    metrics.push(`chargily_mcp_memory_bytes{type="external"} ${memUsage.external}`);

    // Event loop lag
    metrics.push('# HELP nodejs_eventloop_lag_seconds Event loop lag in seconds');
    metrics.push('# TYPE nodejs_eventloop_lag_seconds gauge');
    metrics.push(`nodejs_eventloop_lag_seconds ${await this.getEventLoopLag()}`);

    // Database metrics
    try {
      const [userCount, apiKeyCount, auditLogCount, webhookCount] = await Promise.all([
        prisma.user.count(),
        prisma.apiKey.count(),
        prisma.auditLog.count(),
        prisma.webhookLog.count(),
      ]);

      metrics.push('# HELP chargily_mcp_users_total Total number of users');
      metrics.push('# TYPE chargily_mcp_users_total gauge');
      metrics.push(`chargily_mcp_users_total ${userCount}`);

      metrics.push('# HELP chargily_mcp_api_keys_total Total number of API keys');
      metrics.push('# TYPE chargily_mcp_api_keys_total gauge');
      metrics.push(`chargily_mcp_api_keys_total ${apiKeyCount}`);

      metrics.push('# HELP chargily_mcp_audit_logs_total Total number of audit logs');
      metrics.push('# TYPE chargily_mcp_audit_logs_total gauge');
      metrics.push(`chargily_mcp_audit_logs_total ${auditLogCount}`);

      metrics.push('# HELP chargily_mcp_webhooks_total Total number of webhooks');
      metrics.push('# TYPE chargily_mcp_webhooks_total gauge');
      metrics.push(`chargily_mcp_webhooks_total ${webhookCount}`);

      // Webhook success rate
      const [processedWebhooks, failedWebhooks] = await Promise.all([
        prisma.webhookLog.count({ where: { processed: true } }),
        prisma.webhookLog.count({ where: { processed: false } }),
      ]);

      const totalWebhooks = processedWebhooks + failedWebhooks;
      const successRate = totalWebhooks > 0 ? processedWebhooks / totalWebhooks : 1;

      metrics.push('# HELP chargily_mcp_webhook_success_rate Webhook processing success rate');
      metrics.push('# TYPE chargily_mcp_webhook_success_rate gauge');
      metrics.push(`chargily_mcp_webhook_success_rate ${successRate}`);

      // Recent API activity (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentActivity = await prisma.auditLog.count({
        where: {
          timestamp: {
            gte: oneHourAgo,
          },
        },
      });

      metrics.push('# HELP chargily_mcp_requests_last_hour Requests in the last hour');
      metrics.push('# TYPE chargily_mcp_requests_last_hour gauge');
      metrics.push(`chargily_mcp_requests_last_hour ${recentActivity}`);

      // Success rate
      const [successfulRequests, failedRequests] = await Promise.all([
        prisma.auditLog.count({
          where: {
            timestamp: { gte: oneHourAgo },
            success: true,
          },
        }),
        prisma.auditLog.count({
          where: {
            timestamp: { gte: oneHourAgo },
            success: false,
          },
        }),
      ]);

      const totalRequests = successfulRequests + failedRequests;
      const apiSuccessRate = totalRequests > 0 ? successfulRequests / totalRequests : 1;

      metrics.push('# HELP chargily_mcp_api_success_rate API success rate (last hour)');
      metrics.push('# TYPE chargily_mcp_api_success_rate gauge');
      metrics.push(`chargily_mcp_api_success_rate ${apiSuccessRate}`);
    } catch (error) {
      // Database unavailable, skip database metrics
      metrics.push('# Database metrics unavailable');
    }

    return metrics.join('\n') + '\n';
  }

  /**
   * Measure event loop lag
   */
  private async getEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        const lag = (Date.now() - start) / 1000;
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
        prisma.user.count(),
        prisma.apiKey.count(),
        prisma.auditLog.count(),
        prisma.webhookLog.count(),
      ]);

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentActivity = await prisma.auditLog.count({
        where: {
          timestamp: {
            gte: oneHourAgo,
          },
        },
      });

      const memUsage = process.memoryUsage();

      return {
        counts: {
          users: userCount,
          apiKeys: apiKeyCount,
          auditLogs: auditLogCount,
          webhooks: webhookCount,
        },
        activity: {
          lastHour: recentActivity,
        },
        system: {
          uptime: process.uptime(),
          memory: {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
          },
          version: process.env.APP_VERSION || '1.0.0',
          nodeVersion: process.version,
          platform: process.platform,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const metricsService = new MetricsService();
