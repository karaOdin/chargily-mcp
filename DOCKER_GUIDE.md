# 🐳 DOCKER DEPLOYMENT GUIDE

Complete guide to deploying Chargily MCP Platform with Docker.

---

## 📋 PREREQUISITES

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- 2GB+ RAM available
- 10GB+ disk space

**Check installation:**
```bash
docker --version
docker compose version
```

---

## 🚀 QUICK START

### **1. Clone & Configure**

```bash
# Clone repository
git clone <your-repo>
cd chargily-mcp

# Copy environment file
cp .env.example .env.production

# Edit production environment
nano .env.production
```

**Required variables:**
```bash
# Chargily API Keys (GET FROM DASHBOARD!)
CHARGILY_LIVE_API_KEY="live_sk_xxxxx"
CHARGILY_WEBHOOK_SECRET="your_webhook_secret"

# Security (GENERATE NEW SECRET!)
JWT_SECRET="$(openssl rand -base64 32)"

# Database
POSTGRES_PASSWORD="CHANGE_THIS_PASSWORD"
```

### **2. Build & Start**

```bash
# Build the image
docker compose -f docker-compose.prod.yml build

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

### **3. Run Migrations**

```bash
# Run database migrations
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Seed initial data (optional)
docker compose -f docker-compose.prod.yml exec app node scripts/seed.js
```

### **4. Verify Deployment**

```bash
# Check health
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"...","uptime":123}
```

**🎉 Your platform is running!**

---

## 📦 DOCKER SERVICES

### **Services Included:**

| Service | Port | Description |
|---------|------|-------------|
| **app** | 3000 | Chargily MCP Application |
| **postgres** | 5432 | PostgreSQL Database |
| **redis** | 6379 | Redis Cache |

### **Service Management:**

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Start specific service
docker compose -f docker-compose.prod.yml up -d app

# Stop all services
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (⚠️ DELETES DATA!)
docker compose -f docker-compose.prod.yml down -v

# Restart service
docker compose -f docker-compose.prod.yml restart app

# View logs
docker compose -f docker-compose.prod.yml logs -f app

# View logs for all services
docker compose -f docker-compose.prod.yml logs -f
```

---

## 🔧 CONFIGURATION

### **Environment Variables**

Create `.env.production` with:

```bash
# ============================================================================
# PRODUCTION CONFIGURATION
# ============================================================================

# Chargily API
CHARGILY_MODE=production
CHARGILY_LIVE_API_KEY=live_sk_your_live_key
CHARGILY_WEBHOOK_SECRET=your_webhook_secret

# Database
POSTGRES_USER=chargily
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE
POSTGRES_DB=chargily_mcp

# Redis
REDIS_PASSWORD=STRONG_PASSWORD_HERE

# Authentication
JWT_SECRET=your_generated_jwt_secret
JWT_ACCESS_TOKEN_TTL=3600
JWT_REFRESH_TOKEN_TTL=2592000

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# CORS (Set to your domain)
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
PROMETHEUS_ENABLED=true
```

### **Load Environment:**

```bash
# Use specific env file
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

---

## 🏗️ BUILDING

### **Standard Build:**

```bash
docker compose -f docker-compose.prod.yml build
```

### **Build from Scratch (No Cache):**

```bash
docker compose -f docker-compose.prod.yml build --no-cache
```

### **Build Specific Service:**

```bash
docker compose -f docker-compose.prod.yml build app
```

### **Build with Different Dockerfile:**

```bash
docker build -t chargily-mcp:latest -f Dockerfile .
```

---

## 🗄️ DATABASE MANAGEMENT

### **Migrations:**

```bash
# Deploy migrations
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Create new migration (development only)
docker compose -f docker-compose.prod.yml exec app npx prisma migrate dev --name migration_name

# Reset database (⚠️ DELETES ALL DATA!)
docker compose -f docker-compose.prod.yml exec app npx prisma migrate reset
```

### **Backup:**

```bash
# Backup PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U chargily chargily_mcp > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
cat backup_20260212_100000.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U chargily chargily_mcp
```

### **Direct Database Access:**

```bash
# PostgreSQL shell
docker compose -f docker-compose.prod.yml exec postgres psql -U chargily chargily_mcp

# Redis CLI
docker compose -f docker-compose.prod.yml exec redis redis-cli
```

---

## 📊 MONITORING

### **Logs:**

```bash
# Follow app logs
docker compose -f docker-compose.prod.yml logs -f app

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 app

# All services logs
docker compose -f docker-compose.prod.yml logs -f
```

### **Resource Usage:**

```bash
# Monitor resource usage
docker stats chargily-mcp-app

# All containers
docker stats
```

### **Health Checks:**

```bash
# Check health status
docker compose -f docker-compose.prod.yml ps

# Manual health check
curl http://localhost:3000/health

# Detailed health check
docker inspect --format='{{json .State.Health}}' chargily-mcp-app | jq
```

---

## 🔄 UPDATES & MAINTENANCE

### **Update Application:**

```bash
# 1. Pull latest code
git pull

# 2. Rebuild image
docker compose -f docker-compose.prod.yml build app

# 3. Stop old container
docker compose -f docker-compose.prod.yml stop app

# 4. Run migrations
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# 5. Start new container
docker compose -f docker-compose.prod.yml up -d app

# 6. Verify
curl http://localhost:3000/health
```

### **Zero-Downtime Update:**

```bash
# Use rolling update with multiple replicas (requires Docker Swarm or Kubernetes)
# Or use a load balancer to gradually shift traffic
```

### **Cleanup:**

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

---

## 🐛 TROUBLESHOOTING

### **Container Won't Start:**

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs app

# Check container status
docker compose -f docker-compose.prod.yml ps

# Inspect container
docker inspect chargily-mcp-app

# Check environment variables
docker compose -f docker-compose.prod.yml exec app printenv
```

### **Database Connection Failed:**

```bash
# Check if PostgreSQL is running
docker compose -f docker-compose.prod.yml ps postgres

# Test connection
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U chargily

# Check logs
docker compose -f docker-compose.prod.yml logs postgres

# Verify DATABASE_URL
docker compose -f docker-compose.prod.yml exec app printenv DATABASE_URL
```

### **Application Crashes:**

```bash
# View crash logs
docker compose -f docker-compose.prod.yml logs --tail=200 app

# Restart application
docker compose -f docker-compose.prod.yml restart app

# Start with console output (no detach)
docker compose -f docker-compose.prod.yml up app
```

### **High Memory Usage:**

```bash
# Check memory limits
docker stats chargily-mcp-app

# Add memory limit to docker-compose.prod.yml:
services:
  app:
    deploy:
      resources:
        limits:
          memory: 1G
```

### **Disk Space Issues:**

```bash
# Check disk usage
docker system df

# Clean up
docker system prune -a --volumes
```

---

## 🔐 SECURITY BEST PRACTICES

### **1. Use Secrets Management:**

```bash
# Don't commit .env files!
# Use Docker secrets or environment variables

# Example with Docker secrets:
echo "my_jwt_secret" | docker secret create jwt_secret -
```

### **2. Run as Non-Root:**

Already configured in Dockerfile:
```dockerfile
USER appuser  # Non-root user
```

### **3. Network Isolation:**

Services communicate only through internal network:
```yaml
networks:
  chargily-network:
    internal: true  # No external access
```

### **4. Regular Updates:**

```bash
# Update base images
docker compose -f docker-compose.prod.yml pull

# Rebuild with latest
docker compose -f docker-compose.prod.yml build --pull
```

### **5. Limit Resources:**

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

---

## 📈 SCALING

### **Horizontal Scaling:**

```bash
# Scale app service to 3 replicas
docker compose -f docker-compose.prod.yml up -d --scale app=3

# Requires load balancer (nginx, traefik, etc.)
```

### **Vertical Scaling:**

```yaml
# Increase resources in docker-compose.prod.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

---

## 🌐 PRODUCTION DEPLOYMENT

### **With Nginx Reverse Proxy:**

```nginx
# /etc/nginx/sites-available/chargily-mcp
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable SSL with Certbot
sudo certbot --nginx -d api.yourdomain.com
```

### **With Docker Swarm:**

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml chargily
```

### **With Kubernetes:**

Convert docker-compose to Kubernetes:
```bash
kompose convert -f docker-compose.prod.yml
kubectl apply -f .
```

---

## ✅ PRODUCTION CHECKLIST

- [ ] Set strong passwords for database
- [ ] Generate new JWT secret
- [ ] Configure real Chargily API keys
- [ ] Set correct CORS origin
- [ ] Enable HTTPS/SSL
- [ ] Configure backups
- [ ] Set up monitoring
- [ ] Configure log rotation
- [ ] Test health checks
- [ ] Document recovery procedures

---

## 🎯 NEXT STEPS

1. **Deploy to production server**
2. **Configure domain and SSL**
3. **Set up automated backups**
4. **Configure monitoring/alerts**
5. **Test disaster recovery**

---

**Your Docker deployment is ready!** 🐳🚀
