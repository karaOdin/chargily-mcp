#!/bin/bash

# ============================================================================
# Chargily MCP Platform - Docker Deployment Script
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker &> /dev/null || ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi

    print_success "Docker and Docker Compose are installed"
}

# Check environment file
check_env() {
    print_step "Checking environment configuration..."

    if [ ! -f .env.production ]; then
        print_warning ".env.production not found, copying from .env.example"
        cp .env.example .env.production

        print_warning "⚠️  IMPORTANT: Edit .env.production with your production settings!"
        echo ""
        echo "Required changes:"
        echo "  - CHARGILY_LIVE_API_KEY"
        echo "  - CHARGILY_WEBHOOK_SECRET"
        echo "  - JWT_SECRET (generate with: openssl rand -base64 32)"
        echo "  - POSTGRES_PASSWORD"
        echo "  - CORS_ORIGIN"
        echo ""
        read -p "Press enter after editing .env.production..."
    fi

    print_success "Environment file ready"
}

# Build images
build_images() {
    print_step "Building Docker images..."

    docker compose --env-file .env.production -f docker-compose.prod.yml build

    print_success "Docker images built successfully"
}

# Start services
start_services() {
    print_step "Starting services..."

    docker compose --env-file .env.production -f docker-compose.prod.yml up -d

    print_success "Services started"
}

# Run migrations
run_migrations() {
    print_step "Running database migrations..."

    # Wait for database to be ready
    sleep 5

    docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app npx prisma migrate deploy

    print_success "Database migrations completed"
}

# Health check
health_check() {
    print_step "Checking application health..."

    max_attempts=30
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            print_success "Application is healthy!"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    print_error "Application health check failed"
    echo "Check logs with: docker compose -f docker-compose.prod.yml logs app"
    return 1
}

# Main deployment
deploy() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║   🚀 Chargily MCP Platform - Docker Deployment 🚀       ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""

    check_prerequisites
    check_env
    build_images
    start_services
    run_migrations
    health_check

    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║   ✅ Deployment Complete!                                ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo "📍 Application: http://localhost:3000"
    echo "📍 Health Check: http://localhost:3000/health"
    echo "📍 API Documentation: http://localhost:3000/api/v1"
    echo ""
    echo "🔧 Useful Commands:"
    echo "  - View logs:    docker compose -f docker-compose.prod.yml logs -f app"
    echo "  - Stop:         docker compose -f docker-compose.prod.yml down"
    echo "  - Restart:      docker compose -f docker-compose.prod.yml restart app"
    echo "  - Shell access: docker compose -f docker-compose.prod.yml exec app sh"
    echo ""
}

# Handle script arguments
case "${1:-}" in
    "")
        deploy
        ;;
    "stop")
        print_step "Stopping services..."
        docker compose --env-file .env.production -f docker-compose.prod.yml down
        print_success "Services stopped"
        ;;
    "restart")
        print_step "Restarting services..."
        docker compose --env-file .env.production -f docker-compose.prod.yml restart
        print_success "Services restarted"
        ;;
    "logs")
        docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
        ;;
    "status")
        docker compose --env-file .env.production -f docker-compose.prod.yml ps
        ;;
    "clean")
        print_warning "This will remove all containers, volumes, and data!"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" == "yes" ]; then
            docker compose --env-file .env.production -f docker-compose.prod.yml down -v
            print_success "Cleaned up successfully"
        fi
        ;;
    "backup")
        print_step "Creating database backup..."
        mkdir -p backups
        docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres pg_dump -U chargily chargily_mcp > "backups/backup_$(date +%Y%m%d_%H%M%S).sql"
        print_success "Backup created in backups/"
        ;;
    *)
        echo "Usage: ./deploy.sh [command]"
        echo ""
        echo "Commands:"
        echo "  (none)   Deploy or update the application"
        echo "  stop     Stop all services"
        echo "  restart  Restart all services"
        echo "  logs     View application logs"
        echo "  status   Show service status"
        echo "  clean    Remove all containers and volumes"
        echo "  backup   Create database backup"
        exit 1
        ;;
esac
