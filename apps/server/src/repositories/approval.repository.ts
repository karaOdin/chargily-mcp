/**
 * Approval Request repository - Database operations for approvals
 */

import { prisma } from '../utils/database.js';
import type { ApprovalRequest, Prisma } from '@prisma/client';

export class ApprovalRepository {
  /**
   * Create approval request
   */
  async create(data: Prisma.ApprovalRequestCreateInput): Promise<ApprovalRequest> {
    return prisma.approvalRequest.create({ data });
  }

  /**
   * Find approval by ID
   */
  async findById(id: string): Promise<ApprovalRequest | null> {
    return prisma.approvalRequest.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  /**
   * Update approval request
   */
  async update(
    id: string,
    data: Prisma.ApprovalRequestUpdateInput
  ): Promise<ApprovalRequest> {
    return prisma.approvalRequest.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Add approval to request
   */
  async addApproval(
    id: string,
    approval: {
      approverId: string;
      decision: 'approve' | 'reject';
      reason?: string;
      timestamp: Date;
    }
  ): Promise<ApprovalRequest> {
    const request = await this.findById(id);
    if (!request) {
      throw new Error('Approval request not found');
    }

    const approvals = Array.isArray(request.approvals)
      ? [...request.approvals, approval]
      : [approval];

    // Check if approved or rejected
    const rejections = approvals.filter((a: any) => a.decision === 'reject');
    const approved = approvals.filter((a: any) => a.decision === 'approve');

    let status = request.status;
    let completedAt = request.completedAt;

    if (rejections.length > 0) {
      status = 'rejected';
      completedAt = new Date();
    } else if (approved.length >= request.requiredApprovers) {
      status = 'approved';
      completedAt = new Date();
    }

    return this.update(id, {
      approvals,
      status,
      completedAt,
      reason: approval.decision === 'reject' ? approval.reason : undefined,
    });
  }

  /**
   * List pending approvals
   */
  async listPending(options?: {
    skip?: number;
    take?: number;
    userId?: string;
    tenantId?: string;
  }): Promise<{ requests: ApprovalRequest[]; total: number }> {
    const where: Prisma.ApprovalRequestWhereInput = {
      status: 'pending',
      expiresAt: { gt: new Date() },
    };

    if (options?.userId) {
      where.userId = options.userId;
    }

    if (options?.tenantId) {
      where.tenantId = options.tenantId;
    }

    const [requests, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      }),
      prisma.approvalRequest.count({ where }),
    ]);

    return { requests, total };
  }

  /**
   * Expire old pending approvals
   */
  async expireOld(): Promise<number> {
    const result = await prisma.approvalRequest.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'expired',
        completedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Get approval statistics
   */
  async getStats(filters?: {
    userId?: string;
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
  }> {
    const where: Prisma.ApprovalRequestWhereInput = {};

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.tenantId) where.tenantId = filters.tenantId;

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [total, pending, approved, rejected, expired] = await Promise.all([
      prisma.approvalRequest.count({ where }),
      prisma.approvalRequest.count({ where: { ...where, status: 'pending' } }),
      prisma.approvalRequest.count({ where: { ...where, status: 'approved' } }),
      prisma.approvalRequest.count({ where: { ...where, status: 'rejected' } }),
      prisma.approvalRequest.count({ where: { ...where, status: 'expired' } }),
    ]);

    return { total, pending, approved, rejected, expired };
  }

  /**
   * Delete approval request
   */
  async delete(id: string): Promise<ApprovalRequest> {
    return prisma.approvalRequest.delete({ where: { id } });
  }
}

export const approvalRepository = new ApprovalRepository();
