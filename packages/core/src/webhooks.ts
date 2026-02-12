/**
 * Webhook utilities for Chargily Pay
 */

import { createHmac } from 'crypto';
import type { WebhookEvent } from './types';

/**
 * Verify webhook signature
 * @param payload - Raw webhook payload (as string)
 * @param signature - Signature from X-Signature header
 * @param secret - Webhook secret from Chargily dashboard
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Parse webhook event
 * @param payload - Raw webhook payload
 * @returns Parsed webhook event
 */
export function parseWebhookEvent(payload: string): WebhookEvent {
  return JSON.parse(payload) as WebhookEvent;
}

/**
 * Validate webhook event structure
 * @param event - Webhook event to validate
 * @returns true if event structure is valid
 */
export function isValidWebhookEvent(event: any): event is WebhookEvent {
  return (
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.entity === 'string' &&
    typeof event.livemode === 'boolean' &&
    typeof event.data === 'object' &&
    typeof event.created_at === 'number'
  );
}
