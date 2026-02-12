import Redis from 'ioredis';

// src/types.ts
var ApprovalError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "ApprovalError";
  }
};
var ApprovalQueue = class {
  redis;
  keyPrefix = "chargily:approvals:";
  constructor(redisUrl) {
    this.redis = new Redis(redisUrl || "redis://localhost:6379");
  }
  /**
   * Add approval request to queue
   */
  async enqueue(request) {
    const id = this.generateId();
    const now = /* @__PURE__ */ new Date();
    const approvalRequest = {
      ...request,
      id,
      createdAt: now,
      updatedAt: now
    };
    const key = `${this.keyPrefix}${id}`;
    await this.redis.setex(
      key,
      this.getTTL(request.expiresAt),
      JSON.stringify(approvalRequest)
    );
    await this.redis.zadd(
      `${this.keyPrefix}pending`,
      request.expiresAt.getTime(),
      id
    );
    return approvalRequest;
  }
  /**
   * Get approval request by ID
   */
  async get(id) {
    const key = `${this.keyPrefix}${id}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }
  /**
   * Update approval request
   */
  async update(id, updates) {
    const request = await this.get(id);
    if (!request) {
      throw new ApprovalError(`Approval request ${id} not found`, "not_found");
    }
    const updated = {
      ...request,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    const key = `${this.keyPrefix}${id}`;
    await this.redis.setex(
      key,
      this.getTTL(updated.expiresAt),
      JSON.stringify(updated)
    );
    return updated;
  }
  /**
   * Add approval to request
   */
  async addApproval(id, approval) {
    const request = await this.get(id);
    if (!request) {
      throw new ApprovalError(`Approval request ${id} not found`, "not_found");
    }
    if (request.status !== "pending") {
      throw new ApprovalError(
        `Cannot approve request with status ${request.status}`,
        "invalid_status"
      );
    }
    request.approvals.push(approval);
    const rejections = request.approvals.filter((a) => a.decision === "reject");
    const approvals = request.approvals.filter((a) => a.decision === "approve");
    let newStatus = "pending";
    if (rejections.length > 0) {
      newStatus = "rejected";
    } else if (approvals.length >= request.requiredApprovers) {
      newStatus = "approved";
    }
    const updated = await this.update(id, {
      approvals: request.approvals,
      status: newStatus,
      completedAt: newStatus !== "pending" ? /* @__PURE__ */ new Date() : void 0
    });
    if (newStatus !== "pending") {
      await this.redis.zrem(`${this.keyPrefix}pending`, id);
    }
    return updated;
  }
  /**
   * List pending approvals
   */
  async listPending(options) {
    const limit = options?.limit || 100;
    const ids = await this.redis.zrange(
      `${this.keyPrefix}pending`,
      0,
      limit - 1
    );
    const requests = await Promise.all(
      ids.map((id) => this.get(id))
    );
    return requests.filter((r) => {
      if (!r) return false;
      if (options?.tenantId && r.requestedBy.tenantId !== options.tenantId) {
        return false;
      }
      return true;
    });
  }
  /**
   * Expire old pending approvals
   */
  async expireOld() {
    const now = Date.now();
    const expired = await this.redis.zrangebyscore(
      `${this.keyPrefix}pending`,
      0,
      now
    );
    for (const id of expired) {
      await this.update(id, { status: "expired" });
      await this.redis.zrem(`${this.keyPrefix}pending`, id);
    }
    return expired.length;
  }
  /**
   * Wait for approval decision
   */
  async waitForDecision(id, timeout = 3e5) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const request = await this.get(id);
      if (!request) {
        throw new ApprovalError("Approval request not found", "not_found");
      }
      if (request.status !== "pending") {
        return request;
      }
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
    throw new ApprovalError("Approval timeout", "timeout");
  }
  generateId() {
    return `apr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  getTTL(expiresAt) {
    return Math.max(Math.floor((expiresAt.getTime() - Date.now()) / 1e3), 60);
  }
  async close() {
    await this.redis.quit();
  }
};

// src/rules.ts
var ApprovalRulesEngine = class {
  rules = [];
  /**
   * Add approval rule
   */
  addRule(rule) {
    this.rules.push(rule);
  }
  /**
   * Determine approval tier for action
   */
  determineApprovalTier(action, input) {
    const matchingRules = this.rules.filter(
      (rule) => rule.action === action && rule.condition(input)
    );
    if (matchingRules.length === 0) {
      return "none";
    }
    const tiers = ["none", "tier1", "tier2", "tier3"];
    const maxTier = matchingRules.reduce((max, rule) => {
      const currentIndex = tiers.indexOf(rule.tier);
      const maxIndex = tiers.indexOf(max);
      return currentIndex > maxIndex ? rule.tier : max;
    }, "none");
    return maxTier;
  }
  /**
   * Check if action should auto-approve
   */
  shouldAutoApprove(action, input) {
    const matchingRules = this.rules.filter(
      (rule) => rule.action === action && rule.condition(input)
    );
    return matchingRules.some((rule) => rule.autoApprove === true);
  }
  /**
   * Get required approvers count
   */
  getRequiredApprovers(tier) {
    switch (tier) {
      case "tier1":
        return 0;
      // Auto-approve
      case "tier2":
        return 1;
      case "tier3":
        return 2;
      default:
        return 0;
    }
  }
};
function getDefaultRules() {
  return [
    // Checkout approval based on amount
    {
      action: "create_checkout",
      condition: (input) => input.amount < 5e3,
      // < 50 DZD
      tier: "tier1",
      autoApprove: true
    },
    {
      action: "create_checkout",
      condition: (input) => input.amount >= 5e3 && input.amount < 1e5,
      tier: "tier2"
    },
    {
      action: "create_checkout",
      condition: (input) => input.amount >= 1e5,
      // >= 1000 DZD
      tier: "tier3"
    },
    // Customer deletion requires approval
    {
      action: "delete_customer",
      condition: () => true,
      tier: "tier2"
    },
    // Customer update with email/phone change
    {
      action: "update_customer",
      condition: (input) => input.email || input.phone,
      tier: "tier2"
    },
    // Checkout cancellation
    {
      action: "cancel_checkout",
      condition: () => true,
      tier: "tier2"
    },
    // Checkout expiration
    {
      action: "expire_checkout",
      condition: () => true,
      tier: "tier2"
    }
  ];
}

// src/notifier.ts
var EmailNotifier = class {
  async send(notification) {
    console.log("[Email] Sending approval notification:", {
      type: notification.type,
      requestId: notification.request.id,
      recipients: notification.recipients
    });
  }
};
var WebhookNotifier = class {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
  }
  async send(notification) {
    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notification)
      });
    } catch (error) {
      console.error("[Webhook] Failed to send notification:", error);
    }
  }
};
var SlackNotifier = class {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
  }
  async send(notification) {
    const message = this.formatSlackMessage(notification);
    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
      });
    } catch (error) {
      console.error("[Slack] Failed to send notification:", error);
    }
  }
  formatSlackMessage(notification) {
    const { request } = notification;
    return {
      text: `Approval ${notification.type}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Approval Request: ${request.action}*
Tier: ${request.tier}
Status: ${request.status}`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Requested by:*
${request.requestedBy.userId}`
            },
            {
              type: "mrkdwn",
              text: `*Required Approvers:*
${request.requiredApprovers}`
            }
          ]
        }
      ]
    };
  }
};
var ApprovalNotifier = class {
  channels = [];
  addChannel(channel) {
    this.channels.push(channel);
  }
  async notify(notification) {
    await Promise.all(
      this.channels.map((channel) => channel.send(notification))
    );
  }
  async notifyApprovalRequested(request, recipients) {
    await this.notify({
      type: "approval_requested",
      request,
      recipients
    });
  }
  async notifyApprovalDecided(request, recipients) {
    await this.notify({
      type: "approval_decided",
      request,
      recipients
    });
  }
  async notifyApprovalExpired(request, recipients) {
    await this.notify({
      type: "approval_expired",
      request,
      recipients
    });
  }
};

export { ApprovalError, ApprovalNotifier, ApprovalQueue, ApprovalRulesEngine, EmailNotifier, SlackNotifier, WebhookNotifier, getDefaultRules };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map