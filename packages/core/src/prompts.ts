/**
 * MCP Prompt Library
 * Pre-built prompt templates for common merchant tasks
 */

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: Record<string, { type: string; required: boolean; description?: string }>;
  template: string;
}

export const PROMPTS: PromptDefinition[] = [
  {
    name: 'investigate_failed_payment',
    description: 'Investigate why a specific payment failed and suggest remediation steps',
    arguments: {
      checkout_id: { type: 'string', required: true, description: 'The checkout ID to investigate' },
      include_customer_history: { type: 'boolean', required: false, description: 'Include customer payment history' },
    },
    template: `You are a payment investigation specialist for Chargily Pay.

TASK: Investigate why checkout {{checkout_id}} failed and provide actionable remediation steps.

INVESTIGATION STEPS:
1. Fetch checkout details using get_checkout tool
2. Analyze the status, payment_method, and any error codes
3. If include_customer_history is true, fetch customer details and recent transactions
4. Check for common failure patterns
5. Review similar failures in the last 24 hours

Provide a structured report with root cause analysis, customer history, and recommended actions.`,
  },
  {
    name: 'daily_finance_summary',
    description: 'Generate a comprehensive daily financial summary with insights',
    arguments: {
      date: { type: 'string', required: false, description: 'Date in YYYY-MM-DD format (default: today)' },
      include_comparison: { type: 'boolean', required: false, description: 'Compare with previous day' },
    },
    template: `You are a financial analyst generating the daily summary for Chargily Pay merchant.

TASK: Generate comprehensive daily financial report for {{date}}.

Include key metrics, revenue breakdown by payment method, issues & alerts, and actionable insights.`,
  },
  // Additional prompts defined in MCP_PROMPTS.md
];
