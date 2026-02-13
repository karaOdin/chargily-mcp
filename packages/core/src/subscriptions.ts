/**
 * MCP Resource Subscriptions
 * Real-time resource updates via SSE
 */

import { EventEmitter } from 'events';

export interface Subscription {
  id: string;
  uriPattern: string | RegExp;
  callback: (event: ResourceUpdateEvent) => void;
  createdAt: Date;
}

export interface ResourceUpdateEvent {
  uri: string;
  resource: any;
  timestamp: number;
  changeType: 'created' | 'updated' | 'deleted';
}

export class ResourceSubscriptionManager extends EventEmitter {
  private subscriptions: Map<string, Subscription>;
  private resourceCache: Map<string, { data: any; lastUpdated: number }>;

  constructor() {
    super();
    this.subscriptions = new Map();
    this.resourceCache = new Map();
  }

  /**
   * Subscribe to resource updates
   */
  subscribe(
    uriPattern: string | RegExp,
    callback: (event: ResourceUpdateEvent) => void
  ): string {
    const subscriptionId = this.generateId();

    const subscription: Subscription = {
      id: subscriptionId,
      uriPattern,
      callback,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, subscription);

    return subscriptionId;
  }

  /**
   * Unsubscribe from resource updates
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Publish a resource update
   */
  publish(uri: string, resource: any, changeType: 'created' | 'updated' | 'deleted' = 'updated'): void {
    const event: ResourceUpdateEvent = {
      uri,
      resource,
      timestamp: Date.now(),
      changeType,
    };

    // Update cache
    if (changeType === 'deleted') {
      this.resourceCache.delete(uri);
    } else {
      this.resourceCache.set(uri, {
        data: resource,
        lastUpdated: event.timestamp,
      });
    }

    // Notify matching subscriptions
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesPattern(uri, subscription.uriPattern)) {
        try {
          subscription.callback(event);
        } catch (error) {
          console.error('Subscription callback error:', error);
        }
      }
    }

    // Emit global event
    this.emit('resource:update', event);
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clear all subscriptions
   */
  clearAll(): void {
    this.subscriptions.clear();
    this.resourceCache.clear();
  }

  /**
   * Check if URI matches pattern
   */
  private matchesPattern(uri: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      // Exact match or wildcard
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(uri);
      }
      return uri === pattern;
    }

    // RegExp pattern
    return pattern.test(uri);
  }

  /**
   * Generate unique subscription ID
   */
  private generateId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Auto-invalidate resources based on webhook events
   */
  invalidateOnWebhook(eventType: string): void {
    const invalidationRules: Record<string, string[]> = {
      'checkout.paid': [
        'chargily://transactions/recent',
        'chargily://reports/daily',
        'chargily://analytics/conversion',
        'chargily://balance/current',
      ],
      'checkout.failed': [
        'chargily://transactions/recent',
        'chargily://analytics/conversion',
        'chargily://analytics/fraud-signals',
      ],
      'checkout.canceled': [
        'chargily://transactions/recent',
        'chargily://analytics/conversion',
      ],
      'customer.created': [
        'chargily://customers/top',
      ],
      'customer.updated': [
        'chargily://customers/*',
      ],
    };

    const urisToInvalidate = invalidationRules[eventType] || [];

    for (const uri of urisToInvalidate) {
      this.publish(uri, null, 'updated');
    }
  }

  /**
   * Get cached resource
   */
  getCached(uri: string): any | null {
    const cached = this.resourceCache.get(uri);
    return cached ? cached.data : null;
  }

  /**
   * Check if resource is fresh
   */
  isFresh(uri: string, ttl: number): boolean {
    const cached = this.resourceCache.get(uri);
    if (!cached) return false;

    const age = Date.now() - cached.lastUpdated;
    return age < ttl * 1000;
  }
}

// Global subscription manager instance
export const subscriptionManager = new ResourceSubscriptionManager();

/**
 * Helper: Watch resource and call callback on updates
 */
export function watchResource(
  uri: string | RegExp,
  callback: (event: ResourceUpdateEvent) => void
): () => void {
  const subscriptionId = subscriptionManager.subscribe(uri, callback);

  // Return unsubscribe function
  return () => {
    subscriptionManager.unsubscribe(subscriptionId);
  };
}

/**
 * Helper: Watch multiple resources
 */
export function watchResources(
  patterns: (string | RegExp)[],
  callback: (event: ResourceUpdateEvent) => void
): () => void {
  const subscriptionIds = patterns.map((pattern) =>
    subscriptionManager.subscribe(pattern, callback)
  );

  // Return unsubscribe function
  return () => {
    subscriptionIds.forEach((id) => subscriptionManager.unsubscribe(id));
  };
}
