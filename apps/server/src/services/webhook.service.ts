/**
 * Webhook Service - Handle Chargily webhook events
 */

import { verifyWebhookSignature, parseWebhookEvent, isValidWebhookEvent } from '@chargily/mcp-core';
import { subscriptionManager } from '@chargily/mcp-core/subscriptions';
import { webhookRepository, auditLogRepository } from '../repositories/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

// System user ID for webhook-triggered actions
const WEBHOOK_SYSTEM_USER_ID = 'system_webhook';

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
    const startTime = Date.now();

    logger.info(
      {
        checkoutId: checkout.id,
        amount: checkout.amount,
        currency: checkout.currency,
        customerId: checkout.customer_id,
      },
      'Processing successful checkout payment'
    );

    try {
      // 1. Create audit log for successful payment
      await auditLogRepository.log({
        userId: WEBHOOK_SYSTEM_USER_ID,
        action: 'checkout.paid',
        resource: 'checkout',
        resourceId: checkout.id,
        input: {
          checkoutId: checkout.id,
          amount: checkout.amount,
          currency: checkout.currency,
          customerId: checkout.customer_id,
          metadata: checkout.metadata,
        },
        output: {
          status: 'processed',
          timestamp: new Date().toISOString(),
        },
        statusCode: 200,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          eventType: 'checkout.paid',
          paymentMethod: checkout.payment_method,
        },
      });

      // 2. Publish real-time subscription event
      subscriptionManager.publish('checkout', {
        type: 'checkout.paid',
        checkoutId: checkout.id,
        status: 'paid',
        amount: checkout.amount,
        currency: checkout.currency,
        customerId: checkout.customer_id,
        timestamp: new Date().toISOString(),
      });

      // 3. Invalidate balance cache (payment received)
      subscriptionManager.publish('balance', {
        type: 'balance.updated',
        reason: 'checkout_paid',
        checkoutId: checkout.id,
        timestamp: new Date().toISOString(),
      });

      // 4. Log notification intent (actual email/SMS would be sent by external service)
      logger.info(
        {
          checkoutId: checkout.id,
          customerId: checkout.customer_id,
          notificationType: 'payment_confirmation',
        },
        'Payment confirmation notification queued'
      );

      logger.info(
        {
          checkoutId: checkout.id,
          duration: Date.now() - startTime,
        },
        'Checkout paid event processed successfully'
      );
    } catch (error) {
      logger.error(
        {
          checkoutId: checkout.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to process checkout.paid event'
      );

      // Log failed processing
      await auditLogRepository.log({
        userId: WEBHOOK_SYSTEM_USER_ID,
        action: 'checkout.paid',
        resource: 'checkout',
        resourceId: checkout.id,
        input: { checkoutId: checkout.id },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Handle failed checkout
   */
  private async handleCheckoutFailed(checkout: any) {
    const startTime = Date.now();

    logger.info(
      {
        checkoutId: checkout.id,
        amount: checkout.amount,
        failureReason: checkout.failure_reason,
      },
      'Processing failed checkout'
    );

    try {
      // 1. Create audit log for failed payment
      await auditLogRepository.log({
        userId: WEBHOOK_SYSTEM_USER_ID,
        action: 'checkout.failed',
        resource: 'checkout',
        resourceId: checkout.id,
        input: {
          checkoutId: checkout.id,
          amount: checkout.amount,
          currency: checkout.currency,
          customerId: checkout.customer_id,
          failureReason: checkout.failure_reason,
          metadata: checkout.metadata,
        },
        output: {
          status: 'failed',
          timestamp: new Date().toISOString(),
        },
        statusCode: 200,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          eventType: 'checkout.failed',
          failureReason: checkout.failure_reason,
        },
      });

      // 2. Publish real-time subscription event
      subscriptionManager.publish('checkout', {
        type: 'checkout.failed',
        checkoutId: checkout.id,
        status: 'failed',
        failureReason: checkout.failure_reason,
        amount: checkout.amount,
        currency: checkout.currency,
        customerId: checkout.customer_id,
        timestamp: new Date().toISOString(),
      });

      // 3. Log customer notification intent
      logger.info(
        {
          checkoutId: checkout.id,
          customerId: checkout.customer_id,
          notificationType: 'payment_failed',
          failureReason: checkout.failure_reason,
        },
        'Payment failure notification queued'
      );

      // 4. Check if retry is recommended based on failure reason
      const retryableReasons = [
        'insufficient_funds',
        'card_declined',
        'network_error',
        'processing_error',
      ];
      const shouldRetry = retryableReasons.some((reason) =>
        checkout.failure_reason?.toLowerCase().includes(reason.toLowerCase())
      );

      if (shouldRetry) {
        logger.info(
          {
            checkoutId: checkout.id,
            failureReason: checkout.failure_reason,
          },
          'Payment failure is retryable - customer should be prompted to retry'
        );
      }

      logger.info(
        {
          checkoutId: checkout.id,
          duration: Date.now() - startTime,
        },
        'Checkout failed event processed successfully'
      );
    } catch (error) {
      logger.error(
        {
          checkoutId: checkout.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to process checkout.failed event'
      );

      await auditLogRepository.log({
        userId: WEBHOOK_SYSTEM_USER_ID,
        action: 'checkout.failed',
        resource: 'checkout',
        resourceId: checkout.id,
        input: { checkoutId: checkout.id },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Handle expired checkout
   */
  private async handleCheckoutExpired(checkout: any) {
    const startTime = Date.now();

    logger.info(
      {
        checkoutId: checkout.id,
        amount: checkout.amount,
      },
      'Processing expired checkout'
    );

    try {
      // 1. Create audit log for expired checkout
      await auditLogRepository.log({
        userId: WEBHOOK_SYSTEM_USER_ID,
        action: 'checkout.expired',
        resource: 'checkout',
        resourceId: checkout.id,
        input: {
          checkoutId: checkout.id,
          amount: checkout.amount,
          currency: checkout.currency,
          customerId: checkout.customer_id,
          createdAt: checkout.created_at,
          expiredAt: checkout.expired_at,
          metadata: checkout.metadata,
        },
        output: {
          status: 'expired',
          timestamp: new Date().toISOString(),
        },
        statusCode: 200,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          eventType: 'checkout.expired',
        },
      });

      // 2. Publish real-time subscription event
      subscriptionManager.publish('checkout', {
        type: 'checkout.expired',
        checkoutId: checkout.id,
        status: 'expired',
        amount: checkout.amount,
        currency: checkout.currency,
        customerId: checkout.customer_id,
        timestamp: new Date().toISOString(),
      });

      // 3. Log cleanup tasks (actual cleanup would be handled by business logic)
      logger.info(
        {
          checkoutId: checkout.id,
          tasks: [
            'release_inventory_hold',
            'cancel_pending_order',
            'cleanup_session_data',
          ],
        },
        'Checkout expiration cleanup tasks queued'
      );

      // 4. Log customer notification intent
      logger.info(
        {
          checkoutId: checkout.id,
          customerId: checkout.customer_id,
          notificationType: 'checkout_expired',
        },
        'Checkout expiration notification queued'
      );

      logger.info(
        {
          checkoutId: checkout.id,
          duration: Date.now() - startTime,
        },
        'Checkout expired event processed successfully'
      );
    } catch (error) {
      logger.error(
        {
          checkoutId: checkout.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to process checkout.expired event'
      );

      await auditLogRepository.log({
        userId: WEBHOOK_SYSTEM_USER_ID,
        action: 'checkout.expired',
        resource: 'checkout',
        resourceId: checkout.id,
        input: { checkoutId: checkout.id },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      throw error;
    }
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
