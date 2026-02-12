# Chargily MCP Platform

> **Production-grade Model Context Protocol integration for Chargily Pay**

Transform how AI agents, voice assistants, and automation tools interact with Chargily Pay. Built with enterprise security, compliance, and developer experience in mind.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org/)

## 🌟 What is Chargily MCP?

Chargily MCP is a **Stripe-quality** Model Context Protocol implementation that enables:

- 🤖 **AI Agents** (Claude, ChatGPT, Cursor) to process payments naturally
- 🎙️ **Voice Assistants** to handle transactions with human approval workflows
- ⚙️ **Automation Tools** (n8n, Zapier) to integrate payment operations
- 🛠️ **Developers** to build payment-aware applications with production security

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   Claude    │────▶│ Chargily MCP │────▶│ Chargily Pay   │
│  ChatGPT    │     │    Server    │     │      API       │
│    n8n      │     │              │     │                │
│   Cursor    │◀────│  • Tools     │◀────│  EDAHABIA/CIB  │
│    Voice    │     │  • Resources │     │                │
└─────────────┘     │  • Prompts   │     └────────────────┘
                    │  • Security  │
                    └──────────────┘
```

## ✨ Features

### 🔧 Complete Tool Surface

**25+ MCP tools** covering all Chargily Pay operations:

- ✅ Balance & Transactions
- ✅ Customer Management
- ✅ Product & Price Management
- ✅ Checkout Creation & Management
- ✅ Payment Links
- ✅ Webhook Verification

### 📊 Resource System

Read-only data access via **URIs**:

```
chargily://balance/current
chargily://transactions/{id}
chargily://reports/daily
chargily://customers/top
chargily://analytics/conversion
```

### 🎯 Prompt Library

Pre-built prompts for common tasks:

- `investigate_failed_payment` - Payment forensics
- `daily_finance_summary` - Financial reporting
- `merchant_support_helper` - Customer support
- `fraud_signal_summary` - Fraud detection
- `reconciliation_report` - Accounting

### 🔐 Production Security

- **OAuth 2.1** / API Key / JWT authentication
- **Approval workflows** (Tier 1/2/3) for sensitive operations
- **Audit logging** (PostgreSQL) for compliance
- **Rate limiting** (Redis) with token bucket
- **Fraud detection** hooks
- **Multi-tenant isolation**
- **PCI DSS** compliant architecture

### 🌍 Multi-Environment

- **Sandbox mode** for development/testing
- **Production mode** with enhanced security
- Automatic endpoint switching

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Chargily Pay API key ([Get one here](https://pay.chargily.net/))

### Installation

```bash
# Clone the repository
git clone https://github.com/chargily/mcp-platform.git
cd mcp-platform

# Install dependencies
pnpm install

# Build packages
pnpm build
```

### Configuration

Create `.env` file:

```bash
# Chargily Pay Configuration
CHARGILY_API_KEY=test_sk_your_test_key_here
CHARGILY_MODE=sandbox  # or 'production'

# Optional: Webhook secret for signature verification
CHARGILY_WEBHOOK_SECRET=whsec_your_secret_here
```

### Start the Server

```bash
pnpm server:dev
```

The MCP server will start on stdio, ready to accept connections from MCP clients.

## 📚 Documentation

### Core Documentation

- [**Architecture**](./ARCHITECTURE.md) - System design, security, compliance
- [**MCP Tools**](./MCP_TOOLS.md) - Complete tool reference
- [**MCP Resources**](./MCP_RESOURCES.md) - Resource URI specifications
- [**MCP Prompts**](./MCP_PROMPTS.md) - Prompt library

### Integration Guides

- [Connect from Claude Desktop](#claude-desktop-integration)
- [Connect from Cursor](#cursor-integration)
- [Connect from n8n](#n8n-integration)
- [Voice Agent Integration](#voice-agent-integration)

## 🔌 Integrations

### Claude Desktop Integration

1. Edit your Claude Desktop config:

**macOS/Linux:**
```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
code %APPDATA%\Claude\claude_desktop_config.json
```

2. Add Chargily MCP server:

```json
{
  "mcpServers": {
    "chargily": {
      "command": "node",
      "args": ["/absolute/path/to/chargily-mcp/apps/server/dist/index.js"],
      "env": {
        "CHARGILY_API_KEY": "test_sk_your_key_here",
        "CHARGILY_MODE": "sandbox"
      }
    }
  }
}
```

3. Restart Claude Desktop

4. Test with natural language:

```
"Show me my current balance"
"Create a checkout for 5000 DZD with EDAHABIA"
"List my top customers from last month"
"Investigate why checkout_abc123 failed"
```

### Cursor Integration

1. Open Cursor settings (Cmd/Ctrl + ,)

2. Navigate to "Features" → "Model Context Protocol"

3. Add server configuration:

```json
{
  "chargily": {
    "command": "node",
    "args": ["/absolute/path/to/chargily-mcp/apps/server/dist/index.js"],
    "env": {
      "CHARGILY_API_KEY": "test_sk_your_key_here",
      "CHARGILY_MODE": "sandbox"
    }
  }
}
```

4. Use in code with AI assistance:

```typescript
// Ask Cursor: "Create a checkout for this order using Chargily"
// It will use the MCP tools to generate proper code
```

### n8n Integration

1. Install the n8n MCP node (when available)

2. Configure Chargily MCP connection:

```json
{
  "serverUrl": "http://localhost:3000/mcp",
  "apiKey": "your_n8n_api_key",
  "tools": ["create_checkout", "get_balance", "list_customers"]
}
```

3. Build workflows with Chargily operations

Example workflow JSON in `examples/n8n/`

### ChatGPT Integration

ChatGPT Actions support coming soon.

### Voice Agent Integration

See `examples/voice-agent/` for complete voice-safe implementation with:

- Explicit confirmation for all write operations
- Amount verification (spoken back)
- Phonetic transaction IDs
- Timeout handling

## 🛠️ Development

### Project Structure

```
chargily-mcp/
├── packages/
│   ├── core/          # Core MCP server & Chargily client
│   ├── sdk/           # Client SDK for integrations
│   ├── auth/          # Authentication & authorization
│   ├── approvals/     # Approval workflow engine
│   └── audit/         # Audit logging system
├── apps/
│   ├── server/        # Main MCP server application
│   └── docs/          # Documentation site
├── examples/
│   ├── claude/        # Claude Desktop examples
│   ├── cursor/        # Cursor IDE examples
│   ├── n8n/           # n8n workflow examples
│   └── voice-agent/   # Voice assistant examples
└── docs/              # Additional documentation
```

### Build Commands

```bash
pnpm build              # Build all packages
pnpm dev                # Run all packages in watch mode
pnpm test               # Run tests
pnpm lint               # Lint code
pnpm typecheck          # Type checking
pnpm clean              # Clean build artifacts
```

### Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage
```

## 🔒 Security

### Scope System

```typescript
const scopes = {
  // Read scopes
  'balance:read',
  'customers:read',
  'products:read',
  'checkouts:read',

  // Write scopes
  'customers:write',
  'products:write',
  'checkouts:create',

  // Sensitive scopes (require approval)
  'checkouts:cancel',
  'customers:delete',
  'webhooks:configure',
};
```

### Approval Tiers

- **None**: Execute immediately
- **Tier 1**: Auto-approve based on rules (e.g., small amounts)
- **Tier 2**: Single human approval required
- **Tier 3**: Dual approval required (e.g., refunds >10,000 DZD)

### Audit Logging

All operations are logged to PostgreSQL with:

- User/agent identification
- Input/output data
- Approval status
- PCI relevance flagging
- Data sensitivity classification

### Rate Limiting

Per-tenant rate limits enforced via Redis:

- **Read operations**: 100 req/min
- **Write operations**: 50 req/min
- **Sensitive operations**: 10 req/min

## 📖 API Reference

### Tools

See [MCP_TOOLS.md](./MCP_TOOLS.md) for complete tool reference.

Quick example:

```typescript
// Get balance
{
  "tool": "get_balance",
  "arguments": {}
}

// Create checkout
{
  "tool": "create_checkout",
  "arguments": {
    "amount": 10000,
    "currency": "dzd",
    "success_url": "https://example.com/success",
    "payment_method": "edahabia"
  }
}
```

### Resources

See [MCP_RESOURCES.md](./MCP_RESOURCES.md) for complete resource reference.

Quick example:

```typescript
// Access current balance
GET chargily://balance/current

// Get transaction details
GET chargily://transactions/checkout_abc123

// Get daily report
GET chargily://reports/daily?date=2024-02-13
```

### Prompts

See [MCP_PROMPTS.md](./MCP_PROMPTS.md) for complete prompt library.

Quick example:

```typescript
// Investigate failed payment
{
  "prompt": "investigate_failed_payment",
  "arguments": {
    "checkout_id": "checkout_abc123",
    "include_customer_history": true
  }
}
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com/) for the Model Context Protocol specification
- [Chargily](https://chargily.com/) for the payment gateway
- The open-source community for excellent tools and libraries

## 🔗 Links

- [Chargily Pay Website](https://pay.chargily.net/)
- [Chargily Pay API Docs](https://dev.chargily.com/pay-v2/introduction)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitHub Repository](https://github.com/chargily/mcp-platform)

## 📞 Support

- **Email**: support@chargily.com
- **GitHub Issues**: [Create an issue](https://github.com/chargily/mcp-platform/issues)
- **Discord**: [Join our community](https://discord.gg/chargily)

---

**Built with ❤️ by the Chargily team**

**Making payment integration intelligent, secure, and delightful.**
