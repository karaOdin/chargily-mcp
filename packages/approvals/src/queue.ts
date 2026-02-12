/**
 * Redis-based approval queue
 */

import Redis from 'ioredis';
import type { ApprovalRequest, Approval, ApprovalStatus } from './types';
import { ApprovalError } from './types';

export class ApprovalQueue {
  private redis: Redis;
  private keyPrefix = 'chargily:approvals:';

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
  }

  /**
   * Add approval request to queue
   */
  async enqueue(request: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApprovalRequest> {
    const id = this.generateId();
    const now = new Date();

    const approvalRequest: ApprovalRequest = {
      ...request,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Store in Redis
    const key = `${this.keyPrefix}${id}`;
    await this.redis.setex(
      key,
      this.getTTL(request.expiresAt),
      JSON.stringify(approvalRequest)
    );

    // Add to pending queue
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
  async get(id: string): Promise<ApprovalRequest | null> {
    const key = `${this.keyPrefix}${id}`;
    const data = await this.redis.get(key);

    if (!data) return null;

    return JSON.parse(data);
  }

  /**
   * Update approval request
   */
  async update(id: string, updates: Partial<ApprovalRequest>): Promise<ApprovalRequest> {
    const request = await this.get(id);
    if (!request) {
      throw new ApprovalError(`Approval request ${id} not found`, 'not_found');
    }

    const updated: ApprovalRequest = {
      ...request,
      ...updates,
      updatedAt: new Date(),
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
  async addApproval(
    id: string,
    approval: Approval
  ): Promise<ApprovalRequest> {
    const request = await this.get(id);
    if (!request) {
      throw new ApprovalError(`Approval request ${id} not found`, 'not_found');
    }

    if (request.status !== 'pending') {
      throw new ApprovalError(
        `Cannot approve request with status ${request.status}`,
        'invalid_status'
      );
    }

    // Add approval
    request.approvals.push(approval);

    // Check if approved or rejected
    const rejections = request.approvals.filter((a) => a.decision === 'reject');
    const approvals = request.approvals.filter((a) => a.decision === 'approve');

    let newStatus: ApprovalStatus = 'pending';

    if (rejections.length > 0) {
      newStatus = 'rejected';
    } else if (approvals.length >= request.requiredApprovers) {
      newStatus = 'approved';
    }

    const updated = await this.update(id, {
      approvals: request.approvals,
      status: newStatus,
      completedAt: newStatus !== 'pending' ? new Date() : undefined,
    });

    // Remove from pending queue if completed
    if (newStatus !== 'pending') {
      await this.redis.zrem(`${this.keyPrefix}pending`, id);
    }

    return updated;
  }

  /**
   * List pending approvals
   */
  async listPending(options?: {
    limit?: number;
    tenantId?: string;
  }): Promise<ApprovalRequest[]> {
    const limit = options?.limit || 100;

    // Get IDs from sorted set
    const ids = await this.redis.zrange(
      `${this.keyPrefix}pending`,
      0,
      limit - 1
    );

    // Fetch all requests
    const requests = await Promise.all(
      ids.map((id) => this.get(id))
    );

    // Filter nulls and by tenant
    return requests.filter((r): r is ApprovalRequest => {
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
  async expireOld(): Promise<number> {
    const now = Date.now();
    const expired = await this.redis.zrangebyscore(
      `${this.keyPrefix}pending`,
      0,
      now
    );

    for (const id of expired) {
      await this.update(id, { status: 'expired' });
      await this.redis.zrem(`${this.keyPrefix}pending`, id);
    }

    return expired.length;
  }

  /**
   * Wait for approval decision
   */
  async waitForDecision(
    id: string,
    timeout: number = 300000 // 5 minutes
  ): Promise<ApprovalRequest> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const request = await this.get(id);

      if (!request) {
        throw new ApprovalError('Approval request not found', 'not_found');
      }

      if (request.status !== 'pending') {
        return request;
      }

      // Wait 1 second before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new ApprovalError('Approval timeout', 'timeout');
  }

  private generateId(): string {
    return `apr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getTTL(expiresAt: Date): number {
    return Math.max(Math.floor((expiresAt.getTime() - Date.now()) / 1000), 60);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
