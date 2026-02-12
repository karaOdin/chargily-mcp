# Chargily MCP - Resource Surface Definition

MCP Resources provide read-only access to data via URI-based addressing. Resources are **cached** and **refreshed** according to their freshness rules.

## Resource URI Scheme

```
chargily://[resource-type]/[identifier]?[query-params]
```

---

## 1. Balance Resources

### `chargily://balance/current`

**Description**: Current account balance across all wallets.

**Freshness**: 30 seconds

**Cache TTL**: 30 seconds

**Schema**:
```json
{
  "uri": "chargily://balance/current",
  "mimeType": "application/json",
  "content": {
    "dzd": {
      "amount": 125000,
      "available": 120000,
      "on_hold": 5000
    },
    "eur": {
      "amount": 500,
      "available": 500,
      "on_hold": 0
    },
    "usd": {
      "amount": 1000,
      "available": 1000,
      "on_hold": 0
    },
    "last_updated": 1707825600
  }
}
```

**Use Case**: Real-time balance monitoring, dashboard displays.

---

## 2. Transaction Resources

### `chargily://transactions/{id}`

**Description**: Single transaction details.

**Freshness**: Immutable (transactions don't change once created)

**Cache TTL**: Infinite

**Path Parameters**:
- `id`: Transaction ID (e.g., `checkout_123abc`)

**Schema**:
```json
{
  "uri": "chargily://transactions/checkout_123abc",
  "mimeType": "application/json",
  "content": {
    "id": "checkout_123abc",
    "type": "checkout",
    "status": "paid",
    "amount": 10000,
    "currency": "dzd",
    "fees": 200,
    "customer_id": "cus_xyz",
    "payment_method": "edahabia",
    "created_at": 1707825600,
    "paid_at": 1707825700,
    "metadata": {}
  }
}
```

**Use Case**: Transaction lookup, receipt generation, audit trails.

---

### `chargily://transactions/recent`

**Description**: Most recent transactions (last 100).

**Freshness**: 10 seconds

**Cache TTL**: 10 seconds

**Query Parameters**:
- `limit`: Max results (default: 100, max: 100)
- `status`: Filter by status (`pending`, `paid`, `failed`, `canceled`)
- `payment_method`: Filter by method (`edahabia`, `cib`, `chargily_app`)

**Schema**:
```json
{
  "uri": "chargily://transactions/recent?limit=50&status=paid",
  "mimeType": "application/json",
  "content": {
    "transactions": [
      {
        "id": "checkout_789",
        "amount": 15000,
        "status": "paid",
        "created_at": 1707825600
      },
      // ... more transactions
    ],
    "total": 50,
    "last_updated": 1707825650
  }
}
```

**Use Case**: Real-time transaction monitoring, dashboards.

---

## 3. Customer Resources

### `chargily://customers/{id}`

**Description**: Customer profile and transaction history.

**Freshness**: 60 seconds

**Cache TTL**: 60 seconds

**Path Parameters**:
- `id`: Customer ID (e.g., `cus_123abc`)

**Schema**:
```json
{
  "uri": "chargily://customers/cus_123abc",
  "mimeType": "application/json",
  "content": {
    "id": "cus_123abc",
    "name": "Ahmed Ben Salah",
    "email": "ahmed@example.dz",
    "phone": "+213555123456",
    "total_spent": 45000,
    "transaction_count": 12,
    "last_transaction_at": 1707825600,
    "created_at": 1705233600,
    "metadata": {},
    "recent_transactions": [
      {
        "id": "checkout_789",
        "amount": 10000,
        "status": "paid",
        "created_at": 1707825600
      }
      // Last 5 transactions
    ]
  }
}
```

**Use Case**: Customer support, fraud detection, loyalty tracking.

---

### `chargily://customers/top`

**Description**: Top customers by spend (last 30 days).

**Freshness**: 5 minutes

**Cache TTL**: 5 minutes

**Query Parameters**:
- `limit`: Max results (default: 10, max: 100)
- `period`: Time period (`7d`, `30d`, `90d`, `1y`, `all`)

**Schema**:
```json
{
  "uri": "chargily://customers/top?limit=10&period=30d",
  "mimeType": "application/json",
  "content": {
    "customers": [
      {
        "id": "cus_abc",
        "name": "Ahmed Ben Salah",
        "total_spent": 125000,
        "transaction_count": 45,
        "average_order_value": 2777
      }
      // ... more customers
    ],
    "period": "30d",
    "last_updated": 1707825650
  }
}
```

**Use Case**: Analytics, VIP customer identification, marketing campaigns.

---

## 4. Report Resources

### `chargily://reports/daily`

**Description**: Daily transaction summary.

**Freshness**: 1 minute (real-time updates)

**Cache TTL**: 1 minute

**Query Parameters**:
- `date`: Specific date (YYYY-MM-DD format, default: today)
- `timezone`: Timezone (default: `Africa/Algiers`)

**Schema**:
```json
{
  "uri": "chargily://reports/daily?date=2024-02-13",
  "mimeType": "application/json",
  "content": {
    "date": "2024-02-13",
    "timezone": "Africa/Algiers",
    "summary": {
      "total_transactions": 156,
      "successful_payments": 142,
      "failed_payments": 8,
      "canceled_checkouts": 6,
      "total_amount": 1250000,
      "total_fees": 25000,
      "net_revenue": 1225000
    },
    "by_payment_method": {
      "edahabia": {
        "count": 120,
        "amount": 980000
      },
      "cib": {
        "count": 20,
        "amount": 250000
      },
      "chargily_app": {
        "count": 2,
        "amount": 20000
      }
    },
    "hourly_breakdown": [
      { "hour": 0, "count": 2, "amount": 5000 },
      { "hour": 1, "count": 0, "amount": 0 },
      // ... 24 hours
    ],
    "last_updated": 1707825650
  }
}
```

**Use Case**: Daily reconciliation, financial reporting, business intelligence.

---

### `chargily://reports/monthly`

**Description**: Monthly transaction summary.

**Freshness**: 5 minutes

**Cache TTL**: 5 minutes

**Query Parameters**:
- `month`: Month in YYYY-MM format (default: current month)

**Schema**:
```json
{
  "uri": "chargily://reports/monthly?month=2024-02",
  "mimeType": "application/json",
  "content": {
    "month": "2024-02",
    "summary": {
      "total_transactions": 4520,
      "successful_payments": 4102,
      "total_amount": 35600000,
      "total_fees": 712000,
      "net_revenue": 34888000,
      "average_transaction_value": 7876,
      "success_rate": 90.75
    },
    "by_day": [
      { "date": "2024-02-01", "count": 142, "amount": 1250000 },
      { "date": "2024-02-02", "count": 158, "amount": 1380000 },
      // ... all days
    ],
    "top_products": [
      {
        "product_id": "prod_abc",
        "product_name": "Premium Service",
        "sales": 890,
        "revenue": 8900000
      }
    ],
    "last_updated": 1707825650
  }
}
```

**Use Case**: Monthly reporting, tax calculations, trend analysis.

---

## 5. Webhook Resources

### `chargily://webhooks/logs`

**Description**: Recent webhook delivery logs.

**Freshness**: 10 seconds

**Cache TTL**: 10 seconds

**Query Parameters**:
- `limit`: Max results (default: 50, max: 200)
- `status`: Filter by status (`success`, `failed`, `pending`)
- `event_type`: Filter by event (`checkout.paid`, `checkout.failed`, etc.)

**Schema**:
```json
{
  "uri": "chargily://webhooks/logs?limit=50&status=failed",
  "mimeType": "application/json",
  "content": {
    "logs": [
      {
        "id": "wh_log_123",
        "event_type": "checkout.paid",
        "checkout_id": "checkout_789",
        "endpoint": "https://mystore.dz/webhook",
        "status": "failed",
        "status_code": 500,
        "error": "Connection timeout",
        "attempts": 3,
        "next_retry_at": 1707826200,
        "created_at": 1707825600
      }
      // ... more logs
    ],
    "total": 50,
    "last_updated": 1707825650
  }
}
```

**Use Case**: Webhook debugging, delivery monitoring, troubleshooting.

---

### `chargily://webhooks/events/{id}`

**Description**: Single webhook event details.

**Freshness**: Immutable

**Cache TTL**: Infinite

**Path Parameters**:
- `id`: Event ID (e.g., `evt_123abc`)

**Schema**:
```json
{
  "uri": "chargily://webhooks/events/evt_123abc",
  "mimeType": "application/json",
  "content": {
    "id": "evt_123abc",
    "type": "checkout.paid",
    "data": {
      "id": "checkout_789",
      "amount": 10000,
      "status": "paid",
      // ... full checkout object
    },
    "livemode": true,
    "created_at": 1707825600,
    "delivery_attempts": [
      {
        "attempt": 1,
        "endpoint": "https://mystore.dz/webhook",
        "status_code": 200,
        "delivered_at": 1707825601
      }
    ]
  }
}
```

**Use Case**: Webhook event inspection, audit trails, debugging.

---

## 6. Settlement Resources

### `chargily://settlements/latest`

**Description**: Most recent settlement (payout) information.

**Freshness**: 1 hour

**Cache TTL**: 1 hour

**Schema**:
```json
{
  "uri": "chargily://settlements/latest",
  "mimeType": "application/json",
  "content": {
    "id": "settle_abc123",
    "status": "pending",
    "amount": 2500000,
    "currency": "dzd",
    "fees": 50000,
    "net_amount": 2450000,
    "transaction_count": 890,
    "period_start": 1707220800,
    "period_end": 1707825600,
    "expected_payout_date": 1707998400,
    "bank_account": {
      "last4": "1234",
      "bank_name": "CPA"
    },
    "last_updated": 1707825650
  }
}
```

**Use Case**: Cash flow management, accounting, payout tracking.

---

### `chargily://settlements/history`

**Description**: Settlement history (last 12 months).

**Freshness**: 1 hour

**Cache TTL**: 1 hour

**Query Parameters**:
- `limit`: Max results (default: 12, max: 100)

**Schema**:
```json
{
  "uri": "chargily://settlements/history?limit=12",
  "mimeType": "application/json",
  "content": {
    "settlements": [
      {
        "id": "settle_abc",
        "status": "paid",
        "amount": 2500000,
        "net_amount": 2450000,
        "paid_at": 1707825600
      }
      // ... more settlements
    ],
    "total": 12,
    "last_updated": 1707825650
  }
}
```

**Use Case**: Financial reconciliation, accounting integration.

---

## 7. Analytics Resources

### `chargily://analytics/conversion`

**Description**: Checkout conversion metrics.

**Freshness**: 5 minutes

**Cache TTL**: 5 minutes

**Query Parameters**:
- `period`: Time period (`7d`, `30d`, `90d`)

**Schema**:
```json
{
  "uri": "chargily://analytics/conversion?period=30d",
  "mimeType": "application/json",
  "content": {
    "period": "30d",
    "checkouts_created": 5240,
    "checkouts_paid": 4102,
    "checkouts_failed": 890,
    "checkouts_abandoned": 248,
    "conversion_rate": 78.28,
    "average_time_to_pay": 180,
    "by_payment_method": {
      "edahabia": {
        "conversion_rate": 82.5,
        "average_time": 150
      },
      "cib": {
        "conversion_rate": 65.3,
        "average_time": 240
      }
    },
    "last_updated": 1707825650
  }
}
```

**Use Case**: Conversion optimization, UX improvements, payment method analysis.

---

### `chargily://analytics/fraud-signals`

**Description**: Fraud detection signals and alerts.

**Freshness**: 1 minute

**Cache TTL**: 1 minute

**Schema**:
```json
{
  "uri": "chargily://analytics/fraud-signals",
  "mimeType": "application/json",
  "content": {
    "high_risk_checkouts": 3,
    "blocked_today": 12,
    "signals": [
      {
        "checkout_id": "checkout_xyz",
        "risk_score": 85,
        "reasons": [
          "High velocity from same IP",
          "Unusual amount pattern",
          "New customer with large order"
        ],
        "status": "pending_review",
        "created_at": 1707825600
      }
    ],
    "last_updated": 1707825650
  }
}
```

**Use Case**: Fraud prevention, risk management, security monitoring.

---

## 8. Product Resources

### `chargily://products/catalog`

**Description**: Full product catalog with prices.

**Freshness**: 5 minutes

**Cache TTL**: 5 minutes

**Query Parameters**:
- `active_only`: Boolean (default: true)

**Schema**:
```json
{
  "uri": "chargily://products/catalog?active_only=true",
  "mimeType": "application/json",
  "content": {
    "products": [
      {
        "id": "prod_abc",
        "name": "Premium Subscription",
        "description": "Monthly premium access",
        "images": ["https://..."],
        "prices": [
          {
            "id": "price_xyz",
            "amount": 5000,
            "currency": "dzd"
          }
        ],
        "metadata": {}
      }
      // ... more products
    ],
    "total": 42,
    "last_updated": 1707825650
  }
}
```

**Use Case**: Website integration, product displays, price lists.

---

## Resource Access Patterns

### 1. Subscribe to Resource Updates

MCP clients can subscribe to resource changes:

```json
{
  "method": "resources/subscribe",
  "params": {
    "uri": "chargily://balance/current"
  }
}
```

Server will notify clients when resource is updated.

### 2. Batch Resource Fetch

Fetch multiple resources in one request:

```json
{
  "method": "resources/list",
  "params": {
    "uris": [
      "chargily://balance/current",
      "chargily://transactions/recent?limit=10",
      "chargily://reports/daily"
    ]
  }
}
```

### 3. Resource Templates

Dynamic URIs with templates:

```json
{
  "method": "resources/read",
  "params": {
    "uri": "chargily://transactions/{checkout_id}",
    "variables": {
      "checkout_id": "checkout_123abc"
    }
  }
}
```

---

## Caching Strategy

```typescript
interface CacheConfig {
  uri: string;
  ttl: number; // seconds
  freshness: 'immutable' | 'realtime' | 'periodic';
  revalidate: boolean; // revalidate on stale
}

const cacheRules: CacheConfig[] = [
  {
    uri: 'chargily://transactions/*',
    ttl: Infinity,
    freshness: 'immutable',
    revalidate: false,
  },
  {
    uri: 'chargily://balance/current',
    ttl: 30,
    freshness: 'realtime',
    revalidate: true,
  },
  {
    uri: 'chargily://reports/daily',
    ttl: 60,
    freshness: 'periodic',
    revalidate: true,
  },
];
```

---

## Resource Permissions

Resources inherit scopes from their category:

| Resource Pattern | Required Scope |
|------------------|---------------|
| `chargily://balance/*` | `balance:read` |
| `chargily://transactions/*` | `checkouts:read` |
| `chargily://customers/*` | `customers:read` |
| `chargily://reports/*` | `reports:read` |
| `chargily://webhooks/*` | `webhooks:read` |
| `chargily://settlements/*` | `settlements:read` |
| `chargily://analytics/*` | `analytics:read` |
| `chargily://products/*` | `products:read` |

---

## Summary

**Total Resources**: 15 resource types

**Freshness Levels**:
- Immutable: `transactions/{id}`, `webhooks/events/{id}`
- Real-time (<1 min): `balance/current`, `analytics/fraud-signals`
- Periodic (1-5 min): `reports/daily`, `analytics/conversion`
- Slow (>1 hour): `settlements/*`

**Use Cases**:
- ✅ Real-time dashboards
- ✅ Financial reporting
- ✅ Customer analytics
- ✅ Fraud monitoring
- ✅ Webhook debugging
- ✅ Cash flow tracking

**Next Steps**:
1. Implement resource handlers in TypeScript
2. Build caching layer with Redis
3. Add resource subscription mechanism
4. Create resource templates
5. Implement batch fetch optimization
