/**
 * Webhook Repository - Database operations for webhook logs
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class WebhookRepository {
  /**
   * Log incoming webhook
   */
  async create(data: {
    eventType: string;
    eventId: string;
    payload: any;
    signature: string;
    verified: boolean;
  }) {
    return prisma.webhookLog.create({
      data,
    });
  }

  /**
   * Mark webhook as processed
   */
  async markProcessed(id: string, success: boolean, error?: string) {
    return prisma.webhookLog.update({
      where: { id },
      data: {
        processed: true,
        processedAt: new Date(),
        error,
      },
    });
  }

  /**
   * Increment retry count
   */
  async incrementRetry(id: string) {
    return prisma.webhookLog.update({
      where: { id },
      data: {
        retryCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Find webhook by event ID
   */
  async findByEventId(eventId: string) {
    return prisma.webhookLog.findUnique({
      where: { eventId },
    });
  }

  /**
   * List webhooks
   */
  async list(options?: {
    eventType?: string;
    processed?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.WebhookLogWhereInput = {};

    if (options?.eventType) {
      where.eventType = options.eventType;
    }

    if (options?.processed !== undefined) {
      where.processed = options.processed;
    }

    const [webhooks, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 100,
        skip: options?.offset || 0,
      }),
      prisma.webhookLog.count({ where }),
    ]);

    return { webhooks, total };
  }

  /**
   * Get unprocessed webhooks for retry
   */
  async getUnprocessed(maxRetries: number = 5) {
    return prisma.webhookLog.findMany({
      where: {
        processed: false,
        retryCount: {
          lt: maxRetries,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  /**
   * Delete old webhook logs
   */
  async deleteOlderThan(days: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.webhookLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get webhook statistics
   */
  async getStats() {
    const [allWebhooks, total, processed, failed] = await Promise.all([
      prisma.webhookLog.findMany({
        select: { eventType: true },
      }),
      prisma.webhookLog.count(),
      prisma.webhookLog.count({ where: { processed: true } }),
      prisma.webhookLog.count({ where: { processed: false } }),
    ]);

    // Count by event type
    const byType: Record<string, number> = {};
    allWebhooks.forEach((webhook) => {
      byType[webhook.eventType] = (byType[webhook.eventType] || 0) + 1;
    });

    return {
      total,
      processed,
      failed,
      byType,
    };
  }
}

export const webhookRepository = new WebhookRepository();
