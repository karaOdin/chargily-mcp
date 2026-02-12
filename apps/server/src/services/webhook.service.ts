/**
 * Webhook Service - Handle Chargily webhook events
 */

import { verifyWebhookSignature, parseWebhookEvent, isValidWebhookEvent } from '@chargily/mcp-core';
import { webhookRepository } from '../repositories/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

export class WebhookService {
  /**
   * Process incoming webhook
   */
  async processWebhook(rawPayload: string, signature: string) {
    let webhookLog;

    try {
      // Parse event
      const event = parseWebhookEvent(rawPayload);

      // Validate event structure
      if (!isValidWebhookEvent(event)) {
        throw new Error('Invalid webhook event structure');
      }

      // Verify signature
      const webhookSecret = config.chargilyWebhookSecret;
      if (!webhookSecret) {
        logger.warn('Webhook secret not configured - signature verification skipped');
      }

      const verified = webhookSecret
        ? verifyWebhookSignature(rawPayload, signature, webhookSecret)
        : false;

      if (webhookSecret && !verified) {
        throw new Error('Invalid webhook signature');
      }

      // Check for duplicate
      const existing = await webhookRepository.findByEventId(event.id);
      if (existing) {
        logger.info({ eventId: event.id }, 'Duplicate webhook received, ignoring');
        return { status: 'duplicate', event };
      }

      // Log webhook
      webhookLog = await webhookRepository.create({
        eventType: event.type,
        eventId: event.id,
        payload: event,
        signature,
        verified: verified || !webhookSecret,
      });

      // Process event based on type
      await this.handleEvent(event);

      // Mark as processed
      await webhookRepository.markProcessed(webhookLog.id, true);

      logger.info(
        {
          eventId: event.id,
          eventType: event.type,
          verified,
        },
        'Webhook processed successfully'
      );

      return { status: 'success', event };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        {
          error: errorMessage,
          signature,
        },
        'Webhook processing failed'
      );

      // Mark as failed if we created a log
      if (webhookLog) {
        await webhookRepository.markProcessed(webhookLog.id, false, errorMessage);
      }

      throw error;
    }
  }

  /**
   * Handle webhook event by type
   */
  private async handleEvent(event: any) {
    const { type, data } = event;

    switch (type) {
      case 'checkout.paid':
        await this.handleCheckoutPaid(data);
        break;

      case 'checkout.failed':
        await this.handleCheckoutFailed(data);
        break;

      case 'checkout.expired':
        await this.handleCheckoutExpired(data);
        break;

      default:
        logger.warn({ eventType: type }, 'Unhandled webhook event type');
    }
  }

  /**
   * Handle successful checkout
   */
  private async handleCheckoutPaid(checkout: any) {
    logger.info(
      {
        checkoutId: checkout.id,
        amount: checkout.amount,
        currency: checkout.currency,
      },
      'Checkout paid'
    );

    // TODO: Implement business logic
    // - Update order status
    // - Send confirmation email
    // - Trigger fulfillment
    // - Update inventory
  }

  /**
   * Handle failed checkout
   */
  private async handleCheckoutFailed(checkout: any) {
    logger.info(
      {
        checkoutId: checkout.id,
        amount: checkout.amount,
      },
      'Checkout failed'
    );

    // TODO: Implement business logic
    // - Notify customer
    // - Log failure reason
    // - Trigger retry logic
  }

  /**
   * Handle expired checkout
   */
  private async handleCheckoutExpired(checkout: any) {
    logger.info(
      {
        checkoutId: checkout.id,
      },
      'Checkout expired'
    );

    // TODO: Implement business logic
    // - Clean up pending orders
    // - Release inventory
    // - Notify customer
  }

  /**
   * Retry failed webhooks
   */
  async retryFailedWebhooks() {
    const unprocessed = await webhookRepository.getUnprocessed(5);

    logger.info({ count: unprocessed.length }, 'Retrying failed webhooks');

    for (const webhook of unprocessed) {
      try {
        const event = webhook.payload as any;
        await this.handleEvent(event);
        await webhookRepository.markProcessed(webhook.id, true);
      } catch (error) {
        await webhookRepository.incrementRetry(webhook.id);
        logger.error(
          {
            webhookId: webhook.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Webhook retry failed'
        );
      }
    }
  }

  /**
   * List webhook logs
   */
  async listWebhooks(options?: {
    eventType?: string;
    processed?: boolean;
    limit?: number;
    offset?: number;
  }) {
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
      webhookRepository.list({ limit: 1000 }),
    ]);

    const typeStats = byType.webhooks.reduce((acc: any, webhook: any) => {
      acc[webhook.eventType] = (acc[webhook.eventType] || 0) + 1;
      return acc;
    }, {});

    return {
      total: total.total,
      processed: processed.total,
      failed: failed.total,
      byType: typeStats,
    };
  }
}

export const webhookService = new WebhookService();
