# Chargily MCP Platform - System Architecture

## 1. Overview

The Chargily MCP (Model Context Protocol) platform provides a production-grade, secure, and extensible interface for AI agents, voice assistants, and automation tools to interact with the Chargily Pay payment gateway.

This architecture enables:
- **AI Agents** (Claude, ChatGPT, Cursor) to process payments, query transactions, and manage customers
- **Voice Assistants** to handle payment operations with human approval workflows
- **Automation Tools** (n8n, Zapier) to integrate Chargily Pay into business workflows
- **Developers** to build payment-aware applications with built-in security and compliance

## 2. System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     MCP HOST LAYER                                │
│  (Claude Desktop, Cursor, ChatGPT, n8n, Voice Agents, Custom)    │
└──────────────────────┬───────────────────────────────────────────┘
                       │ JSON-RPC over stdio/HTTP/SSE
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    MCP CLIENT LAYER                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Connection Management                                  │   │
│  │  • Tool Discovery & Invocation                           │   │
│  │  • Resource Access                                       │   │
│  │  • Prompt Template Rendering                             │   │
│  │  • Error Handling & Retry Logic                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────────────────────┘
                       │ MCP Protocol (JSON-RPC)
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    MCP SERVER LAYER                               │
│  ┌────────────┬──────────────┬──────────────┬─────────────────┐ │
│  │   TOOLS    │  RESOURCES   │   PROMPTS    │   UTILITIES     │ │
│  │            │              │              │                 │ │
│  │ • Payments │ • Balance    │ • Refund     │ • Pagination    │ │
│  │ • Refunds  │ • Txns       │   Analysis   │ • Completion    │ │
│  │ • Customers│ • Reports    │ • Daily      │ • Logging       │ │
│  │ • Products │ • Webhooks   │   Summary    │ • Progress      │ │
│  │ • Prices   │ • Merchants  │ • Support    │                 │ │
│  │ • Links    │              │   Helper     │                 │ │
│  └────────────┴──────────────┴──────────────┴─────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MIDDLEWARE & SECURITY                        │   │
│  │  • Auth (OAuth2, API Key, JWT)                          │   │
│  │  • Scope Enforcement                                     │   │
│  │  • Approval Workflow (Redis Queue)                      │   │
│  │  • Rate Limiting (Token Bucket)                         │   │
│  │  • Audit Logging (PostgreSQL)                           │   │
│  │  • Tenant Isolation                                     │   │
│  │  • Fraud Detection Hooks                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────────────────────┘
                       │ REST API (HTTPS)
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CHARGILY PAY API                               │
│  • Checkouts  • Customers  • Products  • Prices                  │
│  • Payment Links  • Balance  • Webhooks                          │
│  • Test Mode / Live Mode                                         │
└──────────────────────────────────────────────────────────────────┘
```

### Component Roles

#### 1. MCP Host
The application that wants to use Chargily Pay capabilities:
- **Claude Desktop**: Natural language payment queries
- **Cursor IDE**: Payment integration in code
- **n8n**: Workflow automation
- **Voice Agents**: Conversational payment processing
- **Custom Apps**: Bespoke integrations

#### 2. MCP Client
Manages communication between Host and Server:
- Discovers available tools and resources
- Invokes tools with proper parameters
- Handles errors and retries
- Manages authentication tokens

#### 3. MCP Server (Chargily MCP)
Core of this platform:
- **Tools**: Executable payment operations
- **Resources**: Read-only data endpoints
- **Prompts**: Pre-built templates for common tasks
- **Security**: Auth, approval, audit, rate limiting
- **API Wrapper**: Chargily Pay integration

#### 4. Chargily Pay API
The payment gateway:
- Processes EDAHABIA & CIB payments
- Manages customers, products, prices
- Handles webhooks and notifications

## 3. Authentication & Authorization

### Authentication Flows

```
┌─────────────────────────────────────────────────────────────┐
│  AUTHENTICATION FLOW                                         │
│                                                              │
│  1. API Key (Merchant Direct)                               │
│     MCP Client ──[API Key]──> MCP Server ──> Chargily API  │
│                                                              │
│  2. OAuth 2.1 (3rd Party Apps)                              │
│     User ──[Authorize]──> Chargily OAuth                    │
│          <──[Code]──────────                                │
│     MCP Client ──[Code]──> MCP Server ──[Token]──> API     │
│                                                              │
│  3. JWT (Service-to-Service)                                │
│     Service ──[JWT]──> MCP Server ──[Validate]──> Proceed  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Authorization Scopes

```typescript
// Scope hierarchy
readonly_scopes = [
  'balance:read',
  'customers:read',
  'products:read',
  'prices:read',
  'checkouts:read',
  'payment_links:read',
]

write_scopes = [
  'customers:write',
  'products:write',
  'prices:write',
  'checkouts:create',
  'payment_links:create',
]

sensitive_scopes = [
  'checkouts:cancel',      // Requires approval
  'refunds:create',        // Requires approval + dual control
  'webhooks:configure',    // Admin only
]
```

## 4. Approval Workflow

Critical operations require human approval:

```
┌─────────────────────────────────────────────────────────────────┐
│  APPROVAL WORKFLOW (e.g., Refund)                                │
│                                                                   │
│  1. AI Agent requests refund                                     │
│     Agent ──[refund_request]──> MCP Server                      │
│                                                                   │
│  2. Server queues for approval                                   │
│     MCP Server ──[enqueue]──> Redis Approval Queue              │
│     MCP Server ──[notify]──> Notification Service               │
│                                                                   │
│  3. Human reviews request                                        │
│     Merchant ──[review]──> Approval Dashboard                   │
│                            │                                      │
│                            ├─[approve]─> Execute Refund          │
│                            └─[reject]──> Notify Agent            │
│                                                                   │
│  4. Audit log                                                    │
│     All actions ──> PostgreSQL Audit Log                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Approval Tiers

- **Tier 1 (Instant)**: Read operations, low-value checkouts (<50 DZD)
- **Tier 2 (Single Approval)**: Checkouts 50-10,000 DZD, customer updates
- **Tier 3 (Dual Approval)**: Refunds, large checkouts (>10,000 DZD), webhook config

## 5. Audit & Compliance

### Audit Trail

Every operation is logged:

```sql
-- audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,

  -- WHO
  user_id VARCHAR,
  tenant_id VARCHAR,
  agent_type VARCHAR, -- 'human', 'ai_agent', 'voice_agent'
  agent_identifier VARCHAR,

  -- WHAT
  action VARCHAR NOT NULL,
  resource_type VARCHAR NOT NULL,
  resource_id VARCHAR,
  tool_name VARCHAR,

  -- DETAILS
  input_data JSONB,
  output_data JSONB,
  status VARCHAR, -- 'success', 'failure', 'pending_approval'
  error_message TEXT,

  -- CONTEXT
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR,
  approval_status VARCHAR,
  approved_by VARCHAR,

  -- COMPLIANCE
  pci_relevant BOOLEAN,
  data_sensitivity VARCHAR, -- 'public', 'internal', 'confidential', 'pci'

  INDEX idx_timestamp (timestamp),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_status (status)
);
```

### Regulatory Compliance

- **PCI DSS**: No card data stored, all API calls over HTTPS
- **GDPR**: Customer data access logs, right to deletion
- **PSD2**: Strong customer authentication support
- **Algerian Regulations**: Local currency (DZD) support, EDAHABIA compliance

## 6. Multi-Tenant Isolation

```
┌───────────────────────────────────────────────────────────┐
│  TENANT ISOLATION                                          │
│                                                            │
│  Request ──[tenant_id from JWT]──> Tenant Resolver       │
│                                     │                      │
│                                     ├──> Tenant Context   │
│                                     ├──> API Key Vault    │
│                                     ├──> Rate Limit Config│
│                                     └──> Audit Log Stream │
│                                                            │
│  All downstream calls tagged with tenant_id               │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

## 7. Sandbox vs Production

### Mode Isolation

```typescript
type Environment = 'sandbox' | 'production';

interface ChargilyConfig {
  mode: Environment;
  apiKey: string;
  apiUrl: string; // Different per mode
  webhookSecret: string;
}

// Sandbox: pay.chargily.net/test/api/v2
// Production: pay.chargily.net/api/v2
```

### Sandbox Features

- Test API keys (prefix: `test_sk_`)
- Simulated payment flows
- Webhook testing endpoint
- No real money movement
- Full audit logging

### Production Features

- Live API keys (prefix: `live_sk_`)
- Real EDAHABIA/CIB payments
- Mandatory approval workflows
- Enhanced fraud detection
- Compliance reporting

## 8. Fraud Detection Hooks

```
┌────────────────────────────────────────────────────────────┐
│  FRAUD DETECTION PIPELINE                                   │
│                                                             │
│  Checkout Request ──> MCP Server                           │
│         │                                                   │
│         ├──> Rule Engine                                   │
│         │    • Amount threshold check                      │
│         │    • Velocity check (requests/min)              │
│         │    • Geo-location verification                  │
│         │    • Known fraud patterns                       │
│         │                                                   │
│         ├──> Risk Score (0-100)                            │
│         │    • 0-30: Auto-approve                         │
│         │    • 31-70: Human review                        │
│         │    • 71-100: Auto-reject + alert                │
│         │                                                   │
│         └──> Decision                                      │
│              • Proceed                                     │
│              • Queue for approval                          │
│              • Block + notify merchant                     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## 9. Voice Agent Compatibility

### Voice-Safe Patterns

```
┌──────────────────────────────────────────────────────────────┐
│  VOICE AGENT INTERACTION FLOW                                 │
│                                                               │
│  1. Voice Agent: "Process refund for order 12345"           │
│     ──> MCP Server receives request                          │
│                                                               │
│  2. Server: "This refund is 5,000 DZD. Please confirm."     │
│     ──> Voice Agent: "Confirmed"                             │
│                                                               │
│  3. Server: Queue for approval with voice signature          │
│     ──> Human receives notification                          │
│                                                               │
│  4. Server: "Refund approved. Processing..."                 │
│     ──> Execute via Chargily API                             │
│                                                               │
│  5. Server: "Refund completed. Reference: REF789"            │
│     ──> Voice Agent confirms to user                         │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Voice-Specific Features

- **Confirmation Required**: All write operations need explicit voice confirmation
- **Amount Verification**: Amounts spoken back for verification
- **Transaction IDs**: Phonetic alphabet for IDs (A-Alpha, B-Bravo)
- **Timeout Handling**: 30-second voice input timeout
- **Error Recovery**: "I didn't understand, please repeat" fallbacks

## 10. Rate Limiting

### Token Bucket Algorithm

```typescript
interface RateLimits {
  // Per tenant limits
  readonly: {
    requestsPerSecond: 100;
    burstCapacity: 200;
  };

  write: {
    requestsPerSecond: 10;
    burstCapacity: 20;
  };

  sensitive: {
    requestsPerMinute: 5;
    burstCapacity: 10;
  };
}

// Implementation with Redis
class RateLimiter {
  async checkLimit(
    tenantId: string,
    operation: string
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const key = `ratelimit:${tenantId}:${operation}`;
    const limit = this.getLimitConfig(operation);

    // Token bucket algorithm using Redis
    const tokens = await redis.get(key);
    if (tokens < 1) {
      return { allowed: false, retryAfter: this.calculateRetryAfter() };
    }

    await redis.decr(key);
    return { allowed: true };
  }
}
```

## 11. Transport Layer

### Supported Transports

1. **stdio (Standard Input/Output)**
   - For local integrations (Claude Desktop, Cursor)
   - JSON-RPC over stdin/stdout

2. **HTTP/SSE (Server-Sent Events)**
   - For remote integrations (web apps, mobile)
   - Streaming responses for long operations

3. **WebSocket** (Future)
   - For bi-directional real-time communication

### Transport Selection

```typescript
interface TransportConfig {
  type: 'stdio' | 'http' | 'sse';

  // For HTTP/SSE
  endpoint?: string;
  port?: number;

  // Security
  tls?: boolean;
  certPath?: string;
}
```

## 12. Error Handling & Retry

### Error Categories

```typescript
enum ErrorCategory {
  // User errors (4xx)
  AUTHENTICATION_ERROR = 'auth_error',
  AUTHORIZATION_ERROR = 'permission_denied',
  VALIDATION_ERROR = 'invalid_input',
  NOT_FOUND = 'not_found',

  // Server errors (5xx)
  CHARGILY_API_ERROR = 'upstream_error',
  RATE_LIMIT_ERROR = 'rate_limited',
  TIMEOUT_ERROR = 'timeout',

  // MCP errors
  TOOL_NOT_FOUND = 'tool_not_found',
  RESOURCE_UNAVAILABLE = 'resource_unavailable',
}
```

### Retry Strategy

```typescript
interface RetryConfig {
  maxAttempts: 3;
  initialDelay: 1000; // ms
  maxDelay: 10000;
  backoffMultiplier: 2;
  retryableErrors: [
    ErrorCategory.CHARGILY_API_ERROR,
    ErrorCategory.TIMEOUT_ERROR,
  ];
}
```

## 13. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION DEPLOYMENT                    │
│                                                                   │
│  Load Balancer (NGINX)                                           │
│         │                                                         │
│         ├──> MCP Server Instance 1 (Node.js)                    │
│         ├──> MCP Server Instance 2 (Node.js)                    │
│         └──> MCP Server Instance 3 (Node.js)                    │
│                    │                                             │
│                    ├──> Redis (Rate Limiting + Approval Queue)  │
│                    ├──> PostgreSQL (Audit Logs)                 │
│                    └──> Chargily Pay API                        │
│                                                                   │
│  Monitoring: Prometheus + Grafana                                │
│  Logging: ELK Stack (Elasticsearch, Logstash, Kibana)           │
│  Alerting: PagerDuty                                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 14. SDK Architecture

```
chargily-mcp/
├── packages/
│   ├── core/                    # Core MCP server logic
│   │   ├── server.ts
│   │   ├── transport/
│   │   ├── tools/
│   │   ├── resources/
│   │   └── prompts/
│   │
│   ├── sdk/                     # Client SDK
│   │   ├── client.ts
│   │   ├── auth/
│   │   └── types/
│   │
│   ├── auth/                    # Authentication
│   │   ├── oauth.ts
│   │   ├── jwt.ts
│   │   └── api-key.ts
│   │
│   ├── approvals/               # Approval workflow
│   │   ├── queue.ts
│   │   ├── rules.ts
│   │   └── notifier.ts
│   │
│   └── audit/                   # Audit logging
│       ├── logger.ts
│       ├── models.ts
│       └── reporter.ts
│
├── apps/
│   ├── server/                  # Main server app
│   └── docs/                    # Documentation site
│
└── examples/
    ├── claude/
    ├── cursor/
    ├── n8n/
    └── voice-agent/
```

## 15. Security Threat Model

### Potential Threats

1. **Unauthorized Access**: Mitigated by OAuth2 + JWT + API key validation
2. **Data Breach**: Mitigated by encryption at rest + in transit, audit logs
3. **Fraud**: Mitigated by fraud detection hooks, approval workflows
4. **Rate Limit Abuse**: Mitigated by token bucket algorithm, tenant isolation
5. **Webhook Tampering**: Mitigated by HMAC-SHA256 signature verification
6. **MITM Attacks**: Mitigated by TLS 1.3, certificate pinning
7. **SQL Injection**: Mitigated by parameterized queries, ORM
8. **XSS**: Mitigated by input sanitization, CSP headers

## 16. Performance Targets

- **Latency**: < 100ms (p50), < 500ms (p99)
- **Throughput**: 1,000 req/s per instance
- **Availability**: 99.9% uptime
- **Error Rate**: < 0.1%

## Conclusion

This architecture provides a **production-ready**, **secure**, and **extensible** platform for integrating Chargily Pay with AI agents, voice assistants, and automation tools via the Model Context Protocol.

**Key Strengths:**
- ✅ Stripe-level developer experience
- ✅ Production security (OAuth2, approvals, audit)
- ✅ Voice agent ready
- ✅ Multi-tenant SaaS architecture
- ✅ Regulatory compliance (PCI, GDPR)
- ✅ Fraud detection
- ✅ n8n/automation compatible

**Next Steps:**
1. Define MCP tool surface (all Chargily endpoints)
2. Design MCP resources (read-only URIs)
3. Create prompt library
4. Implement TypeScript codebase
5. Build developer documentation
6. Create integration examples
