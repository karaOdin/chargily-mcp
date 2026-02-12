# Chargily MCP - Prompt Library

Pre-built prompt templates for common merchant and support tasks.

## Prompt Categories

1. [Payment Investigation](#payment-investigation)
2. [Financial Reporting](#financial-reporting)
3. [Customer Support](#customer-support)
4. [Fraud Analysis](#fraud-analysis)
5. [Reconciliation](#reconciliation)
6. [Business Intelligence](#business-intelligence)

---

## Payment Investigation

### `investigate_failed_payment`

**Description**: Investigate why a specific payment failed and suggest remediation steps.

**Arguments**:
- `checkout_id` (required): The checkout ID to investigate
- `include_customer_history` (optional): Include customer's payment history (default: true)

**Template**:
```
You are a payment investigation specialist for Chargily Pay.

TASK: Investigate why checkout {{checkout_id}} failed and provide actionable remediation steps.

INVESTIGATION STEPS:
1. Fetch checkout details using get_checkout tool
2. Analyze the status, payment_method, and any error codes
3. If include_customer_history is true, fetch customer details and recent transactions
4. Check for common failure patterns:
   - Insufficient funds (EDAHABIA)
   - Card declined (CIB)
   - Network timeout
   - 3DS authentication failure
   - Webhook delivery failure
5. Review similar failures in the last 24 hours

DELIVERABLE:
Provide a structured report containing:

## Payment Failure Analysis

**Checkout ID**: {{checkout_id}}
**Amount**: [amount] DZD
**Payment Method**: [method]
**Failure Time**: [timestamp]
**Customer**: [name] ([email])

### Root Cause
[Detailed explanation of why the payment failed]

### Similar Failures
[Count of similar failures in last 24h, if applicable]

### Customer History
[Customer's success rate, total transactions, last successful payment]

### Recommended Actions
1. [Immediate action for merchant]
2. [Customer communication recommendation]
3. [Technical fixes if applicable]

### Prevention Steps
[How to prevent this failure type in the future]

---

Use the following tools to gather information:
- get_checkout
- get_customer
- list_checkouts (for similar failures)

Be thorough but concise. Focus on actionable insights.
```

**Example Invocation**:
```json
{
  "prompt": "investigate_failed_payment",
  "arguments": {
    "checkout_id": "checkout_abc123",
    "include_customer_history": true
  }
}
```

---

### `retry_failed_checkout`

**Description**: Guide merchant through retrying a failed checkout with optimizations.

**Arguments**:
- `checkout_id` (required): Original failed checkout ID
- `customer_id` (optional): Customer ID if different

**Template**:
```
You are helping a merchant retry a failed payment with the best chance of success.

TASK: Create an optimized retry strategy for checkout {{checkout_id}}.

STEPS:
1. Fetch the original checkout details
2. Analyze the failure reason
3. Suggest payment method alternatives:
   - If EDAHABIA failed → suggest CIB or Chargily App
   - If CIB failed → suggest EDAHABIA or lower amount
   - If timeout → suggest retry with same method
4. Calculate optimal retry timing based on failure type
5. Draft customer communication message
6. Create new checkout with optimizations

DELIVERABLE:
Provide a retry plan with:

## Retry Strategy for {{checkout_id}}

### Original Failure
- Reason: [failure reason]
- Method: [original payment method]
- Amount: [amount] DZD

### Recommended Approach
- New Payment Method: [recommended method and why]
- Amount Adjustment: [if applicable]
- Retry Timing: [immediate / 1 hour / 24 hours]

### Customer Message (French/Arabic)
[Draft message explaining the issue and asking for retry]

### Action
Would you like me to create the new checkout with these settings?
[Yes/No]

If yes, I'll create the checkout using create_checkout tool.

---

Use tools: get_checkout, create_checkout (if approved)
```

---

## Financial Reporting

### `daily_finance_summary`

**Description**: Generate a comprehensive daily financial summary with insights.

**Arguments**:
- `date` (optional): Date in YYYY-MM-DD format (default: today)
- `include_comparison` (optional): Compare with previous day (default: true)

**Template**:
```
You are a financial analyst generating the daily summary for Chargily Pay merchant.

TASK: Generate comprehensive daily financial report for {{date}}.

DATA TO GATHER:
1. Daily report from chargily://reports/daily resource
2. Transaction list from chargily://transactions/recent
3. Current balance from chargily://balance/current
4. Conversion analytics from chargily://analytics/conversion
5. If include_comparison: Previous day's data for comparison

REPORT STRUCTURE:

# Daily Financial Summary - {{date}}

## 📊 Key Metrics

| Metric | Value | Change from Yesterday |
|--------|-------|----------------------|
| Total Transactions | [count] | [+/- %] |
| Successful Payments | [count] | [+/- %] |
| Total Revenue | [amount] DZD | [+/- %] |
| Net Revenue | [after fees] DZD | [+/- %] |
| Average Order Value | [avg] DZD | [+/- %] |
| Conversion Rate | [%] | [+/- %] |

## 💰 Revenue Breakdown

### By Payment Method
- **EDAHABIA**: [amount] DZD ([count] txns) - [%] of total
- **CIB**: [amount] DZD ([count] txns) - [%] of total
- **Chargily App**: [amount] DZD ([count] txns) - [%] of total

### By Hour (Top 3)
1. [Hour]: [amount] DZD ([count] txns)
2. [Hour]: [amount] DZD ([count] txns)
3. [Hour]: [amount] DZD ([count] txns)

## ⚠️ Issues & Alerts

- Failed Payments: [count] ([%] failure rate)
- Canceled Checkouts: [count]
- Fraud Signals: [count if any]

## 💡 Insights & Recommendations

[AI-generated insights based on the data, such as:]
- Peak hours for optimization
- Payment method performance
- Anomalies or unusual patterns
- Action items for tomorrow

## 📈 Current Balance

- **DZD**: [available] DZD ([on_hold] on hold)
- **EUR**: [available] EUR
- **USD**: [available] USD

---

Generated at: [timestamp]
```

**Example Invocation**:
```json
{
  "prompt": "daily_finance_summary",
  "arguments": {
    "date": "2024-02-13",
    "include_comparison": true
  }
}
```

---

### `reconciliation_report`

**Description**: Generate reconciliation report matching Chargily transactions with bank statements.

**Arguments**:
- `period_start` (required): Start date (YYYY-MM-DD)
- `period_end` (required): End date (YYYY-MM-DD)
- `settlement_id` (optional): Specific settlement ID to reconcile

**Template**:
```
You are an accounting specialist reconciling Chargily Pay transactions with bank records.

TASK: Generate reconciliation report for period {{period_start}} to {{period_end}}.

STEPS:
1. Fetch all successful transactions in the period using list_checkouts
2. Calculate expected settlement amount
3. Fetch settlement details from chargily://settlements/history
4. Compare expected vs actual settlement
5. Identify discrepancies
6. List all fees and deductions

RECONCILIATION REPORT:

# Chargily Pay Reconciliation Report
## Period: {{period_start}} to {{period_end}}

### Transaction Summary
- Total Successful Checkouts: [count]
- Gross Revenue: [amount] DZD
- Chargily Fees: [fees] DZD
- Net Revenue: [net] DZD

### Settlement Details
- Settlement ID: [id]
- Settlement Status: [status]
- Settlement Amount: [amount] DZD
- Expected Payout Date: [date]

### Fee Breakdown
| Fee Type | Count | Amount |
|----------|-------|--------|
| Transaction Fees | [count] | [amount] DZD |
| Refund Fees | [count] | [amount] DZD |
| Other Fees | [count] | [amount] DZD |

### Reconciliation Status
✅ Matched: [amount] DZD
⚠️ Discrepancies: [amount] DZD

### Discrepancy Details
[List any mismatches with transaction IDs]

### Action Items
1. [Any required follow-up actions]

---

Generated at: [timestamp]
Use this report for accounting and tax purposes.
```

---

## Customer Support

### `merchant_support_helper`

**Description**: Help merchant support team answer customer payment queries.

**Arguments**:
- `customer_email` (optional): Customer email
- `customer_phone` (optional): Customer phone
- `checkout_id` (optional): Checkout ID customer is asking about
- `query_summary` (required): Brief description of customer issue

**Template**:
```
You are a customer support specialist helping resolve a payment query.

CUSTOMER ISSUE: {{query_summary}}

IDENTIFICATION:
{{#if customer_email}}
- Email: {{customer_email}}
{{/if}}
{{#if customer_phone}}
- Phone: {{customer_phone}}
{{/if}}
{{#if checkout_id}}
- Checkout ID: {{checkout_id}}
{{/if}}

INVESTIGATION STEPS:
1. Identify customer using provided information
2. Fetch customer transaction history
3. If checkout_id provided, get full checkout details
4. Analyze the issue based on common support scenarios:
   - Payment not received (check status)
   - Double charge (check for duplicates)
   - Refund request (check eligibility)
   - Wrong amount charged
   - Receipt/invoice request
5. Prepare customer-friendly explanation
6. Recommend resolution steps

SUPPORT RESPONSE:

## Customer Support Analysis

### Customer Profile
- Name: [name]
- Email: [email]
- Total Transactions: [count]
- Customer Since: [date]

### Issue Summary
[Brief restatement of the issue]

### Investigation Findings
[What you discovered about the transaction/issue]

### Status
- Payment Status: [pending/paid/failed/refunded]
- Amount: [amount] DZD
- Date: [date]
- Reference: [checkout_id]

### Resolution
[Clear explanation of what happened and why]

### Recommended Action
[What the merchant should tell the customer]

### Customer Message Template (French/Arabic)
[Draft response message for the customer]

### Escalation
[If issue requires escalation, note it here]

---

Use tools: list_customers (to find), get_customer, get_checkout, list_checkouts
```

---

### `refund_eligibility_check`

**Description**: Check if a checkout is eligible for refund and guide through process.

**Arguments**:
- `checkout_id` (required): Checkout to refund
- `refund_reason` (required): Reason for refund request

**Template**:
```
You are verifying refund eligibility for checkout {{checkout_id}}.

REASON: {{refund_reason}}

ELIGIBILITY CHECKS:
1. Fetch checkout details
2. Verify checkout status is 'paid'
3. Check refund policy compliance:
   - Was payment made within refund window? (typically 90 days)
   - Has this checkout already been refunded?
   - Is partial refund allowed?
4. Calculate refund amount (including fees)
5. Check for fraud indicators
6. Determine approval tier required

REFUND ELIGIBILITY REPORT:

# Refund Eligibility - {{checkout_id}}

## Checkout Details
- Amount: [amount] DZD
- Payment Date: [date]
- Customer: [name] ([email])
- Payment Method: [method]
- Status: [status]

## Eligibility Status
**ELIGIBLE** ✅ / **NOT ELIGIBLE** ❌

### Compliance Checks
- ✅/❌ Payment status: [paid/other]
- ✅/❌ Within refund window: [yes/no - X days since payment]
- ✅/❌ Not previously refunded: [yes/no]
- ✅/❌ No fraud indicators: [yes/no]

## Refund Details
- Refund Amount: [amount] DZD
- Refund Fees: [fees] DZD (if applicable)
- Net Refund to Customer: [net_amount] DZD

## Approval Required
**Tier Level**: [1/2/3]
- Tier 3: Requires dual approval (amount > 10,000 DZD or fraud risk)
- Tier 2: Single approval required
- Tier 1: Auto-approved

## Recommended Action
[Approve/Reject/Request More Information]

### If Approved:
Would you like me to process this refund?
⚠️ WARNING: This action requires human approval and cannot be undone.

### If Rejected:
Reason: [explanation]
Alternative: [if applicable]

---

**Refund Reason**: {{refund_reason}}
Use tools: get_checkout, (create_refund if you implement refunds in future)
```

---

## Fraud Analysis

### `fraud_signal_summary`

**Description**: Analyze recent fraud signals and high-risk transactions.

**Arguments**:
- `time_window` (optional): Time window to analyze (default: '24h')
- `risk_threshold` (optional): Minimum risk score to include (default: 70)

**Template**:
```
You are a fraud analyst reviewing suspicious activity on Chargily Pay account.

TASK: Analyze fraud signals from the last {{time_window}}.

DATA SOURCES:
1. Fraud signals from chargily://analytics/fraud-signals
2. Recent high-value transactions from chargily://transactions/recent
3. Failed payment patterns

ANALYSIS CRITERIA:
- High-risk score (> {{risk_threshold}})
- Velocity anomalies (many transactions from same IP/customer)
- Unusual payment patterns
- Geographic inconsistencies
- New customers with large orders

FRAUD ANALYSIS REPORT:

# Fraud & Risk Summary - Last {{time_window}}

## 🚨 Alert Summary

- **High-Risk Checkouts**: [count]
- **Blocked Transactions**: [count]
- **Potential Loss Prevented**: [amount] DZD

## ⚠️ Active Fraud Signals

{{#each signals}}
### Signal #{{index}} - Risk Score: {{risk_score}}/100

**Checkout ID**: {{checkout_id}}
**Amount**: {{amount}} DZD
**Customer**: {{customer_name}} ({{customer_email}})
**Status**: {{status}}

**Risk Indicators**:
{{#each reasons}}
- {{this}}
{{/each}}

**Recommended Action**: [Block/Review/Monitor]

---
{{/each}}

## 📊 Fraud Patterns Detected

[AI analysis of common patterns among fraud signals]

### Common Indicators:
1. [Pattern 1]
2. [Pattern 2]
3. [Pattern 3]

## 🛡️ Recommendations

### Immediate Actions:
1. [Action to take now]
2. [Action to take now]

### Policy Updates:
1. [Suggested rule changes]
2. [Suggested threshold adjustments]

### Monitoring:
- [What to watch closely]

---

Report generated at: [timestamp]
Next review recommended in: [time window]
```

---

### `transaction_risk_assessment`

**Description**: Perform real-time risk assessment on a specific transaction.

**Arguments**:
- `checkout_id` (required): Checkout ID to assess
- `include_customer_profile` (optional): Include customer risk profiling (default: true)

**Template**:
```
You are performing a risk assessment on checkout {{checkout_id}}.

RISK FACTORS TO EVALUATE:
1. Transaction amount vs customer history
2. Payment velocity (transactions per hour/day)
3. Customer age (new vs established)
4. Geographic indicators
5. Payment method risk profile
6. Device fingerprint anomalies (if available)
7. Time of transaction (unusual hours)

RISK ASSESSMENT REPORT:

# Transaction Risk Assessment

## Checkout: {{checkout_id}}

### Basic Details
- Amount: [amount] DZD
- Customer: [name] ([email])
- Payment Method: [method]
- Created: [timestamp]
- IP Address: [if available]

### Risk Score: [0-100]

🟢 **LOW RISK** (0-30)
🟡 **MEDIUM RISK** (31-70)
🔴 **HIGH RISK** (71-100)

### Risk Factors

| Factor | Score | Weight | Details |
|--------|-------|--------|---------|
| Amount | [score] | [weight] | [explanation] |
| Velocity | [score] | [weight] | [explanation] |
| Customer Age | [score] | [weight] | [explanation] |
| Geographic | [score] | [weight] | [explanation] |
| Payment Method | [score] | [weight] | [explanation] |

### Customer Profile
{{#if include_customer_profile}}
- Account Age: [days/months]
- Total Transactions: [count]
- Success Rate: [%]
- Total Spent: [amount] DZD
- Average Order Value: [avg] DZD
- Previous Fraud Flags: [count]
{{/if}}

### Recommendation

**ACTION**: [APPROVE / REVIEW / BLOCK]

**Reasoning**: [Explanation of the recommendation]

**Confidence**: [Low/Medium/High]

### If Blocked:
- Notify merchant immediately
- Send customer verification email
- Flag for manual review

### If Review Required:
- Request additional verification
- Hold payment for [X] hours
- Contact customer for confirmation

---

Use tools: get_checkout, get_customer, list_checkouts (for velocity check)
```

---

## Reconciliation

### `webhook_delivery_report`

**Description**: Analyze webhook delivery success and debug failures.

**Arguments**:
- `time_period` (optional): Time period to analyze (default: '24h')
- `endpoint` (optional): Filter by specific webhook endpoint

**Template**:
```
You are debugging webhook delivery issues for Chargily Pay merchant.

TASK: Analyze webhook delivery performance for the last {{time_period}}.

DATA SOURCES:
- chargily://webhooks/logs
- Recent events from chargily://webhooks/events/*

ANALYSIS:

# Webhook Delivery Report - Last {{time_period}}

## 📊 Delivery Statistics

| Metric | Value |
|--------|-------|
| Total Events | [count] |
| Successful Deliveries | [count] ([%]) |
| Failed Deliveries | [count] ([%]) |
| Pending Retries | [count] |

## 🎯 Endpoint Performance

{{#if endpoint}}
### Endpoint: {{endpoint}}
{{else}}
### All Endpoints
{{/if}}

| Endpoint | Success | Failed | Avg Response Time |
|----------|---------|--------|-------------------|
| [url] | [count] | [count] | [ms] |

## ❌ Failure Analysis

### Top Failure Reasons:
1. [Reason 1]: [count] occurrences
2. [Reason 2]: [count] occurrences
3. [Reason 3]: [count] occurrences

### Failed Events Requiring Attention:

{{#each failed_events}}
#### Event #{{index}}
- **Event ID**: {{event_id}}
- **Type**: {{event_type}}
- **Checkout**: {{checkout_id}}
- **Endpoint**: {{endpoint}}
- **Status Code**: {{status_code}}
- **Error**: {{error_message}}
- **Attempts**: {{attempt_count}}
- **Next Retry**: {{next_retry_at}}

---
{{/each}}

## 🔧 Recommended Fixes

### Immediate Actions:
1. [Action 1]
2. [Action 2]

### Endpoint Configuration:
- Verify endpoint URL is accessible
- Check SSL certificate validity
- Ensure endpoint returns HTTP 200 within 10 seconds
- Verify HMAC signature validation logic

### Webhook Best Practices:
- Process webhooks asynchronously
- Return 200 immediately, process later
- Implement idempotency
- Log all incoming webhooks
- Retry with exponential backoff

---

Use tools: Access chargily://webhooks/logs resource
```

---

## Business Intelligence

### `customer_segmentation_analysis`

**Description**: Segment customers by behavior and value for targeted campaigns.

**Arguments**:
- `period` (optional): Analysis period (default: '30d')
- `min_transactions` (optional): Minimum transactions to include (default: 2)

**Template**:
```
You are a business analyst segmenting customers for Chargily Pay merchant.

TASK: Perform customer segmentation analysis for the last {{period}}.

SEGMENTATION CRITERIA:
1. **Recency**: Days since last purchase
2. **Frequency**: Number of transactions
3. **Monetary**: Total spend

SEGMENTS:
- 🌟 **VIP**: High frequency, high value (top 10%)
- 💎 **Loyal**: High frequency, medium value
- 🎯 **Potential**: Low frequency, high value
- 📈 **Growing**: Increasing spend trend
- ⚠️ **At Risk**: Declining activity
- 😴 **Dormant**: No activity >90 days

CUSTOMER SEGMENTATION REPORT:

# Customer Segmentation Analysis - Last {{period}}

## 📊 Segment Distribution

| Segment | Count | % of Base | Total Revenue | Avg Order Value |
|---------|-------|-----------|---------------|-----------------|
| 🌟 VIP | [count] | [%] | [amount] DZD | [avg] DZD |
| 💎 Loyal | [count] | [%] | [amount] DZD | [avg] DZD |
| 🎯 Potential | [count] | [%] | [amount] DZD | [avg] DZD |
| 📈 Growing | [count] | [%] | [amount] DZD | [avg] DZD |
| ⚠️ At Risk | [count] | [%] | [amount] DZD | [avg] DZD |
| 😴 Dormant | [count] | [%] | [amount] DZD | [avg] DZD |

## 🌟 VIP Customers (Top 10%)

{{#each vip_customers}}
### {{name}}
- Email: {{email}}
- Total Spent: {{total_spent}} DZD
- Transactions: {{transaction_count}}
- Avg Order: {{avg_order_value}} DZD
- Last Purchase: {{last_purchase_date}}
{{/each}}

## 💡 Actionable Insights

### VIP Customers:
- [Retention strategy]
- [Exclusive offers recommendation]

### Potential Customers:
- [Engagement campaign idea]
- [Upsell opportunities]

### At-Risk Customers:
- [Re-engagement campaign]
- [Win-back offer]

### Dormant Customers:
- [Reactivation campaign]
- [Survey to understand churn]

## 🎯 Campaign Recommendations

### Campaign 1: VIP Loyalty Rewards
- **Target**: VIP segment ([count] customers)
- **Objective**: Increase repeat purchase rate
- **Tactic**: [Specific recommendation]

### Campaign 2: Win-Back Dormant
- **Target**: Dormant segment ([count] customers)
- **Objective**: Reactivate 20% of dormant customers
- **Tactic**: [Specific recommendation]

---

Use tools: list_customers, get_customer, list_checkouts
```

---

## Prompt Template Variables

All prompts support Handlebars-style template variables:

```handlebars
{{variable_name}}               - Simple substitution
{{#if condition}}...{{/if}}     - Conditional
{{#each array}}...{{/each}}     - Iteration
{{#unless condition}}...{{/unless}} - Negative conditional
```

## Prompt Invocation Flow

1. Client requests prompt by name
2. MCP server validates arguments against schema
3. Server renders template with arguments
4. Server executes prompt logic (may call tools, access resources)
5. Server returns formatted result to client
6. Client displays result to user

## Custom Prompts

Merchants can create custom prompts via MCP server configuration:

```json
{
  "customPrompts": [
    {
      "name": "my_custom_report",
      "description": "My custom business report",
      "arguments": {
        "date": { "type": "string", "required": true }
      },
      "template": "..."
    }
  ]
}
```

---

## Next Steps

1. Implement prompt engine in TypeScript
2. Add Handlebars template rendering
3. Create prompt testing framework
4. Build prompt marketplace for community-contributed prompts
5. Add prompt analytics (usage tracking, success rate)
