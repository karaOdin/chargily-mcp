/**
 * Approval routes - Manage approval workflow
 */

import { Router, Request, Response, NextFunction } from 'express';
import { approvalService } from '../../services/approval.service.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { AppError } from '../../middleware/error-handler.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /api/v1/approvals/pending
 * List pending approval requests
 */
router.get('/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated', 'unauthorized');
    }

    const skip = parseInt(req.query.skip as string) || 0;
    const take = parseInt(req.query.take as string) || 50;

    // Admin can see all, users see only their own
    const options = req.user.role === 'admin'
      ? { skip, take }
      : { userId: req.user.id, skip, take };

    const result = await approvalService.listPending(options);

    res.json({
      approvals: result.requests.map((request) => ({
        id: request.id,
        action: request.action,
        tier: request.tier,
        input: request.input,
        status: request.status,
        requiredApprovers: request.requiredApprovers,
        approvals: request.approvals,
        expiresAt: request.expiresAt,
        createdAt: request.createdAt,
        user: {
          id: request.user.id,
          email: request.user.email,
          name: request.user.name,
        },
      })),
      total: result.total,
      skip,
      take,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/approvals/:id/approve
 * Approve an approval request
 */
router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated', 'unauthorized');
    }

    // Only admins can approve
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
      throw new AppError(403, 'Only admins can approve requests', 'forbidden');
    }

    const { id } = req.params;
    const { reason } = req.body;

    const result = await approvalService.addDecision(
      id,
      req.user.id,
      'approve',
      reason
    );

    res.json({
      approval: {
        id: result.id,
        status: result.status,
        approvals: result.approvals,
        completedAt: result.completedAt,
      },
      message: 'Approval granted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/approvals/:id/reject
 * Reject an approval request
 */
router.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated', 'unauthorized');
    }

    // Only admins can reject
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
      throw new AppError(403, 'Only admins can reject requests', 'forbidden');
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new AppError(400, 'Rejection reason is required', 'validation_error');
    }

    const result = await approvalService.addDecision(
      id,
      req.user.id,
      'reject',
      reason
    );

    res.json({
      approval: {
        id: result.id,
        status: result.status,
        reason: result.reason,
        completedAt: result.completedAt,
      },
      message: 'Approval rejected',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/approvals/stats
 * Get approval statistics
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated', 'unauthorized');
    }

    const filters = req.user.role === 'admin'
      ? {}
      : { userId: req.user.id };

    const stats = await approvalService.getStats(filters);

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
