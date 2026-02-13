# 🚀 Chargily MCP - MVP Deployment Guide

Quick deployment guide for the Chargily MCP Platform MVP with MySQL.

## 📋 Quick Start

### Prerequisites

- Ubuntu 22.04+ or similar Linux distribution
- Node.js 18+ installed
- MySQL 8.0+ installed
- Redis 7.0+ (optional but recommended)
- Domain name with SSL certificate

---

## 🔧 1. Server Setup

### Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install MySQL
sudo apt install -y mysql-server

# Install Redis
sudo apt install -y redis-server

# Install PM2 for process management
npm install -g pm2
```

### Configure MySQL

```bash
# Secure MySQL installation
sudo mysql_secure_installation

# Create database and user
sudo mysql -u root -p
```

```sql
CREATE DATABASE chargily_mcp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'chargily_user'@'localhost' IDENTIFIED BY 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON chargily_mcp.* TO 'chargily_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 📦 2. Deploy Application

### Clone and Install

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/your-org/chargily-mcp.git
cd chargily-mcp

# Install dependencies
pnpm install

# Build packages
pnpm build
```

### Configure Environment

Create `/opt/chargily-mcp/apps/server/.env`:

```env
# Environment
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database - UPDATE WITH YOUR CREDENTIALS
DATABASE_URL=mysql://chargily_user:YOUR_SECURE_PASSWORD@localhost:3306/chargily_mcp

# Redis
REDIS_URL=redis://localhost:6379

# JWT - GENERATE SECURE RANDOM STRINGS
JWT_SECRET=CHANGE_THIS_TO_A_RANDOM_STRING_MIN_32_CHARACTERS
JWT_ACCESS_TOKEN_TTL=3600
JWT_REFRESH_TOKEN_TTL=2592000

# OAuth
OAUTH_ISSUER=https://api.yourdomain.com
OAUTH_AUDIENCE=https://api.yourdomain.com

# Chargily (Default fallback - users provide their own)
CHARGILY_MODE=sandbox
CHARGILY_TEST_API_KEY=test_sk_YOUR_DEFAULT_KEY

# CORS - UPDATE WITH YOUR DOMAIN
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Features
APPROVALS_ENABLED=false
```

### Run Database Migrations

```bash
cd /opt/chargily-mcp
pnpm --filter @chargily/mcp-server prisma migrate deploy
```

---

## 🚀 3. Start Server with PM2

### Create PM2 Ecosystem File

Create `/opt/chargily-mcp/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'chargily-mcp-server',
      cwd: './apps/server',
      script: 'pnpm',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      time: true,
      max_memory_restart: '500M',
    },
  ],
};
```

### Start Application

```bash
cd /opt/chargily-mcp

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Run the command it outputs

# Check status
pm2 status
pm2 logs chargily-mcp-server
```

---

## 🌐 4. Nginx Reverse Proxy

### Install Nginx

```bash
sudo apt install -y nginx
```

### Configure API Domain

Create `/etc/nginx/sites-available/chargily-mcp-api`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration (after certbot setup)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy to Node.js server
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

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/chargily-mcp-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔒 5. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## 🎨 6. Deploy Admin UI (Optional)

### Build Admin UI

```bash
cd /opt/chargily-mcp/apps/admin-ui

# Create production environment file
echo "NEXT_PUBLIC_API_URL=https://api.yourdomain.com" > .env.production

# Build
pnpm build
```

### Configure Nginx for Admin UI

Create `/etc/nginx/sites-available/chargily-mcp-admin`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://yourdomain.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    root /opt/chargily-mcp/apps/admin-ui/out;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /_next/static {
        alias /opt/chargily-mcp/apps/admin-ui/out/_next/static;
        expires 1y;
        access_log off;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/chargily-mcp-admin /etc/nginx/sites-enabled/
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo systemctl reload nginx
```

---

## ✅ 7. Post-Deployment Checks

### Test API Health

```bash
curl https://api.yourdomain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-13T..."
}
```

### Create First User

```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourdomain.com",
    "password": "SecurePassword123!",
    "name": "Admin"
  }'
```

Save the returned `accessToken`.

### Test MCP Endpoints

```bash
# Use the token from signup
TOKEN="paste_access_token_here"

# List available tools
curl -X POST https://api.yourdomain.com/mcp/tools/list \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Configure Chargily API Key

```bash
# Update user settings with Chargily API key
curl -X PATCH https://api.yourdomain.com/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chargilyApiKey": "test_sk_YOUR_CHARGILY_API_KEY",
    "chargilyMode": "sandbox"
  }'
```

### Test Balance Retrieval

```bash
curl -X POST https://api.yourdomain.com/mcp/tools/call \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_balance",
    "arguments": {}
  }'
```

---

## 📊 8. Monitoring & Maintenance

### View Logs

```bash
# PM2 logs
pm2 logs chargily-mcp-server

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MySQL logs
sudo tail -f /var/log/mysql/error.log
```

### Monitor Resources

```bash
# PM2 monitoring dashboard
pm2 monit

# System resources
htop
```

### Database Backups

Create `/opt/scripts/backup-db.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/chargily-mcp"
DB_NAME="chargily_mcp"
DB_USER="chargily_user"
DB_PASS="YOUR_SECURE_PASSWORD"

mkdir -p $BACKUP_DIR

mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

```bash
chmod +x /opt/scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /opt/scripts/backup-db.sh
```

---

## 🔥 9. Troubleshooting

### Server Not Starting

```bash
# Check PM2 status
pm2 status

# View error logs
pm2 logs chargily-mcp-server --err

# Restart server
pm2 restart chargily-mcp-server

# Check environment variables
pm2 env 0
```

### Database Connection Issues

```bash
# Test MySQL connection
mysql -u chargily_user -p chargily_mcp

# Check MySQL status
sudo systemctl status mysql

# Restart MySQL
sudo systemctl restart mysql
```

### High Memory Usage

```bash
# Restart PM2 processes
pm2 restart all

# Reload with zero downtime
pm2 reload chargily-mcp-server

# Check memory usage
pm2 monit
free -h
```

### SSL Certificate Issues

```bash
# Renew certificates manually
sudo certbot renew

# Check certificate status
sudo certbot certificates

# Test SSL configuration
sudo nginx -t
```

---

## 🔐 10. Security Checklist

- [ ] Change all default passwords (MySQL, Redis, JWT secret)
- [ ] Enable UFW firewall
- [ ] Configure fail2ban for SSH protection
- [ ] Set up automated backups
- [ ] Enable Redis password authentication
- [ ] Restrict MySQL to localhost only
- [ ] Keep system and packages updated
- [ ] Monitor access logs regularly
- [ ] Use strong JWT secrets (min 32 characters)
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Use HTTPS everywhere

---

## 🎯 Quick Commands Reference

```bash
# Start server
pm2 start ecosystem.config.js --env production

# Stop server
pm2 stop chargily-mcp-server

# Restart server
pm2 restart chargily-mcp-server

# View logs
pm2 logs chargily-mcp-server

# Monitor
pm2 monit

# Update application
cd /opt/chargily-mcp
git pull
pnpm install
pnpm build
pm2 restart chargily-mcp-server

# Backup database
/opt/scripts/backup-db.sh

# Restart Nginx
sudo systemctl restart nginx

# Renew SSL
sudo certbot renew
```

---

## 📞 Support

- **Issues**: https://github.com/your-org/chargily-mcp/issues
- **Chargily Docs**: https://docs.chargily.com
- **Email**: support@yourdomain.com

---

**MVP Version 1.0 - Updated February 2026**
