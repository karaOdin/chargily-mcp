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
3. {{#if include_customer_history}}If include_customer_history is true, fetch customer details and recent transactions{{/if}}
4. Check for common failure patterns:
   - Insufficient funds
   - Invalid card details
   - Network timeouts
   - Payment method restrictions
5. Review similar failures in the last 24 hours

Provide a structured report with:
- Root cause analysis
- Customer payment history (if requested)
- Recommended actions for merchant
- Suggested customer communication`,
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

Use the chargily://reports/daily resource to fetch today's data.

INCLUDE IN REPORT:
1. **Key Metrics**
   - Total transactions
   - Successful payments vs failed
   - Total revenue and net revenue (after fees)
   - Average transaction value
   - Success rate percentage

2. **Revenue Breakdown**
   - By payment method (EDAHABIA, CIB, Chargily App)
   - Hourly trend analysis
   - Peak transaction times

3. **Issues & Alerts**
   - Failed payments and reasons
   - Unusual patterns or spikes
   - Fraud signals if any

4. **Actionable Insights**
   - Recommendations for improving conversion
   - Suggested payment method promotions
   - Customer engagement opportunities

{{#if include_comparison}}
Compare all metrics with the previous day and highlight significant changes.
{{/if}}

Format as a professional executive summary.`,
  },

  {
    name: 'customer_support_helper',
    description: 'Help customer support resolve payment and account issues',
    arguments: {
      customer_id: { type: 'string', required: false, description: 'Customer ID to look up' },
      issue_type: { type: 'string', required: true, description: 'Type of issue: payment_failed, refund_request, account_question' },
      context: { type: 'string', required: false, description: 'Additional context about the issue' },
    },
    template: `You are a customer support assistant for Chargily Pay merchants.

CUSTOMER ISSUE: {{issue_type}}
{{#if customer_id}}CUSTOMER ID: {{customer_id}}{{/if}}
{{#if context}}CONTEXT: {{context}}{{/if}}

SUPPORT WORKFLOW:

{{#if customer_id}}
1. Look up customer profile using chargily://customers/{{customer_id}}
2. Review recent transaction history
3. Check for patterns (multiple failures, refund history)
{{/if}}

ISSUE-SPECIFIC GUIDANCE:

**If payment_failed:**
- Check the specific checkout details
- Identify failure reason (network, funds, validation)
- Verify payment method availability
- Suggest alternative payment methods if applicable
- Provide customer-friendly explanation

**If refund_request:**
- Locate the original transaction
- Verify transaction is eligible for refund
- Check merchant refund policy
- Calculate refund amount (full/partial)
- Explain refund timeline (typically 5-7 business days for Algerian banks)

**If account_question:**
- Review customer account details
- Check transaction history
- Verify account status
- Answer specific questions about balance, fees, or limits

Provide:
1. Summary of the situation
2. Step-by-step resolution
3. Customer communication script
4. Follow-up actions needed`,
  },

  {
    name: 'create_checkout_flow',
    description: 'Guide through the process of creating a checkout',
    arguments: {
      amount: { type: 'number', required: true, description: 'Amount in DZD cents (e.g., 10000 for 100 DZD)' },
      customer_email: { type: 'string', required: false, description: 'Customer email address' },
      product_name: { type: 'string', required: false, description: 'Product or service name' },
    },
    template: `You are a Chargily Pay integration assistant helping create a checkout.

CHECKOUT DETAILS:
- Amount: {{amount}} DZD cents ({{amount / 100}} DZD)
{{#if customer_email}}- Customer Email: {{customer_email}}{{/if}}
{{#if product_name}}- Product: {{product_name}}{{/if}}

CHECKOUT CREATION WORKFLOW:

1. **Validate Amount**
   - Minimum: 50 DZD (5000 cents)
   - Maximum: 100,000 DZD (10,000,000 cents)
   - Your amount: {{amount / 100}} DZD ✓

2. **Customer Setup** (if new customer)
   {{#if customer_email}}
   - Search for existing customer with email: {{customer_email}}
   - If not found, create new customer using create_customer tool
   {{else}}
   - No customer email provided, checkout will be anonymous
   {{/if}}

3. **Create Checkout**
   Use create_checkout tool with:
   - amount: {{amount}}
   - currency: "dzd"
   - success_url: "https://yoursite.com/success"
   - failure_url: "https://yoursite.com/failure"
   {{#if customer_email}}- customer_id: (from step 2){{/if}}
   {{#if product_name}}- description: "{{product_name}}"{{/if}}
   - payment_method: "edahabia" (default) or "cib"

4. **Payment URL**
   - Checkout will return a checkout_url
   - Share this URL with customer
   - Customer completes payment on Chargily's secure page

5. **Webhook Confirmation**
   - You'll receive webhook at your endpoint when payment succeeds
   - Event type: checkout.paid

Execute these steps now and provide the payment URL.`,
  },

  {
    name: 'reconciliation_report',
    description: 'Generate financial reconciliation report for accounting',
    arguments: {
      start_date: { type: 'string', required: true, description: 'Start date YYYY-MM-DD' },
      end_date: { type: 'string', required: true, description: 'End date YYYY-MM-DD' },
      include_fees: { type: 'boolean', required: false, description: 'Include fee breakdown' },
    },
    template: `You are a financial reconciliation specialist for Chargily Pay.

RECONCILIATION PERIOD: {{start_date}} to {{end_date}}

TASK: Generate a complete reconciliation report for accounting purposes.

DATA COLLECTION:
1. Fetch all transactions for the period using list_checkouts
2. Use chargily://reports/daily for each day in range
3. Get current balance from chargily://balance/current

RECONCILIATION REPORT STRUCTURE:

**1. Transaction Summary**
- Total transactions initiated
- Successful payments (paid status)
- Failed payments
- Canceled/expired checkouts
- Pending checkouts

**2. Financial Summary**
- Gross revenue (sum of successful payments)
{{#if include_fees}}
- Total Chargily fees
- Net revenue (after fees)
- Fee percentage
{{/if}}
- Refunds issued (if any)
- Net settlement amount

**3. Payment Method Breakdown**
- EDAHABIA transactions and amounts
- CIB transactions and amounts
- Chargily App transactions and amounts

**4. Daily Breakdown**
Table showing each day with:
- Date
- Transaction count
- Gross amount
- Net amount
- Success rate

**5. Exceptions & Adjustments**
- List any failed transactions
- Disputed amounts
- Pending settlements

**6. Reconciliation Verification**
- Beginning balance (if available)
- Plus: Total successful payments
- Minus: Fees and refunds
- Expected ending balance
- Actual ending balance from API
- Variance (should be 0)

Format as a formal accounting document suitable for financial records.`,
  },

  {
    name: 'fraud_signal_summary',
    description: 'Analyze fraud signals and suspicious patterns',
    arguments: {
      time_period: { type: 'string', required: false, description: 'Time period to analyze: 24h, 7d, 30d (default: 24h)' },
      threshold: { type: 'string', required: false, description: 'Alert threshold: low, medium, high (default: medium)' },
    },
    template: `You are a fraud detection analyst for Chargily Pay.

ANALYSIS PERIOD: {{time_period}}
ALERT THRESHOLD: {{threshold}}

TASK: Identify and analyze potential fraud signals and suspicious patterns.

DATA SOURCES:
1. chargily://analytics/fraud-signals
2. Recent transactions from chargily://transactions/recent
3. Failed payment patterns
4. Customer behavior anomalies

FRAUD SIGNAL ANALYSIS:

**1. High-Risk Patterns**
Identify:
- Multiple failed payment attempts from same customer
- Unusual transaction amounts (significantly above average)
- Rapid succession of transactions
- Transactions from new customers with high values
- Payment methods switching (testing cards)

**2. Failure Rate Analysis**
- Overall failure rate
- Failure rate by payment method
- Failure rate by customer segment
- Time-based failure patterns

**3. Geographic Anomalies**
- Unusual locations (if available)
- VPN/proxy indicators
- Cross-border inconsistencies

**4. Customer Behavior**
- First-time customers with high-value orders
- Customers with multiple failed attempts
- Accounts with mismatched information

**5. Risk Scoring**
For each suspicious transaction:
- Risk level: LOW / MEDIUM / HIGH / CRITICAL
- Fraud indicators present
- Recommended action

**6. Recommendations**
- Immediate actions needed
- Additional verification steps
- Payment method restrictions
- Customer communication approach
- Long-term fraud prevention strategies

ALERT LEVELS:
- LOW: Monitor only
- MEDIUM: Review before settlement
- HIGH: Hold payment for manual review
- CRITICAL: Block transaction, contact customer

Generate detailed report with specific transaction IDs and actionable recommendations.`,
  },

  {
    name: 'monthly_business_review',
    description: 'Comprehensive monthly business performance analysis',
    arguments: {
      month: { type: 'string', required: true, description: 'Month in YYYY-MM format' },
      compare_previous: { type: 'boolean', required: false, description: 'Compare with previous month' },
    },
    template: `You are a business intelligence analyst for Chargily Pay merchants.

REVIEW PERIOD: {{month}}

TASK: Generate comprehensive monthly business review with insights and recommendations.

DATA COLLECTION:
1. chargily://reports/monthly?month={{month}}
2. chargily://customers/top for customer insights
3. chargily://analytics/conversion for performance metrics
4. chargily://products/catalog for product performance

BUSINESS REVIEW STRUCTURE:

**EXECUTIVE SUMMARY**
- Key metrics at a glance
- Month-over-month growth
- Major achievements
- Critical issues

**1. REVENUE ANALYSIS**
- Total revenue and transaction volume
- Average transaction value
- Revenue by payment method
- Daily revenue trends
- Peak sales periods

**2. CUSTOMER INSIGHTS**
- New vs returning customers
- Top customers by spend
- Customer acquisition cost
- Customer lifetime value indicators
- Customer retention signals

**3. PRODUCT PERFORMANCE**
- Best-selling products/services
- Revenue by product category
- Product conversion rates
- Underperforming products

**4. OPERATIONAL METRICS**
- Payment success rate
- Average checkout completion time
- Payment method preferences
- Failed transaction analysis
- Refund rate

**5. GROWTH OPPORTUNITIES**
- Underutilized payment methods
- Customer segments to target
- Pricing optimization suggestions
- Cross-sell/upsell opportunities
- Marketing campaign ideas

**6. RISK & CHALLENGES**
- Fraud indicators
- Technical issues
- Customer complaints
- Competitive threats

**7. RECOMMENDATIONS**
Priority actions for next month:
1. [Most impactful action]
2. [Quick wins]
3. [Long-term strategies]

{{#if compare_previous}}
**MONTH-OVER-MONTH COMPARISON**
Compare all metrics with previous month and highlight:
- Significant improvements ✓
- Areas of concern ⚠️
- Trends to monitor 👁️
{{/if}}

Format as a professional business review suitable for stakeholders.`,
  },

  {
    name: 'refund_investigation',
    description: 'Investigate refund request and determine eligibility',
    arguments: {
      checkout_id: { type: 'string', required: true, description: 'Checkout ID for refund' },
      refund_reason: { type: 'string', required: false, description: 'Reason for refund request' },
      requested_amount: { type: 'number', required: false, description: 'Partial refund amount in DZD cents' },
    },
    template: `You are a refund specialist for Chargily Pay.

REFUND REQUEST DETAILS:
- Checkout ID: {{checkout_id}}
{{#if refund_reason}}- Reason: {{refund_reason}}{{/if}}
{{#if requested_amount}}- Requested Amount: {{requested_amount / 100}} DZD{{/if}}

TASK: Investigate and process refund request following merchant policies.

INVESTIGATION WORKFLOW:

**1. Verify Transaction**
- Fetch checkout details using get_checkout tool
- Verify transaction status (must be "paid")
- Check transaction date (within refund window?)
- Original amount and payment method

**2. Eligibility Check**
✓ Transaction exists and is paid
✓ Within refund period (typically 30 days)
✓ No previous refund issued
✓ Merchant refund policy allows
{{#if requested_amount}}
✓ Partial refund amount ≤ original amount
{{/if}}

**3. Customer Verification**
- Fetch customer details
- Check refund history
- Verify legitimacy of request
- Check for abuse patterns

**4. Refund Calculation**
{{#if requested_amount}}
- Requested: {{requested_amount / 100}} DZD
- Original: [fetch from checkout]
- Refund fees: [calculate based on policy]
{{else}}
- Full refund of original amount
- Chargily fees: [typically not refunded]
{{/if}}

**5. Processing**
If approved:
- Refund method: Original payment method
- Processing time: 5-7 business days (Algerian banks)
- Customer notification required
- Update transaction records

**6. Decision & Communication**

DECISION: [APPROVED / DENIED / REQUIRES MANAGER REVIEW]

REASONING:
[Detailed explanation of decision]

CUSTOMER COMMUNICATION:
[Draft email/message for customer]

MERCHANT ACTIONS:
[Steps merchant needs to take]

Note: Chargily Pay V2 API refund endpoints coming soon. For now, manual processing required.`,
  },

  {
    name: 'customer_lifecycle',
    description: 'Analyze customer journey and lifecycle value',
    arguments: {
      customer_id: { type: 'string', required: true, description: 'Customer ID to analyze' },
      include_predictions: { type: 'boolean', required: false, description: 'Include predictive insights' },
    },
    template: `You are a customer analytics specialist for Chargily Pay.

CUSTOMER: {{customer_id}}

TASK: Comprehensive customer lifecycle analysis with actionable insights.

DATA COLLECTION:
1. chargily://customers/{{customer_id}} - Full customer profile
2. All transactions for this customer
3. Payment patterns and behavior

LIFECYCLE ANALYSIS:

**1. CUSTOMER PROFILE**
- Account created date
- Contact information
- Segment classification

**2. TRANSACTION HISTORY**
- First transaction date
- Most recent transaction
- Total transactions count
- Total amount spent
- Average order value
- Purchase frequency

**3. PAYMENT BEHAVIOR**
- Preferred payment method
- Success rate
- Failed attempts
- Refund history
- Average time to complete checkout

**4. VALUE METRICS**
- Lifetime value (LTV)
- Average purchase frequency
- Days since last purchase
- Customer tenure

**5. ENGAGEMENT PATTERNS**
- Active periods (days/times of transactions)
- Seasonal trends
- Product preferences
- Shopping cart patterns

**6. LIFECYCLE STAGE**
Classify customer as:
- NEW: 0-30 days, first purchase
- ACTIVE: Regular purchases, high engagement
- AT_RISK: No purchase in 30+ days
- CHURNED: No purchase in 90+ days
- VIP: Top 10% spender

**7. RISK ASSESSMENT**
- Churn probability
- Fraud risk score
- Payment failure risk

{{#if include_predictions}}
**8. PREDICTIVE INSIGHTS**
- Next purchase probability
- Predicted next purchase date
- Estimated next order value
- Recommended offers
- Churn prevention strategies
{{/if}}

**9. RECOMMENDATIONS**
Personalized actions:
- Re-engagement campaigns
- Upsell/cross-sell opportunities
- Loyalty rewards suggestions
- Payment method incentives
- Communication timing

Generate insights that merchants can act on immediately.`,
  },

  {
    name: 'payment_optimization',
    description: 'Analyze payment flow and suggest optimizations',
    arguments: {
      focus_area: { type: 'string', required: false, description: 'Focus area: conversion, speed, methods, fees' },
      time_range: { type: 'string', required: false, description: 'Analysis time range: 7d, 30d, 90d (default: 30d)' },
    },
    template: `You are a payment optimization consultant for Chargily Pay.

OPTIMIZATION FOCUS: {{focus_area}}
ANALYSIS PERIOD: {{time_range}}

TASK: Analyze payment performance and provide actionable optimization recommendations.

DATA ANALYSIS:
1. chargily://analytics/conversion - Conversion metrics
2. chargily://reports/monthly - Revenue data
3. Recent transactions patterns
4. Payment method performance

OPTIMIZATION ANALYSIS:

**1. CONVERSION RATE OPTIMIZATION**
Current Performance:
- Overall conversion rate
- Conversion by payment method
- Checkout abandonment rate
- Failed payment rate

Recommendations:
- Checkout flow improvements
- Payment method additions
- Error message clarity
- Mobile optimization
- One-click payment options

**2. PROCESSING SPEED**
Performance Metrics:
- Average checkout completion time
- Payment processing latency
- Webhook delivery time

Speed Improvements:
- Cache optimization
- API call reduction
- Parallel processing opportunities
- Error handling improvements

**3. PAYMENT METHOD STRATEGY**
Current Mix:
- EDAHABIA usage %
- CIB usage %
- Chargily App usage %

Optimization:
- Underutilized method promotion
- Payment method routing
- Fallback strategies
- Local method preferences
- Cost-benefit analysis per method

**4. FEE OPTIMIZATION**
Cost Analysis:
- Total fees paid
- Fee percentage of revenue
- Fee by payment method
- Volume-based fee opportunities

Savings Strategies:
- Payment method selection
- Transaction batching
- Fee structure negotiation
- Cost allocation to customers

**5. TECHNICAL OPTIMIZATIONS**
- API usage efficiency
- Webhook reliability
- Error rate reduction
- Retry logic optimization
- Idempotency implementation

**6. USER EXPERIENCE**
- Checkout page improvements
- Mobile responsiveness
- Payment method display
- Error messaging
- Success confirmation

**7. FRAUD & SECURITY**
- Balance security with friction
- Risk-based authentication
- Payment limit optimization
- Fraud detection tuning

**PRIORITY RECOMMENDATIONS**
Ranked by impact and effort:

HIGH IMPACT, LOW EFFORT:
1. [Quick wins]

HIGH IMPACT, HIGH EFFORT:
1. [Strategic improvements]

QUICK FIXES:
1. [Immediate actions]

**IMPLEMENTATION ROADMAP**
Week 1: [Actions]
Week 2-4: [Actions]
Month 2-3: [Strategic initiatives]

**EXPECTED OUTCOMES**
- Conversion rate improvement: +X%
- Average transaction value: +X%
- Processing cost reduction: -X%
- Customer satisfaction: +X points

Generate specific, measurable recommendations with implementation guidance.`,
  },
];
