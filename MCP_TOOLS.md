# Chargily MCP - Tool Surface Definition

Complete specification of all MCP tools for Chargily Pay API.

## Tool Categories

1. [Balance Tools](#balance-tools)
2. [Customer Tools](#customer-tools)
3. [Product Tools](#product-tools)
4. [Price Tools](#price-tools)
5. [Checkout Tools](#checkout-tools)
6. [Payment Link Tools](#payment-link-tools)
7. [Webhook Tools](#webhook-tools)

---

## Balance Tools

### `get_balance`

**Description**: Retrieve the current account balance across all wallets (DZD, EUR, USD).

**Scopes**: `balance:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent (GET operation)

**Input Schema**:
```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "entity": { "type": "string", "enum": ["balance"] },
    "livemode": { "type": "boolean" },
    "current_balance": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "currency": { "type": "string", "enum": ["dzd", "eur", "usd"] },
          "amount": { "type": "number" },
          "available_balance": { "type": "number" },
          "on_hold": { "type": "number" }
        }
      }
    }
  }
}
```

**Example Request**:
```json
{
  "tool": "get_balance",
  "arguments": {}
}
```

**Example Response**:
```json
{
  "id": "bal_123",
  "entity": "balance",
  "livemode": true,
  "current_balance": [
    {
      "currency": "dzd",
      "amount": 125000,
      "available_balance": 120000,
      "on_hold": 5000
    },
    {
      "currency": "eur",
      "amount": 500,
      "available_balance": 500,
      "on_hold": 0
    }
  ]
}
```

**Limits**:
- Max calls per minute: 100
- No pagination

---

## Customer Tools

### `create_customer`

**Description**: Create a new customer in the Chargily Pay system.

**Scopes**: `customers:write`

**Approval Required**: No

**Rate Limit**: 50 req/min

**Idempotency**: Yes (via `idempotency_key`)

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Customer's full name",
      "maxLength": 255
    },
    "email": {
      "type": "string",
      "format": "email",
      "description": "Customer's email address"
    },
    "phone": {
      "type": "string",
      "description": "Customer's phone number (Algerian format)",
      "pattern": "^(\\+213|0)[5-7][0-9]{8}$"
    },
    "address": {
      "type": "object",
      "properties": {
        "address": { "type": "string" },
        "state": { "type": "string" },
        "country": { "type": "string", "enum": ["dz"] }
      }
    },
    "metadata": {
      "type": "object",
      "description": "Additional key-value data (max 50 keys)"
    }
  },
  "required": ["name", "email"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "entity": { "type": "string", "enum": ["customer"] },
    "livemode": { "type": "boolean" },
    "name": { "type": "string" },
    "email": { "type": "string" },
    "phone": { "type": "string" },
    "address": { "type": "object" },
    "metadata": { "type": "object" },
    "created_at": { "type": "number" },
    "updated_at": { "type": "number" }
  }
}
```

**Example Request**:
```json
{
  "tool": "create_customer",
  "arguments": {
    "name": "Ahmed Ben Salah",
    "email": "ahmed@example.dz",
    "phone": "+213555123456",
    "address": {
      "address": "123 Rue Didouche Mourad",
      "state": "Algiers",
      "country": "dz"
    },
    "metadata": {
      "internal_id": "CUST-001",
      "loyalty_tier": "gold"
    }
  }
}
```

**Limits**:
- Max 50 requests/min
- Max 10,000 customers per account
- Metadata: max 50 keys, each value max 500 chars

---

### `get_customer`

**Description**: Retrieve customer details by ID.

**Scopes**: `customers:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent (GET)

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "customer_id": {
      "type": "string",
      "description": "Customer ID (e.g., 'cus_123abc')",
      "pattern": "^cus_[a-zA-Z0-9]+$"
    }
  },
  "required": ["customer_id"]
}
```

**Output Schema**: Same as `create_customer` output

**Example Request**:
```json
{
  "tool": "get_customer",
  "arguments": {
    "customer_id": "cus_123abc"
  }
}
```

---

### `list_customers`

**Description**: List all customers with optional filtering.

**Scopes**: `customers:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "page": {
      "type": "integer",
      "default": 1,
      "minimum": 1
    },
    "per_page": {
      "type": "integer",
      "default": 20,
      "minimum": 1,
      "maximum": 100
    },
    "email": {
      "type": "string",
      "description": "Filter by email"
    },
    "phone": {
      "type": "string",
      "description": "Filter by phone"
    }
  },
  "required": []
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "data": {
      "type": "array",
      "items": { "$ref": "#/customer_object" }
    },
    "pagination": {
      "type": "object",
      "properties": {
        "current_page": { "type": "integer" },
        "per_page": { "type": "integer" },
        "total": { "type": "integer" },
        "total_pages": { "type": "integer" }
      }
    }
  }
}
```

---

### `update_customer`

**Description**: Update customer information.

**Scopes**: `customers:write`

**Approval Required**: Tier 2 (single approval if changing phone/email)

**Rate Limit**: 50 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "customer_id": {
      "type": "string",
      "pattern": "^cus_[a-zA-Z0-9]+$"
    },
    "name": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "phone": { "type": "string" },
    "address": { "type": "object" },
    "metadata": { "type": "object" }
  },
  "required": ["customer_id"]
}
```

**Output Schema**: Updated customer object

---

### `delete_customer`

**Description**: Delete a customer (soft delete, preserves transaction history).

**Scopes**: `customers:delete`

**Approval Required**: Tier 2 (GDPR compliance check)

**Rate Limit**: 10 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "customer_id": {
      "type": "string",
      "pattern": "^cus_[a-zA-Z0-9]+$"
    },
    "reason": {
      "type": "string",
      "enum": ["user_request", "gdpr_deletion", "duplicate", "fraud"]
    }
  },
  "required": ["customer_id", "reason"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "deleted": { "type": "boolean" },
    "deleted_at": { "type": "number" }
  }
}
```

---

## Product Tools

### `create_product`

**Description**: Create a new product for sale.

**Scopes**: `products:write`

**Approval Required**: No

**Rate Limit**: 50 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Product name",
      "maxLength": 255
    },
    "description": {
      "type": "string",
      "description": "Product description"
    },
    "images": {
      "type": "array",
      "items": { "type": "string", "format": "uri" },
      "maxItems": 8
    },
    "metadata": { "type": "object" }
  },
  "required": ["name"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "entity": { "type": "string", "enum": ["product"] },
    "livemode": { "type": "boolean" },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "images": { "type": "array" },
    "metadata": { "type": "object" },
    "created_at": { "type": "number" },
    "updated_at": { "type": "number" }
  }
}
```

---

### `get_product`

**Description**: Retrieve product details by ID.

**Scopes**: `products:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "product_id": {
      "type": "string",
      "pattern": "^prod_[a-zA-Z0-9]+$"
    }
  },
  "required": ["product_id"]
}
```

---

### `list_products`

**Description**: List all products.

**Scopes**: `products:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "page": { "type": "integer", "default": 1 },
    "per_page": { "type": "integer", "default": 20, "maximum": 100 }
  }
}
```

---

### `update_product`

**Description**: Update product information.

**Scopes**: `products:write`

**Approval Required**: No

**Rate Limit**: 50 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "product_id": { "type": "string" },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "images": { "type": "array" },
    "metadata": { "type": "object" }
  },
  "required": ["product_id"]
}
```

---

### `delete_product`

**Description**: Delete a product (only if no prices are associated).

**Scopes**: `products:delete`

**Approval Required**: Tier 1 (auto-approve if no associated prices)

**Rate Limit**: 20 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "product_id": { "type": "string" }
  },
  "required": ["product_id"]
}
```

---

## Price Tools

### `create_price`

**Description**: Create a price for a product.

**Scopes**: `prices:write`

**Approval Required**: No

**Rate Limit**: 50 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "product_id": {
      "type": "string",
      "pattern": "^prod_[a-zA-Z0-9]+$"
    },
    "amount": {
      "type": "integer",
      "description": "Amount in smallest currency unit (e.g., centimes for DZD)",
      "minimum": 100
    },
    "currency": {
      "type": "string",
      "enum": ["dzd"],
      "default": "dzd"
    },
    "metadata": { "type": "object" }
  },
  "required": ["product_id", "amount", "currency"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "entity": { "type": "string", "enum": ["price"] },
    "product_id": { "type": "string" },
    "amount": { "type": "integer" },
    "currency": { "type": "string" },
    "metadata": { "type": "object" },
    "created_at": { "type": "number" },
    "updated_at": { "type": "number" }
  }
}
```

---

### `get_price`

**Description**: Retrieve price details by ID.

**Scopes**: `prices:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "price_id": {
      "type": "string",
      "pattern": "^price_[a-zA-Z0-9]+$"
    }
  },
  "required": ["price_id"]
}
```

---

### `list_prices`

**Description**: List all prices.

**Scopes**: `prices:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "product_id": {
      "type": "string",
      "description": "Filter by product ID"
    },
    "page": { "type": "integer", "default": 1 },
    "per_page": { "type": "integer", "default": 20, "maximum": 100 }
  }
}
```

---

### `update_price`

**Description**: Update price metadata (amount cannot be changed).

**Scopes**: `prices:write`

**Approval Required**: No

**Rate Limit**: 50 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "price_id": { "type": "string" },
    "metadata": { "type": "object" }
  },
  "required": ["price_id"]
}
```

---

## Checkout Tools

### `create_checkout`

**Description**: Create a new checkout session for payment.

**Scopes**: `checkouts:create`

**Approval Required**:
- Tier 1 (instant): amount < 5,000 DZD
- Tier 2 (single approval): 5,000 - 100,000 DZD
- Tier 3 (dual approval): > 100,000 DZD

**Rate Limit**: 100 req/min

**Idempotency**: Yes (via idempotency_key)

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "integer",
      "description": "Amount in centimes (DZD)",
      "minimum": 5000,
      "maximum": 10000000
    },
    "currency": {
      "type": "string",
      "enum": ["dzd"],
      "default": "dzd"
    },
    "payment_method": {
      "type": "string",
      "enum": ["edahabia", "cib", "chargily_app"],
      "default": "edahabia"
    },
    "success_url": {
      "type": "string",
      "format": "uri",
      "description": "Redirect URL after successful payment"
    },
    "failure_url": {
      "type": "string",
      "format": "uri",
      "description": "Redirect URL after failed payment"
    },
    "customer_id": {
      "type": "string",
      "pattern": "^cus_[a-zA-Z0-9]+$"
    },
    "description": {
      "type": "string",
      "maxLength": 500
    },
    "locale": {
      "type": "string",
      "enum": ["ar", "en", "fr"],
      "default": "ar"
    },
    "shipping_address": { "type": "string" },
    "collect_shipping_address": { "type": "boolean", "default": false },
    "percentage_discount": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100
    },
    "amount_discount": {
      "type": "integer",
      "minimum": 0
    },
    "chargily_pay_fees_allocation": {
      "type": "string",
      "enum": ["customer", "merchant", "split"],
      "default": "merchant"
    },
    "webhook_endpoint": {
      "type": "string",
      "format": "uri"
    },
    "metadata": { "type": "object" }
  },
  "required": ["amount", "currency", "success_url"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "entity": { "type": "string", "enum": ["checkout"] },
    "livemode": { "type": "boolean" },
    "amount": { "type": "integer" },
    "currency": { "type": "string" },
    "fees": { "type": "integer" },
    "fees_on_merchant": { "type": "integer" },
    "fees_on_customer": { "type": "integer" },
    "status": {
      "type": "string",
      "enum": ["pending", "paid", "failed", "canceled", "expired"]
    },
    "checkout_url": {
      "type": "string",
      "format": "uri",
      "description": "URL to redirect customer for payment"
    },
    "qr_code_url": {
      "type": "string",
      "format": "uri",
      "description": "QR code for Chargily App payment"
    },
    "payment_method": { "type": "string" },
    "customer_id": { "type": "string" },
    "invoice_id": { "type": "string" },
    "discount": { "type": "object" },
    "shipping_address": { "type": "string" },
    "metadata": { "type": "object" },
    "created_at": { "type": "number" },
    "updated_at": { "type": "number" },
    "pass_fees_to_customer": { "type": "boolean" }
  }
}
```

**Example Request**:
```json
{
  "tool": "create_checkout",
  "arguments": {
    "amount": 10000,
    "currency": "dzd",
    "payment_method": "edahabia",
    "success_url": "https://mystore.dz/success",
    "failure_url": "https://mystore.dz/failure",
    "customer_id": "cus_123abc",
    "description": "Order #1234 - 2 items",
    "locale": "ar",
    "metadata": {
      "order_id": "ORD-1234",
      "source": "mobile_app"
    }
  }
}
```

**Example Response**:
```json
{
  "id": "checkout_789xyz",
  "entity": "checkout",
  "livemode": true,
  "amount": 10000,
  "currency": "dzd",
  "fees": 200,
  "fees_on_merchant": 200,
  "fees_on_customer": 0,
  "status": "pending",
  "checkout_url": "https://pay.chargily.net/checkout/checkout_789xyz",
  "payment_method": "edahabia",
  "customer_id": "cus_123abc",
  "invoice_id": "inv_456def",
  "created_at": 1707825600
}
```

**Limits**:
- Min amount: 50 DZD (5,000 centimes)
- Max amount: 100,000 DZD (10,000,000 centimes)
- Max 100 requests/min
- Checkout expires after 24 hours if unpaid

---

### `get_checkout`

**Description**: Retrieve checkout details by ID.

**Scopes**: `checkouts:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "checkout_id": {
      "type": "string",
      "pattern": "^checkout_[a-zA-Z0-9]+$"
    }
  },
  "required": ["checkout_id"]
}
```

---

### `list_checkouts`

**Description**: List all checkouts with optional filters.

**Scopes**: `checkouts:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "page": { "type": "integer", "default": 1 },
    "per_page": { "type": "integer", "default": 20, "maximum": 100 },
    "status": {
      "type": "string",
      "enum": ["pending", "paid", "failed", "canceled", "expired"]
    },
    "customer_id": { "type": "string" },
    "payment_method": {
      "type": "string",
      "enum": ["edahabia", "cib", "chargily_app"]
    },
    "created_after": {
      "type": "integer",
      "description": "Unix timestamp"
    },
    "created_before": {
      "type": "integer",
      "description": "Unix timestamp"
    }
  }
}
```

---

### `cancel_checkout`

**Description**: Cancel a pending checkout (prevents payment).

**Scopes**: `checkouts:cancel`

**Approval Required**: Tier 2 (single approval)

**Rate Limit**: 20 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "checkout_id": { "type": "string" },
    "reason": {
      "type": "string",
      "enum": ["customer_request", "fraud_suspicion", "duplicate", "other"],
      "description": "Cancellation reason"
    }
  },
  "required": ["checkout_id", "reason"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "status": { "type": "string", "enum": ["canceled"] },
    "canceled_at": { "type": "number" },
    "cancellation_reason": { "type": "string" }
  }
}
```

---

### `expire_checkout`

**Description**: Manually expire a checkout (Chargily API endpoint).

**Scopes**: `checkouts:expire`

**Approval Required**: Tier 2

**Rate Limit**: 20 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "checkout_id": { "type": "string" }
  },
  "required": ["checkout_id"]
}
```

---

## Payment Link Tools

### `create_payment_link`

**Description**: Create a reusable payment link.

**Scopes**: `payment_links:create`

**Approval Required**: No

**Rate Limit**: 50 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Payment link name"
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "price_id": { "type": "string" },
          "quantity": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "collect_shipping_address": { "type": "boolean", "default": false },
    "locale": {
      "type": "string",
      "enum": ["ar", "en", "fr"],
      "default": "ar"
    },
    "pass_fees_to_customer": { "type": "boolean", "default": false },
    "metadata": { "type": "object" }
  },
  "required": ["name", "items"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "entity": { "type": "string", "enum": ["payment_link"] },
    "livemode": { "type": "boolean" },
    "name": { "type": "string" },
    "url": {
      "type": "string",
      "format": "uri",
      "description": "Public payment link URL"
    },
    "items": { "type": "array" },
    "active": { "type": "boolean" },
    "collect_shipping_address": { "type": "boolean" },
    "metadata": { "type": "object" },
    "created_at": { "type": "number" },
    "updated_at": { "type": "number" }
  }
}
```

---

### `get_payment_link`

**Description**: Retrieve payment link details.

**Scopes**: `payment_links:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "payment_link_id": {
      "type": "string",
      "pattern": "^link_[a-zA-Z0-9]+$"
    }
  },
  "required": ["payment_link_id"]
}
```

---

### `list_payment_links`

**Description**: List all payment links.

**Scopes**: `payment_links:read`

**Approval Required**: No

**Rate Limit**: 100 req/min

**Idempotency**: Idempotent

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "page": { "type": "integer", "default": 1 },
    "per_page": { "type": "integer", "default": 20, "maximum": 100 },
    "active": { "type": "boolean" }
  }
}
```

---

### `update_payment_link`

**Description**: Update payment link details.

**Scopes**: `payment_links:write`

**Approval Required**: No

**Rate Limit**: 50 req/min

**Idempotency**: Yes

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "payment_link_id": { "type": "string" },
    "name": { "type": "string" },
    "active": { "type": "boolean" },
    "collect_shipping_address": { "type": "boolean" },
    "metadata": { "type": "object" }
  },
  "required": ["payment_link_id"]
}
```

---

## Webhook Tools

### `verify_webhook`

**Description**: Verify webhook signature (helper tool, not API call).

**Scopes**: `webhooks:verify` (internal only)

**Approval Required**: No

**Rate Limit**: Unlimited (local operation)

**Idempotency**: Idempotent

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "payload": {
      "type": "string",
      "description": "Raw webhook payload (JSON string)"
    },
    "signature": {
      "type": "string",
      "description": "Signature from 'signature' header"
    },
    "secret": {
      "type": "string",
      "description": "Webhook secret key"
    }
  },
  "required": ["payload", "signature", "secret"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "valid": { "type": "boolean" },
    "reason": {
      "type": "string",
      "description": "Failure reason if invalid"
    }
  }
}
```

**Example Request**:
```json
{
  "tool": "verify_webhook",
  "arguments": {
    "payload": "{\"type\":\"checkout.paid\",\"data\":{...}}",
    "signature": "sha256=abc123...",
    "secret": "whsec_xyz789..."
  }
}
```

**Example Response**:
```json
{
  "valid": true
}
```

---

## Summary Table

| Tool Name | Category | Approval Tier | Rate Limit | Idempotent |
|-----------|----------|---------------|------------|------------|
| `get_balance` | Balance | None | 100/min | Yes |
| `create_customer` | Customer | None | 50/min | Yes |
| `get_customer` | Customer | None | 100/min | Yes |
| `list_customers` | Customer | None | 100/min | Yes |
| `update_customer` | Customer | Tier 2 | 50/min | Yes |
| `delete_customer` | Customer | Tier 2 | 10/min | Yes |
| `create_product` | Product | None | 50/min | Yes |
| `get_product` | Product | None | 100/min | Yes |
| `list_products` | Product | None | 100/min | Yes |
| `update_product` | Product | None | 50/min | Yes |
| `delete_product` | Product | Tier 1 | 20/min | Yes |
| `create_price` | Price | None | 50/min | Yes |
| `get_price` | Price | None | 100/min | Yes |
| `list_prices` | Price | None | 100/min | Yes |
| `update_price` | Price | None | 50/min | Yes |
| `create_checkout` | Checkout | Tier 1/2/3* | 100/min | Yes |
| `get_checkout` | Checkout | None | 100/min | Yes |
| `list_checkouts` | Checkout | None | 100/min | Yes |
| `cancel_checkout` | Checkout | Tier 2 | 20/min | Yes |
| `expire_checkout` | Checkout | Tier 2 | 20/min | Yes |
| `create_payment_link` | Payment Link | None | 50/min | Yes |
| `get_payment_link` | Payment Link | None | 100/min | Yes |
| `list_payment_links` | Payment Link | None | 100/min | Yes |
| `update_payment_link` | Payment Link | None | 50/min | Yes |
| `verify_webhook` | Webhook | None | Unlimited | Yes |

*Approval tier for `create_checkout` depends on amount:
- < 5,000 DZD: Tier 1 (instant)
- 5,000 - 100,000 DZD: Tier 2 (single approval)
- \> 100,000 DZD: Tier 3 (dual approval)

---

## Approval Tiers Explained

- **None**: Execute immediately
- **Tier 1**: Auto-approve based on rules
- **Tier 2**: Single human approval required
- **Tier 3**: Dual approval (two humans) required

---

## Error Codes

All tools return standard MCP error codes:

- `AUTH_ERROR` (401): Invalid or expired credentials
- `PERMISSION_DENIED` (403): Insufficient scopes
- `INVALID_INPUT` (400): Schema validation failed
- `NOT_FOUND` (404): Resource not found
- `RATE_LIMITED` (429): Too many requests
- `UPSTREAM_ERROR` (502): Chargily API error
- `TIMEOUT` (504): Request timeout
- `APPROVAL_PENDING` (202): Awaiting approval

---

## Next Steps

1. Implement these tool handlers in TypeScript
2. Add zod schemas for validation
3. Build approval workflow engine
4. Create audit logging for sensitive operations
5. Implement rate limiting per tool
