# 🚀 DEPLOYMENT GUIDE - Chargily MCP Platform

Complete production deployment guide for all environments.

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Quick Deploy with Docker](#quick-deploy-with-docker)
3. [VPS Deployment](#vps-deployment)
4. [PaaS Deployment](#paas-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Configuration](#configuration)
7. [SSL/HTTPS Setup](#sslhttps-setup)
8. [Monitoring Setup](#monitoring-setup)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 PREREQUISITES

### **Minimum Requirements:**
- **CPU:** 2 cores
- **RAM:** 2GB
- **Storage:** 20GB SSD
- **OS:** Ubuntu 22.04 LTS (recommended) or any Linux distro

### **Software Requirements:**
- **Node.js:** 20.x or higher
- **PostgreSQL:** 14.x or higher
- **Redis:** 7.x or higher
- **Docker:** 20.10+ (for Docker deployment)

### **External Services:**
- Chargily Pay account ([get API keys](https://pay.chargily.net/dashboard))
- Domain name (for production)
- SSL certificate (free with Let's Encrypt)

---

## 🐳 QUICK DEPLOY WITH DOCKER

**Fastest way to deploy - Recommended for production!**

### **Step 1: Install Docker**

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### **Step 2: Clone & Configure**

```bash
git clone <your-repo> chargily-mcp
cd chargily-mcp

# Create production environment
cp .env.example .env.production

# Edit with your settings
nano .env.production
```

**Required settings:**
```bash
CHARGILY_LIVE_API_KEY=live_sk_xxxxx
CHARGILY_WEBHOOK_SECRET=your_secret
JWT_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=STRONG_PASSWORD
```

### **Step 3: Deploy**

```bash
# One-command deployment!
./deploy.sh
```

**That's it!** Your platform is running at `http://your-server-ip:3000`

### **Step 4: Configure Domain & SSL** (Optional but recommended)

See [SSL/HTTPS Setup](#sslhttps-setup) section below.

---

## 🖥️ VPS DEPLOYMENT

Manual deployment on a VPS (DigitalOcean, Linode, Vultr, etc.)

### **Step 1: Prepare Server**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm@10.5.0

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx
```

### **Step 2: Configure Database**

```bash
# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE chargily_mcp;
CREATE USER chargily WITH ENCRYPTED PASSWORD 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE chargily_mcp TO chargily;
\q
EOF
```

### **Step 3: Deploy Application**

```bash
# Clone repository
cd /var/www
sudo git clone <your-repo> chargily-mcp
cd chargily-mcp
sudo chown -R $USER:$USER .

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
nano .env

# Build application
pnpm build

# Run database migrations
cd prisma
npx prisma migrate deploy
cd ..
```

### **Step 4: Setup PM2 (Process Manager)**

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start apps/server/dist/index.js --name chargily-mcp

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
# Follow the command it shows

# Check status
pm2 status
pm2 logs chargily-mcp
```

### **Step 5: Configure Nginx**

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/chargily-mcp
```

```nginx
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
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/chargily-mcp /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### **Step 6: Setup SSL**

```bash
# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is automatic!
# Test renewal:
sudo certbot renew --dry-run
```

**✅ Done!** Access at `https://api.yourdomain.com`

---

## ☁️ PAAS DEPLOYMENT

Deploy to Platform-as-a-Service providers.

### **Railway.app**

1. **Connect Repository:**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository

2. **Add Services:**
   - Add PostgreSQL database
   - Add Redis database

3. **Configure Environment:**
   - Add all variables from `.env.example`
   - Railway auto-fills database URLs

4. **Deploy:**
   - Automatic on every git push!
   - Custom domain in Settings

### **Render.com**

1. **Create Web Service:**
   - Connect GitHub repository
   - Build command: `pnpm install && pnpm build`
   - Start command: `node apps/server/dist/index.js`

2. **Add Databases:**
   - Create PostgreSQL database
   - Create Redis instance

3. **Environment Variables:**
   - Add from `.env.example`
   - Use Render's database URLs

4. **Deploy:**
   - Automatic deploys on push
   - Free SSL included

### **Heroku**

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create your-app-name

# Add buildpack
heroku buildpacks:add heroku/nodejs

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Add Redis
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set CHARGILY_LIVE_API_KEY=live_sk_xxx
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# Deploy
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy

# View logs
heroku logs --tail
```

### **Fly.io**

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch app
flyctl launch

# Add PostgreSQL
flyctl postgres create

# Add Redis
flyctl redis create

# Set secrets
flyctl secrets set CHARGILY_LIVE_API_KEY=live_sk_xxx
flyctl secrets set JWT_SECRET=$(openssl rand -base64 32)

# Deploy
flyctl deploy

# Open app
flyctl open
```

---

## ☸️ KUBERNETES DEPLOYMENT

For enterprise-scale deployments.

### **Step 1: Convert Docker Compose**

```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.31.2/kompose-linux-amd64 -o kompose
chmod +x kompose
sudo mv kompose /usr/local/bin/

# Convert
kompose convert -f docker-compose.prod.yml
```

### **Step 2: Apply Kubernetes Manifests**

```bash
# Create namespace
kubectl create namespace chargily-mcp

# Apply manifests
kubectl apply -f . -n chargily-mcp

# Check status
kubectl get pods -n chargily-mcp
```

### **Step 3: Expose Service**

```bash
# Create ingress
kubectl apply -f ingress.yaml

# Or use LoadBalancer
kubectl expose deployment chargily-mcp-app --type=LoadBalancer --port=3000
```

### **Step 4: Configure Secrets**

```bash
# Create secrets
kubectl create secret generic chargily-secrets \
  --from-literal=jwt-secret=$(openssl rand -base64 32) \
  --from-literal=chargily-api-key=live_sk_xxx \
  -n chargily-mcp
```

---

## ⚙️ CONFIGURATION

### **Environment Variables**

**Required:**
```bash
# Chargily API
CHARGILY_MODE=production
CHARGILY_LIVE_API_KEY=live_sk_xxxxx
CHARGILY_WEBHOOK_SECRET=your_webhook_secret

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/chargily_mcp

# Authentication
JWT_SECRET=your_32_character_secret

# Server
NODE_ENV=production
PORT=3000
```

**Optional but Recommended:**
```bash
# CORS (Set to your domain)
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# Monitoring
PROMETHEUS_ENABLED=true
```

### **Generate Secrets**

```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# Or
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🔒 SSL/HTTPS SETUP

### **With Let's Encrypt (Free)**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal (automatic)
sudo certbot renew --dry-run
```

### **With Cloudflare (Free)**

1. Add your domain to Cloudflare
2. Point DNS to your server IP
3. Enable "Full (strict)" SSL mode
4. Cloudflare handles SSL automatically!

### **Manual Certificate**

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Strong SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    # ... rest of config
}
```

---

## 📊 MONITORING SETUP

### **Health Checks**

```bash
# Application health
curl https://api.yourdomain.com/health

# Detailed health (if implemented)
curl https://api.yourdomain.com/health/detailed
```

### **Log Monitoring**

```bash
# With PM2
pm2 logs chargily-mcp

# With Docker
docker compose -f docker-compose.prod.yml logs -f app

# System logs
sudo journalctl -u chargily-mcp -f
```

### **Prometheus & Grafana** (Advanced)

See `docker-compose.yml` for monitoring stack.

```bash
# Start monitoring
docker compose up -d prometheus grafana

# Access Grafana: http://your-server:3001
# Default login: admin/admin
```

---

## 💾 BACKUP & RECOVERY

### **Automated Backups**

```bash
# Create backup script
sudo nano /usr/local/bin/backup-chargily.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/chargily-mcp"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump chargily_mcp | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup environment
cp /var/www/chargily-mcp/.env "$BACKUP_DIR/env_$DATE"

# Delete old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-chargily.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
0 2 * * * /usr/local/bin/backup-chargily.sh
```

### **Restore from Backup**

```bash
# Stop application
pm2 stop chargily-mcp

# Restore database
gunzip < /backups/chargily-mcp/db_20260212_020000.sql.gz | \
  sudo -u postgres psql chargily_mcp

# Restart application
pm2 restart chargily-mcp
```

---

## 🐛 TROUBLESHOOTING

### **Application Won't Start**

```bash
# Check logs
pm2 logs chargily-mcp --lines 200

# Check environment
cat .env | grep -v PASSWORD

# Test database connection
psql -h localhost -U chargily -d chargily_mcp

# Check ports
sudo netstat -tulpn | grep 3000
```

### **Database Connection Failed**

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U chargily -d chargily_mcp

# Verify DATABASE_URL
echo $DATABASE_URL
```

### **502 Bad Gateway (Nginx)**

```bash
# Check application status
pm2 status

# Check Nginx config
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### **High Memory Usage**

```bash
# Check memory
free -h

# Check processes
pm2 monit

# Restart application
pm2 restart chargily-mcp
```

---

## ✅ POST-DEPLOYMENT CHECKLIST

- [ ] Application accessible via HTTPS
- [ ] Health endpoint responding
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Backups scheduled
- [ ] Monitoring configured
- [ ] Logs accessible
- [ ] Webhooks configured in Chargily dashboard
- [ ] Domain DNS configured
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Documentation updated

---

## 🎉 SUCCESS!

Your Chargily MCP Platform is now deployed and ready for production use!

**Quick Links:**
- 🌐 Application: `https://api.yourdomain.com`
- 🏥 Health Check: `https://api.yourdomain.com/health`
- 📚 API Docs: `https://api.yourdomain.com/api/v1`

**Need Help?**
- Check logs: `pm2 logs` or `docker logs`
- Review documentation in `/docs`
- Check troubleshooting section above

---

**Happy deploying!** 🚀
