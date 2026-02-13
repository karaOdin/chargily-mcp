# 🚀 Chargily MCP Platform - MVP

**Connect AI Assistants to Chargily Pay** - A SaaS platform that enables AI assistants to interact with Chargily Pay through the Model Context Protocol (MCP).

---

## 🎯 What is This?

Chargily MCP is a production-ready SaaS platform that allows users to:

1. **Sign up** for an account
2. **Connect** their Chargily Pay account (sandbox or production)
3. **Use AI assistants** (Claude, ChatGPT, etc.) to manage payments via MCP

Your users can manage customers, create checkouts, view balances, and more - all through natural conversation with AI.

---

## ✨ Features

### Core MVP Features

- **User Authentication**
  - Signup/Login with JWT
  - Secure password hashing (bcrypt)
  - API key management

- **Chargily Integration**
  - Per-user API key storage
  - Sandbox and production modes
  - Secure API key encryption

- **MCP Server**
  - 23 Chargily Pay tools available
  - Balance management
  - Customer management
  - Checkout creation
  - Product & pricing management
  - Payment links

- **Security**
  - Rate limiting on auth endpoints
  - JWT-based authentication
  - CORS configuration
  - Dual-hash API keys (SHA-256 + bcrypt)

- **Infrastructure**
  - MySQL database
  - Redis caching
  - RESTful API
  - Admin dashboard (Next.js)

---

## 🏗️ Architecture

```
┌─────────────────┐
│   AI Assistant  │ (Claude, ChatGPT, etc.)
└────────┬────────┘
         │ MCP Protocol
         ↓
┌─────────────────┐
│  Chargily MCP   │
│     Server      │
│   (Node.js)     │
└────────┬────────┘
         │
    ┌────┴─────┬──────────┬──────────┐
    ↓          ↓          ↓          ↓
┌────────┐ ┌──────┐ ┌────────┐ ┌──────────┐
│ MySQL  │ │Redis │ │ Admin  │ │ Chargily │
│   DB   │ │Cache │ │   UI   │ │   API    │
└────────┘ └──────┘ └────────┘ └──────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Redis 7.0+ (optional)
- pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/chargily-mcp.git
cd chargily-mcp

# Install dependencies
pnpm install

# Setup MySQL database
mysql -u root -p
```

```sql
CREATE DATABASE chargily_mcp;
CREATE USER 'chargily_user'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON chargily_mcp.* TO 'chargily_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
# Configure environment
cd apps/server
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
pnpm prisma migrate dev

# Start development server
pnpm dev
```

The server will be running at `http://localhost:3000`

---

## 📚 API Endpoints

### Authentication

```bash
# Signup
POST /api/v1/auth/signup
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}

# Login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Get Profile
GET /api/v1/auth/me
Authorization: Bearer <token>

# Update Settings
PATCH /api/v1/auth/me
Authorization: Bearer <token>
{
  "chargilyApiKey": "test_sk_...",
  "chargilyMode": "sandbox"
}
```

### MCP Endpoints

```bash
# List Available Tools
POST /mcp/tools/list
Authorization: Bearer <token>

# Call a Tool
POST /mcp/tools/call
Authorization: Bearer <token>
{
  "name": "get_balance",
  "arguments": {}
}

# Example: Get Balance
POST /mcp/tools/call
Authorization: Bearer <token>
{
  "name": "get_balance",
  "arguments": {}
}

# Example: Create Customer
POST /mcp/tools/call
Authorization: Bearer <token>
{
  "name": "create_customer",
  "arguments": {
    "name": "Ahmed Bouazizi",
    "email": "ahmed@example.com",
    "phone": "+213555123456"
  }
}

# Example: Create Checkout
POST /mcp/tools/call
Authorization: Bearer <token>
{
  "name": "create_checkout",
  "arguments": {
    "amount": 50000,
    "success_url": "https://example.com/success",
    "description": "Payment for order #123"
  }
}
```

### Health Check

```bash
GET /health
```

---

## 🛠️ Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_balance` | Get account balance (DZD, USD, EUR) |
| `create_customer` | Create a new customer |
| `get_customer` | Get customer details |
| `list_customers` | List all customers |
| `update_customer` | Update customer info |
| `delete_customer` | Delete a customer |
| `create_product` | Create a product |
| `get_product` | Get product details |
| `list_products` | List all products |
| `update_product` | Update product info |
| `delete_product` | Delete a product |
| `create_price` | Create pricing for a product |
| `get_price` | Get price details |
| `list_prices` | List all prices |
| `update_price` | Update price metadata |
| `create_checkout` | Create payment checkout |
| `get_checkout` | Get checkout details |
| `list_checkouts` | List all checkouts |
| `expire_checkout` | Expire a checkout |
| `create_payment_link` | Create reusable payment link |
| `get_payment_link` | Get payment link details |
| `list_payment_links` | List all payment links |
| `update_payment_link` | Update payment link |

---

## 🧪 Testing

### Create Test User

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "name": "Test User"
  }'
```

### Get Access Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

### Update Chargily Settings

```bash
TOKEN="your_access_token_here"

curl -X PATCH http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chargilyApiKey": "test_sk_YOUR_CHARGILY_KEY",
    "chargilyMode": "sandbox"
  }'
```

### Test Balance Retrieval

```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_balance",
    "arguments": {}
  }'
```

---

## 📖 Documentation

- **[Deployment Guide](./DEPLOYMENT-MVP.md)** - Production deployment instructions
- **[API Documentation](./docs/API.md)** - Complete API reference
- **[MCP Tools](./docs/MCP_TOOLS.md)** - Detailed tool documentation
- **[Chargily API](https://docs.chargily.com)** - Official Chargily documentation

---

## 🔒 Security

### Best Practices

- All passwords are hashed with bcrypt (10 rounds)
- JWT tokens with expiration (1 hour access, 30 days refresh)
- Rate limiting on authentication endpoints (5 requests per 15 minutes)
- API keys use dual-hash system (SHA-256 for lookup, bcrypt for verification)
- CORS configured for specific origins
- Input validation on all endpoints
- SQL injection prevention via Prisma ORM

### Environment Variables

Never commit these to version control:

```env
JWT_SECRET=           # Strong random string (min 32 chars)
DATABASE_URL=         # MySQL connection string
CHARGILY_API_KEY=     # Your Chargily API key
```

---

## 🐛 Troubleshooting

### Server Won't Start

```bash
# Check database connection
mysql -u chargily_user -p chargily_mcp

# Check environment variables
cat apps/server/.env

# View logs
pnpm --filter @chargily/mcp-server dev
```

### Authentication Errors

```bash
# Check JWT secret is set
grep JWT_SECRET apps/server/.env

# Verify token expiration
# Tokens expire after 1 hour - get a new one
```

### Database Errors

```bash
# Reset database
pnpm --filter @chargily/mcp-server prisma migrate reset

# View current schema
pnpm --filter @chargily/mcp-server prisma studio
```

---

## 📦 Project Structure

```
chargily-mcp/
├── apps/
│   ├── server/              # Node.js API server
│   │   ├── src/
│   │   │   ├── routes/      # API routes
│   │   │   ├── services/    # Business logic
│   │   │   ├── middleware/  # Auth, rate limiting, etc.
│   │   │   └── utils/       # Database, config, etc.
│   │   └── package.json
│   │
│   └── admin-ui/            # Next.js admin dashboard
│       ├── src/
│       │   ├── app/         # App router pages
│       │   ├── components/  # React components
│       │   └── lib/         # API client, utils
│       └── package.json
│
├── packages/
│   ├── core/                # MCP server core
│   └── auth/                # Authentication library
│
├── prisma/
│   └── schema.prisma        # Database schema
│
├── DEPLOYMENT-MVP.md        # Deployment guide
└── README-MVP.md            # This file
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 💬 Support

- **Email**: support@yourdomain.com
- **Issues**: https://github.com/your-org/chargily-mcp/issues
- **Chargily**: https://docs.chargily.com

---

## 🎉 What's Next?

### Future Enhancements (Post-MVP)

- [ ] Webhook management UI
- [ ] Approval workflow for large transactions
- [ ] Multi-user teams & organizations
- [ ] Advanced analytics dashboard
- [ ] Email notifications
- [ ] Audit log viewer
- [ ] API rate limiting per user
- [ ] Subscription management
- [ ] Invoice generation

---

**Built with ❤️ for the Algerian developer community**

**Powered by**: Node.js • MySQL • Redis • Prisma • Next.js • Chargily Pay
