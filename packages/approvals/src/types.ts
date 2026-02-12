/**
 * Approval system types
 */

export type ApprovalTier = 'none' | 'tier1' | 'tier2' | 'tier3';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalRequest {
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
  requiredApprovers: number; // 1 for tier2, 2 for tier3
  approvals: Approval[];
  status: ApprovalStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface Approval {
  approverId: string;
  approverName: string;
  decision: 'approve' | 'reject';
  reason?: string;
  approvedAt: Date;
}

export interface ApprovalRule {
  action: string;
  condition: (input: any) => boolean;
  tier: ApprovalTier;
  requiredApprovers?: number;
  autoApprove?: boolean;
}

export class ApprovalError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'ApprovalError';
  }
}
