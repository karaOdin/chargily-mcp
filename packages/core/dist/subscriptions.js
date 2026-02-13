import { EventEmitter } from 'events';

// src/subscriptions.ts
var ResourceSubscriptionManager = class extends EventEmitter {
  subscriptions;
  resourceCache;
  constructor() {
    super();
    this.subscriptions = /* @__PURE__ */ new Map();
    this.resourceCache = /* @__PURE__ */ new Map();
  }
  /**
   * Subscribe to resource updates
   */
  subscribe(uriPattern, callback) {
    const subscriptionId = this.generateId();
    const subscription = {
      id: subscriptionId,
      uriPattern,
      callback,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.subscriptions.set(subscriptionId, subscription);
    return subscriptionId;
  }
  /**
   * Unsubscribe from resource updates
   */
  unsubscribe(subscriptionId) {
    return this.subscriptions.delete(subscriptionId);
  }
  /**
   * Publish a resource update
   */
  publish(uri, resource, changeType = "updated") {
    const event = {
      uri,
      resource,
      timestamp: Date.now(),
      changeType
    };
    if (changeType === "deleted") {
      this.resourceCache.delete(uri);
    } else {
      this.resourceCache.set(uri, {
        data: resource,
        lastUpdated: event.timestamp
      });
    }
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesPattern(uri, subscription.uriPattern)) {
        try {
          subscription.callback(event);
        } catch (error) {
          console.error("Subscription callback error:", error);
        }
      }
    }
    this.emit("resource:update", event);
  }
  /**
   * Get all active subscriptions
   */
  getSubscriptions() {
    return Array.from(this.subscriptions.values());
  }
  /**
   * Get subscription count
   */
  getSubscriptionCount() {
    return this.subscriptions.size;
  }
  /**
   * Clear all subscriptions
   */
  clearAll() {
    this.subscriptions.clear();
    this.resourceCache.clear();
  }
  /**
   * Check if URI matches pattern
   */
  matchesPattern(uri, pattern) {
    if (typeof pattern === "string") {
      if (pattern.includes("*")) {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        return regex.test(uri);
      }
      return uri === pattern;
    }
    return pattern.test(uri);
  }
  /**
   * Generate unique subscription ID
   */
  generateId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  /**
   * Auto-invalidate resources based on webhook events
   */
  invalidateOnWebhook(eventType) {
    const invalidationRules = {
      "checkout.paid": [
        "chargily://transactions/recent",
        "chargily://reports/daily",
        "chargily://analytics/conversion",
        "chargily://balance/current"
      ],
      "checkout.failed": [
        "chargily://transactions/recent",
        "chargily://analytics/conversion",
        "chargily://analytics/fraud-signals"
      ],
      "checkout.canceled": [
        "chargily://transactions/recent",
        "chargily://analytics/conversion"
      ],
      "customer.created": [
        "chargily://customers/top"
      ],
      "customer.updated": [
        "chargily://customers/*"
      ]
    };
    const urisToInvalidate = invalidationRules[eventType] || [];
    for (const uri of urisToInvalidate) {
      this.publish(uri, null, "updated");
    }
  }
  /**
   * Get cached resource
   */
  getCached(uri) {
    const cached = this.resourceCache.get(uri);
    return cached ? cached.data : null;
  }
  /**
   * Check if resource is fresh
   */
  isFresh(uri, ttl) {
    const cached = this.resourceCache.get(uri);
    if (!cached) return false;
    const age = Date.now() - cached.lastUpdated;
    return age < ttl * 1e3;
  }
};
var subscriptionManager = new ResourceSubscriptionManager();
function watchResource(uri, callback) {
  const subscriptionId = subscriptionManager.subscribe(uri, callback);
  return () => {
    subscriptionManager.unsubscribe(subscriptionId);
  };
}
function watchResources(patterns, callback) {
  const subscriptionIds = patterns.map(
    (pattern) => subscriptionManager.subscribe(pattern, callback)
  );
  return () => {
    subscriptionIds.forEach((id) => subscriptionManager.unsubscribe(id));
  };
}

export { ResourceSubscriptionManager, subscriptionManager, watchResource, watchResources };
//# sourceMappingURL=subscriptions.js.map
//# sourceMappingURL=subscriptions.js.map