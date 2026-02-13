/**
 * Server-specific MCP Resources
 * These resources provide access to internal platform data (webhooks, audit logs, etc.)
 * that are not part of the Chargily Pay API but are valuable for monitoring and debugging.
 */

import type { MCPResource } from '@chargily/mcp-core';
import { webhookRepository } from '../repositories/index.js';
import { logger } from '../utils/logger.js';

/**
 * Additional resources that require database access
 * These complement the core Chargily API resources
 */
export const SERVER_RESOURCES: MCPResource[] = [
  // ===== Internal Webhook Resources =====
  {
    uriPattern: /^chargily:\/\/internal\/webhooks\/logs(?:\?(.*))?$/,
    description: 'Internal webhook logs from database',
    scopes: ['admin'], // Admin-only access to internal data
    freshness: 10, // 10 seconds
    handler: async (_client, uri, params) => {
      try {
        // Parse query parameters from URI
        const queryMatch = params.param0;
        const urlParams = new URLSearchParams(queryMatch || '');

        const eventType = urlParams.get('eventType') || undefined;
        const processed = urlParams.get('processed') === 'true' ? true
                         : urlParams.get('processed') === 'false' ? false
                         : undefined;
        const limit = parseInt(urlParams.get('limit') || '50');
        const offset = parseInt(urlParams.get('offset') || '0');

        const result = await webhookRepository.list({
          eventType,
          processed,
          limit,
          offset,
        });

        return {
          uri,
          mimeType: 'application/json',
          content: {
            webhooks: result.webhooks.map((w) => ({
              id: w.id,
              eventType: w.eventType,
              eventId: w.eventId,
              verified: w.verified,
              processed: w.processed,
              retryCount: w.retryCount,
              createdAt: w.createdAt,
              processedAt: w.processedAt,
              error: w.error,
            })),
            total: result.total,
            limit,
            offset,
            last_updated: Math.floor(Date.now() / 1000),
          },
        };
      } catch (error) {
        logger.error({ error, uri }, 'Failed to fetch webhook logs');
        return {
          uri,
          mimeType: 'application/json',
          content: {
            error: 'Failed to fetch webhook logs',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    },
  },

  {
    uriPattern: /^chargily:\/\/internal\/webhooks\/events\/([a-z0-9_-]+)$/,
    description: 'Single webhook event details from database',
    scopes: ['admin'],
    freshness: Infinity, // Immutable
    handler: async (_client, uri, params) => {
      try {
        const eventId = params.param0;

        if (!eventId) {
          return {
            uri,
            mimeType: 'application/json',
            content: {
              error: 'Event ID is required',
            },
          };
        }

        const webhook = await webhookRepository.findByEventId(eventId);

        if (!webhook) {
          return {
            uri,
            mimeType: 'application/json',
            content: {
              error: 'Webhook event not found',
              eventId,
            },
          };
        }

        return {
          uri,
          mimeType: 'application/json',
          content: {
            id: webhook.id,
            eventId: webhook.eventId,
            eventType: webhook.eventType,
            payload: webhook.payload,
            signature: webhook.signature,
            verified: webhook.verified,
            processed: webhook.processed,
            retryCount: webhook.retryCount,
            processedAt: webhook.processedAt,
            error: webhook.error,
            createdAt: webhook.createdAt,
          },
        };
      } catch (error) {
        logger.error({ error, uri }, 'Failed to fetch webhook event');
        return {
          uri,
          mimeType: 'application/json',
          content: {
            error: 'Failed to fetch webhook event',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    },
  },

  {
    uriPattern: /^chargily:\/\/internal\/webhooks\/stats$/,
    description: 'Webhook processing statistics',
    scopes: ['admin'],
    freshness: 30, // 30 seconds
    handler: async (_client, uri) => {
      try {
        const stats = await webhookRepository.getStats();

        return {
          uri,
          mimeType: 'application/json',
          content: {
            total_webhooks: stats.total,
            processed: stats.processed,
            failed: stats.failed,
            success_rate: stats.total > 0
              ? ((stats.processed / stats.total) * 100).toFixed(2)
              : '0.00',
            by_event_type: stats.byType,
            last_updated: Math.floor(Date.now() / 1000),
          },
        };
      } catch (error) {
        logger.error({ error, uri }, 'Failed to fetch webhook stats');
        return {
          uri,
          mimeType: 'application/json',
          content: {
            error: 'Failed to fetch webhook stats',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    },
  },
];
