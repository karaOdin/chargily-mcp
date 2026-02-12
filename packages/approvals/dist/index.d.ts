/**
 * Approval system types
 */
type ApprovalTier = 'none' | 'tier1' | 'tier2' | 'tier3';
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
interface ApprovalRequest {
    id: string;
    tier: ApprovalTier;
    action: string;
    resourceType: string;
    resourceId?: string;
    requestedBy: {
        userId: string;
        tenantId?: string;
        agentType: 'human' | 'ai_agent' | 'voice_agent';
    };
    inputData: any;
    requiredApprovers: number;
    approvals: Approval[];
    status: ApprovalStatus;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    metadata?: Record<string, any>;
}
interface Approval {
    approverId: string;
    approverName: string;
    decision: 'approve' | 'reject';
    reason?: string;
    approvedAt: Date;
}
interface ApprovalRule {
    action: string;
    condition: (input: any) => boolean;
    tier: ApprovalTier;
    requiredApprovers?: number;
    autoApprove?: boolean;
}
declare class ApprovalError extends Error {
    code: string;
    constructor(message: string, code: string);
}

/**
 * Redis-based approval queue
 */

declare class ApprovalQueue {
    private redis;
    private keyPrefix;
    constructor(redisUrl?: string);
    /**
     * Add approval request to queue
     */
    enqueue(request: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApprovalRequest>;
    /**
     * Get approval request by ID
     */
    get(id: string): Promise<ApprovalRequest | null>;
    /**
     * Update approval request
     */
    update(id: string, updates: Partial<ApprovalRequest>): Promise<ApprovalRequest>;
    /**
     * Add approval to request
     */
    addApproval(id: string, approval: Approval): Promise<ApprovalRequest>;
    /**
     * List pending approvals
     */
    listPending(options?: {
        limit?: number;
        tenantId?: string;
    }): Promise<ApprovalRequest[]>;
    /**
     * Expire old pending approvals
     */
    expireOld(): Promise<number>;
    /**
     * Wait for approval decision
     */
    waitForDecision(id: string, timeout?: number): Promise<ApprovalRequest>;
    private generateId;
    private getTTL;
    close(): Promise<void>;
}

/**
 * Approval rules engine
 */

declare class ApprovalRulesEngine {
    private rules;
    /**
     * Add approval rule
     */
    addRule(rule: ApprovalRule): void;
    /**
     * Determine approval tier for action
     */
    determineApprovalTier(action: string, input: any): ApprovalTier;
    /**
     * Check if action should auto-approve
     */
    shouldAutoApprove(action: string, input: any): boolean;
    /**
     * Get required approvers count
     */
    getRequiredApprovers(tier: ApprovalTier): number;
}
/**
 * Default approval rules for Chargily operations
 */
declare function getDefaultRules(): ApprovalRule[];

/**
 * Approval notification system
 */

interface NotificationChannel {
    send(notification: ApprovalNotification): Promise<void>;
}
interface ApprovalNotification {
    type: 'approval_requested' | 'approval_decided' | 'approval_expired';
    request: ApprovalRequest;
    recipients: string[];
    metadata?: Record<string, any>;
}
/**
 * Email notification channel (stub)
 */
declare class EmailNotifier implements NotificationChannel {
    send(notification: ApprovalNotification): Promise<void>;
}
/**
 * Webhook notification channel
 */
declare class WebhookNotifier implements NotificationChannel {
    private webhookUrl;
    constructor(webhookUrl: string);
    send(notification: ApprovalNotification): Promise<void>;
}
/**
 * Slack notification channel (stub)
 */
declare class SlackNotifier implements NotificationChannel {
    private webhookUrl;
    constructor(webhookUrl: string);
    send(notification: ApprovalNotification): Promise<void>;
    private formatSlackMessage;
}
/**
 * Multi-channel notifier
 */
declare class ApprovalNotifier {
    private channels;
    addChannel(channel: NotificationChannel): void;
    notify(notification: ApprovalNotification): Promise<void>;
    notifyApprovalRequested(request: ApprovalRequest, recipients: string[]): Promise<void>;
    notifyApprovalDecided(request: ApprovalRequest, recipients: string[]): Promise<void>;
    notifyApprovalExpired(request: ApprovalRequest, recipients: string[]): Promise<void>;
}

export { type Approval, ApprovalError, type ApprovalNotification, ApprovalNotifier, ApprovalQueue, type ApprovalRequest, type ApprovalRule, ApprovalRulesEngine, type ApprovalStatus, type ApprovalTier, EmailNotifier, type NotificationChannel, SlackNotifier, WebhookNotifier, getDefaultRules };
