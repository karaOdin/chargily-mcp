/**
 * Audit Log repository - Database operations for audit logs
 */

import { prisma } from '../utils/database.js';
import type { AuditLog, Prisma } from '@prisma/client';

export class AuditLogRepository {
  /**
   * Create audit log entry
   */
  async create(data: Prisma.AuditLogCreateInput): Promise<AuditLog> {
    return prisma.auditLog.create({ data });
  }

  /**
   * Log action
   */
  async log(params: {
    userId: string;
    tenantId?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    input?: any;
    output?: any;
    statusCode?: number;
    success: boolean;
    error?: string;
    ipAddress?: string;
    userAgent?: string;
    duration?: number;
    approvalId?: string;
    approved?: boolean;
    metadata?: any;
  }): Promise<AuditLog> {
    return this.create({
      user: { connect: { id: params.userId } },
      tenantId: params.tenantId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      input: params.input || {},
      output: params.output || {},
      statusCode: params.statusCode,
      success: params.success,
      error: params.error,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      duration: params.duration,
      approvalId: params.approvalId,
      approved: params.approved || false,
      metadata: params.metadata,
    });
  }

  /**
   * Find logs by user
   */
  async findByUser(
    userId: string,
    options?: { skip?: number; take?: number }
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId },
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count({ where: { userId } }),
    ]);

    return { logs, total };
  }

  /**
   * Find logs by tenant
   */
  async findByTenant(
    tenantId: string,
    options?: { skip?: number; take?: number }
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId },
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count({ where: { tenantId } }),
    ]);

    return { logs, total };
  }

  /**
   * Find logs by action
   */
  async findByAction(
    action: string,
    options?: { skip?: number; take?: number; startDate?: Date; endDate?: Date }
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = { action };

    if (options?.startDate || options?.endDate) {
      where.timestamp = {};
      if (options.startDate) {
        where.timestamp.gte = options.startDate;
      }
      if (options.endDate) {
        where.timestamp.lte = options.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Search logs with filters
   */
  async search(filters: {
    userId?: string;
    tenantId?: string;
    action?: string;
    resource?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    skip?: number;
    take?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;
    if (filters.success !== undefined) where.success = filters.success;

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: filters.skip || 0,
        take: filters.take || 50,
        orderBy: { timestamp: 'desc' },
        include: { user: true },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get statistics
   */
  async getStats(filters?: {
    userId?: string;
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalLogs: number;
    successCount: number;
    failureCount: number;
    actionCounts: { action: string; count: number }[];
  }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.tenantId) where.tenantId = filters.tenantId;

    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    const [totalLogs, successCount, failureCount] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({ where: { ...where, success: true } }),
      prisma.auditLog.count({ where: { ...where, success: false } }),
    ]);

    // Get action counts
    const logs = await prisma.auditLog.findMany({
      where,
      select: { action: true },
    });

    const actionMap = new Map<string, number>();
    logs.forEach((log) => {
      actionMap.set(log.action, (actionMap.get(log.action) || 0) + 1);
    });

    const actionCounts = Array.from(actionMap.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalLogs,
      successCount,
      failureCount,
      actionCounts,
    };
  }

  /**
   * Delete old logs (for retention policy)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}

export const auditLogRepository = new AuditLogRepository();
