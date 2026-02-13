/**
 * API Key repository - Database operations for API keys
 */

import { prisma } from '../utils/database.js';
import type { ApiKey, Prisma } from '@prisma/client';

export class ApiKeyRepository {
  /**
   * Create a new API key
   */
  async create(data: Prisma.ApiKeyCreateInput): Promise<ApiKey> {
    return prisma.apiKey.create({ data });
  }

  /**
   * Find API key by ID
   */
  async findById(id: string): Promise<ApiKey | null> {
    return prisma.apiKey.findUnique({ where: { id } });
  }

  /**
   * Find API key by lookup hash (SHA-256)
   */
  async findByHashedKey(hashedKey: string): Promise<ApiKey | null> {
    return prisma.apiKey.findUnique({
      where: { lookupHash: hashedKey },  // Use lookupHash for fast SHA-256 lookup
      include: { user: true },
    });
  }

  /**
   * Find API keys by user
   */
  async findByUser(userId: string): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update API key
   */
  async update(id: string, data: Prisma.ApiKeyUpdateInput): Promise<ApiKey> {
    return prisma.apiKey.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id: string): Promise<ApiKey> {
    return prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Revoke API key
   */
  async revoke(id: string, revokedBy: string): Promise<ApiKey> {
    return prisma.apiKey.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy,
      },
    });
  }

  /**
   * Delete API key
   */
  async delete(id: string): Promise<ApiKey> {
    return prisma.apiKey.delete({ where: { id } });
  }

  /**
   * List API keys with pagination
   */
  async list(options?: {
    skip?: number;
    take?: number;
    userId?: string;
    tenantId?: string;
    isActive?: boolean;
  }): Promise<{ apiKeys: ApiKey[]; total: number }> {
    const where: Prisma.ApiKeyWhereInput = {};

    if (options?.userId) {
      where.userId = options.userId;
    }

    if (options?.tenantId) {
      where.tenantId = options.tenantId;
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const [apiKeys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      }),
      prisma.apiKey.count({ where }),
    ]);

    return { apiKeys, total };
  }

  /**
   * Clean up expired API keys
   */
  async cleanupExpired(): Promise<number> {
    const result = await prisma.apiKey.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() },
      },
      data: {
        isActive: false,
      },
    });

    return result.count;
  }
}

export const apiKeyRepository = new ApiKeyRepository();
