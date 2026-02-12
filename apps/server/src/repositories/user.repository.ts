/**
 * User repository - Database operations for users
 */

import { prisma } from '../utils/database.js';
import type { User, Prisma } from '@prisma/client';

export class UserRepository {
  /**
   * Create a new user
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  /**
   * Find users by tenant
   */
  async findByTenant(tenantId: string): Promise<User[]> {
    return prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update user
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update last login
   */
  async updateLastLogin(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<User> {
    return prisma.user.delete({ where: { id } });
  }

  /**
   * List users with pagination
   */
  async list(options?: {
    skip?: number;
    take?: number;
    tenantId?: string;
    role?: string;
  }): Promise<{ users: User[]; total: number }> {
    const where: Prisma.UserWhereInput = {};

    if (options?.tenantId) {
      where.tenantId = options.tenantId;
    }

    if (options?.role) {
      where.role = options.role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * Check if user exists
   */
  async exists(email: string): Promise<boolean> {
    const count = await prisma.user.count({ where: { email } });
    return count > 0;
  }
}

export const userRepository = new UserRepository();
