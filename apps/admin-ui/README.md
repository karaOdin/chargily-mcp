# Chargily MCP Admin UI

Modern, elegant admin dashboard for the Chargily MCP Platform built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

✨ **Dashboard Overview**
- Real-time statistics (balance, webhooks, approvals)
- Quick actions and navigation
- Beautiful, responsive design

🔑 **API Key Management**
- Create and manage API keys
- View usage statistics
- Revoke keys instantly

📨 **Webhook Monitoring**
- Real-time webhook logs
- Processing status tracking
- Retry failed webhooks
- Signature verification status

✅ **Approval Workflow**
- Review pending approval requests
- Approve or reject high-value transactions
- Tier-based authorization
- Real-time updates

📊 **Activity Monitoring**
- Audit logs
- User actions
- System events

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Custom components with shadcn/ui design patterns
- **State Management:** TanStack Query (React Query)
- **HTTP Client:** Axios
- **Icons:** Lucide React
- **Charts:** Recharts
- **Date Handling:** date-fns
- **Notifications:** Sonner

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Running Chargily MCP server (default: http://localhost:3000)

### Installation

```bash
# Install dependencies
npm install
# or
bun install

# Set environment variables
cp .env.example .env.local

# Update NEXT_PUBLIC_API_URL in .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000

# Run development server
npm run dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) to view the admin dashboard.

### Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Project Structure

```
apps/admin-ui/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── dashboard/          # Dashboard pages
│   │   │   ├── page.tsx        # Overview
│   │   │   ├── api-keys/       # API key management
│   │   │   ├── webhooks/       # Webhook logs
│   │   │   ├── approvals/      # Approval queue
│   │   │   ├── resources/      # MCP resources
│   │   │   ├── activity/       # Activity logs
│   │   │   └── settings/       # Settings
│   │   ├── layout.tsx          # Root layout
│   │   ├── providers.tsx       # React Query provider
│   │   └── globals.css         # Global styles
│   ├── components/             # Reusable components
│   │   └── sidebar.tsx         # Navigation sidebar
│   ├── lib/                    # Utilities
│   │   ├── api.ts              # API client
│   │   └── utils.ts            # Helper functions
│   └── hooks/                  # Custom React hooks
├── public/                     # Static assets
├── package.json
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## API Integration

The admin UI communicates with the Chargily MCP server via REST API:

- **API Keys:** `/api/v1/auth/api-keys`
- **Webhooks:** `/api/v1/webhooks/*`
- **Approvals:** `/api/v1/approvals/*`
- **MCP Tools:** `/mcp/tools/*`
- **MCP Resources:** `/mcp/resources/*`

See `src/lib/api.ts` for full API client implementation.

## Customization

### Theming

Colors and design tokens are defined in `tailwind.config.ts` and `src/app/globals.css`. The UI supports both light and dark modes.

### Adding Pages

1. Create a new directory in `src/app/dashboard/[page-name]`
2. Add a `page.tsx` file
3. Update navigation in `src/components/sidebar.tsx`

### Environment Variables

- `NEXT_PUBLIC_API_URL` - Chargily MCP server URL (default: http://localhost:3000)

## Development

```bash
# Run linter
npm run lint

# Type check
npm run type-check
```

## Production Deployment

### Using Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --production
EXPOSE 3001
CMD ["npm", "start"]
```

### Using Vercel

The admin UI can be deployed to Vercel with zero configuration:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## License

Part of the Chargily MCP Platform project.
