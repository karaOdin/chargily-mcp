/**
 * Approval Service
 * Handles approval workflow for sensitive operations
 */

import { approvalRepository, auditLogRepository } from '../repositories/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

export interface ApprovalRequest {
  action: string;
  input: any;
  tier: 'tier1' | 'tier2' | 'tier3';
  amount?: number;
  userId: string;
  tenantId?: string;
  requiredApprovers: number;
  expiresIn?: number; // seconds
}

export class ApprovalService {
  /**
   * Create approval request
   */
  async createApprovalRequest(request: ApprovalRequest) {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (request.expiresIn || 3600)); // Default 1 hour

    const approvalRequest = await approvalRepository.create({
      action: request.action,
      input: request.input,
      tier: request.tier,
      userId: request.userId,
      tenantId: request.tenantId,
      requestedBy: {
        userId: request.userId,
        tenantId: request.tenantId,
        timestamp: new Date().toISOString(),
      },
      requiredApprovers: request.requiredApprovers,
      expiresAt,
      user: { connect: { id: request.userId } },
    });

    logger.info(
      {
        approvalId: approvalRequest.id,
        action: request.action,
        tier: request.tier,
        requiredApprovers: request.requiredApprovers,
      },
      'Approval request created'
    );

    // Log audit trail
    await auditLogRepository.log({
      userId: request.userId,
      tenantId: request.tenantId,
      action: 'approval_request_created',
      resource: 'approval',
      resourceId: approvalRequest.id,
      input: request.input,
      success: true,
      metadata: {
        tier: request.tier,
        action: request.action,
      },
    });

    return approvalRequest;
  }

  /**
   * Add approval or rejection
   */
  async addDecision(
    approvalId: string,
    approverId: string,
    decision: 'approve' | 'reject',
    reason?: string
  ) {
    const approval = {
      approverId,
      decision,
      reason,
      timestamp: new Date(),
    };

    const updated = await approvalRepository.addApproval(approvalId, approval);

    logger.info(
      {
        approvalId,
        approverId,
        decision,
        status: updated.status,
      },
      'Approval decision added'
    );

    // Log audit trail
    await auditLogRepository.log({
      userId: approverId,
      action: `approval_${decision}`,
      resource: 'approval',
      resourceId: approvalId,
      input: { decision, reason },
      success: true,
      metadata: {
        finalStatus: updated.status,
      },
    });

    return updated;
  }

  /**
   * Check if action requires approval based on tier and amount
   */
  requiresApproval(tier: string, amount?: number): boolean {
    if (!config.approvalsEnabled) {
      return false;
    }

    const tier1Max = parseInt(process.env.APPROVAL_TIER1_MAX || '5000'); // 50 DZD
    const tier2Max = parseInt(process.env.APPROVAL_TIER2_MAX || '100000'); // 1,000 DZD
    const tier3Max = parseInt(process.env.APPROVAL_TIER3_MAX || '999999999'); // Unlimited

    switch (tier) {
      case 'none':
        return false;

      case 'tier1':
        return !amount || amount >= tier1Max;

      case 'tier2':
        return !amount || amount >= tier2Max;

      case 'tier3':
        // Always requires approval regardless of amount
        return true;

      default:
        return false;
    }
  }

  /**
   * Get required approvers count based on tier
   */
  getRequiredApprovers(tier: string): number {
    switch (tier) {
      case 'tier1':
        return parseInt(process.env.APPROVAL_TIER1_APPROVERS || '1');
      case 'tier2':
        return parseInt(process.env.APPROVAL_TIER2_APPROVERS || '2');
      case 'tier3':
        return parseInt(process.env.APPROVAL_TIER3_APPROVERS || '3');
      default:
        return 1;
    }
  }

  /**
   * Wait for approval (with polling)
   */
  async waitForApproval(
    approvalId: string,
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<{ approved: boolean; reason?: string }> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      const request = await approvalRepository.findById(approvalId);

      if (!request) {
        throw new Error('Approval request not found');
      }

      if (request.status === 'approved') {
        logger.info({ approvalId }, 'Approval granted');
        return { approved: true };
      }

      if (request.status === 'rejected') {
        logger.info({ approvalId, reason: request.reason }, 'Approval rejected');
        return { approved: false, reason: request.reason || 'Rejected by approver' };
      }

      if (request.status === 'expired') {
        logger.info({ approvalId }, 'Approval expired');
        return { approved: false, reason: 'Approval request expired' };
      }

      // Still pending, wait and poll again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Timeout
    logger.warn({ approvalId }, 'Approval wait timeout');
    return { approved: false, reason: 'Approval wait timeout' };
  }

  /**
   * Request and wait for approval
   */
  async requestApproval(request: ApprovalRequest): Promise<{
    approved: boolean;
    approvalId?: string;
    reason?: string;
  }> {
    // Check if approval is actually required
    if (!this.requiresApproval(request.tier, request.amount)) {
      logger.info({ action: request.action }, 'Approval not required, auto-approving');
      return { approved: true };
    }

    // Create approval request
    const approvalRequest = await this.createApprovalRequest(request);

    // Wait for approval
    const result = await this.waitForApproval(approvalRequest.id);

    return {
      approved: result.approved,
      approvalId: approvalRequest.id,
      reason: result.reason,
    };
  }

  /**
   * List pending approvals
   */
  async listPending(options?: {
    userId?: string;
    tenantId?: string;
    skip?: number;
    take?: number;
  }) {
    return approvalRepository.listPending(options);
  }

  /**
   * Get approval statistics
   */
  async getStats(filters?: {
    userId?: string;
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    return approvalRepository.getStats(filters);
  }

  /**
   * Expire old pending approvals (should be run periodically)
   */
  async expireOld() {
    const count = await approvalRepository.expireOld();
    logger.info({ count }, 'Expired old pending approvals');
    return count;
  }
}

export const approvalService = new ApprovalService();
