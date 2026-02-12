/**
 * Approval rules engine
 */

import type { ApprovalTier, ApprovalRule } from './types';

export class ApprovalRulesEngine {
  private rules: ApprovalRule[] = [];

  /**
   * Add approval rule
   */
  addRule(rule: ApprovalRule): void {
    this.rules.push(rule);
  }

  /**
   * Determine approval tier for action
   */
  determineApprovalTier(action: string, input: any): ApprovalTier {
    // Find matching rules
    const matchingRules = this.rules.filter(
      (rule) => rule.action === action && rule.condition(input)
    );

    // If no rules match, default to none
    if (matchingRules.length === 0) {
      return 'none';
    }

    // Return highest tier
    const tiers: ApprovalTier[] = ['none', 'tier1', 'tier2', 'tier3'];
    const maxTier = matchingRules.reduce((max, rule) => {
      const currentIndex = tiers.indexOf(rule.tier);
      const maxIndex = tiers.indexOf(max);
      return currentIndex > maxIndex ? rule.tier : max;
    }, 'none' as ApprovalTier);

    return maxTier;
  }

  /**
   * Check if action should auto-approve
   */
  shouldAutoApprove(action: string, input: any): boolean {
    const matchingRules = this.rules.filter(
      (rule) => rule.action === action && rule.condition(input)
    );

    return matchingRules.some((rule) => rule.autoApprove === true);
  }

  /**
   * Get required approvers count
   */
  getRequiredApprovers(tier: ApprovalTier): number {
    switch (tier) {
      case 'tier1':
        return 0; // Auto-approve
      case 'tier2':
        return 1;
      case 'tier3':
        return 2;
      default:
        return 0;
    }
  }
}

/**
 * Default approval rules for Chargily operations
 */
export function getDefaultRules(): ApprovalRule[] {
  return [
    // Checkout approval based on amount
    {
      action: 'create_checkout',
      condition: (input) => input.amount < 5000, // < 50 DZD
      tier: 'tier1',
      autoApprove: true,
    },
    {
      action: 'create_checkout',
      condition: (input) => input.amount >= 5000 && input.amount < 100000,
      tier: 'tier2',
    },
    {
      action: 'create_checkout',
      condition: (input) => input.amount >= 100000, // >= 1000 DZD
      tier: 'tier3',
    },

    // Customer deletion requires approval
    {
      action: 'delete_customer',
      condition: () => true,
      tier: 'tier2',
    },

    // Customer update with email/phone change
    {
      action: 'update_customer',
      condition: (input) => input.email || input.phone,
      tier: 'tier2',
    },

    // Checkout cancellation
    {
      action: 'cancel_checkout',
      condition: () => true,
      tier: 'tier2',
    },

    // Checkout expiration
    {
      action: 'expire_checkout',
      condition: () => true,
      tier: 'tier2',
    },
  ];
}
