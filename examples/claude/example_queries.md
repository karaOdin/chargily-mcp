# Claude Desktop Example Queries

Once you've configured Chargily MCP server in Claude Desktop, try these natural language queries:

## Balance & Overview

```
Show me my current Chargily balance
```

```
What's my balance in DZD?
```

```
Give me a daily financial summary for today
```

## Customer Management

```
Create a new customer named "Ahmed Ben Salah" with email ahmed@example.dz
```

```
Find customer with email ahmed@example.dz
```

```
List my top 10 customers from the last 30 days
```

```
Update customer cus_abc123 phone number to +213555123456
```

## Products & Pricing

```
Create a product called "Premium Subscription" priced at 5000 DZD per month
```

```
List all my products
```

```
Update product prod_abc123 description to "Monthly premium access"
```

## Checkout Creation

```
Create a checkout for 10,000 DZD using EDAHABIA payment method.
Success URL: https://mystore.dz/success
Failure URL: https://mystore.dz/failure
```

```
Create a payment link for my "Premium Subscription" product
```

```
Show me all pending checkouts from today
```

## Investigation & Support

```
Investigate why checkout checkout_abc123 failed
```

```
Help me with a customer support query:
Customer email: ahmed@example.dz
Issue: Customer says payment didn't go through but they were charged
```

```
Analyze fraud signals for the last 24 hours
```

## Reporting

```
Generate a daily financial summary for 2024-02-13
```

```
Create a reconciliation report for February 1-28, 2024
```

```
Show me conversion rate analytics for the last 30 days
```

```
List customers at risk of churning
```

## Complex Multi-Step Workflows

```
I need to:
1. Find customer with email ahmed@example.dz
2. Create a checkout for 15,000 DZD for this customer
3. Send me the checkout URL
```

```
Help me investigate a failed payment:
1. Checkout ID: checkout_xyz789
2. Include customer payment history
3. Check if similar payments are failing
4. Suggest what to do next
```

## Voice-Style Queries (Testing Voice Agent Compatibility)

```
Please confirm: I want to create a checkout for five thousand Algerian dinars using E-DAHABIA
```

```
Process refund for order checkout_abc123. Amount: 10,000 DZD. Reason: customer request.
Please confirm before proceeding.
```

## Tips for Best Results

1. **Be specific**: Include IDs, amounts, and details
2. **Use natural language**: No need to match exact API syntax
3. **Ask for confirmation**: Claude will confirm sensitive operations
4. **Request explanations**: Ask "why" and "how" questions
5. **Chain operations**: Combine multiple steps in one query
6. **Use follow-ups**: Reference previous results in subsequent queries

## Expected Behaviors

✅ **Read operations**: Execute immediately
✅ **Low-value writes**: Execute with minimal confirmation (< 5,000 DZD)
⚠️ **Medium-value writes**: Require confirmation (5,000-100,000 DZD)
🔴 **High-value writes**: Require detailed confirmation (>100,000 DZD)
🔴 **Deletions**: Always require explicit confirmation
