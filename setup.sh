#!/bin/bash

# Chargily MCP Platform - Setup Script
# This script sets up the complete development environment

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🚀 CHARGILY MCP PLATFORM - SETUP  🚀                      ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm not found. Installing pnpm..."
    npm install -g pnpm
fi
echo "✅ pnpm $(pnpm --version)"

# Check Docker (optional)
if command -v docker &> /dev/null; then
    echo "✅ Docker $(docker --version | cut -d' ' -f3)"
else
    echo "⚠️  Docker not found (optional - for local database)"
fi

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🔧 Building packages..."
pnpm build

echo ""
echo "⚙️  Setting up environment..."

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env

    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/g" .env

    echo "✅ .env file created with random JWT secret"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your Chargily API keys:"
    echo "   - CHARGILY_TEST_API_KEY=test_sk_your_test_key"
    echo "   - CHARGILY_LIVE_API_KEY=live_sk_your_live_key"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🗄️  Setting up database..."

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "Starting PostgreSQL and Redis with Docker..."
    docker compose up -d postgres redis

    # Wait for database
    echo "Waiting for database to be ready..."
    sleep 5

    echo "✅ Database containers started"
else
    echo "⚠️  Docker not available. Please start PostgreSQL and Redis manually:"
    echo ""
    echo "  PostgreSQL: postgresql://chargily:DANTEjoker@localhost:5432/chargily_mcp"
    echo "  Redis: redis://localhost:6379"
    echo ""
    read -p "Press Enter when database is ready..."
fi

echo ""
echo "🔄 Running database migrations..."
npx prisma migrate dev --name init

echo ""
echo "✅ Setup complete!"
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🎉 SETUP SUCCESSFUL! 🎉                                   ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Edit .env and add your Chargily API keys"
echo "2. Start the server:"
echo "   cd apps/server && pnpm dev"
echo ""
echo "3. Test the API:"
echo "   curl http://localhost:3000/health"
echo ""
echo "4. View API docs:"
echo "   http://localhost:3000/"
echo ""
echo "Happy coding! 🚀"
