# ============================================================================
# STAGE 1: Dependencies
# ============================================================================
FROM node:20-alpine AS dependencies

# Install pnpm
RUN npm install -g pnpm@10.5.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/auth/package.json ./packages/auth/
COPY packages/approvals/package.json ./packages/approvals/
COPY apps/server/package.json ./apps/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================================================
# STAGE 2: Builder
# ============================================================================
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.5.0

# Set working directory
WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY --from=dependencies /app/apps ./apps

# Copy source code
COPY . .

# Generate Prisma client
RUN cd prisma && npx prisma generate

# Build all packages
RUN pnpm build

# ============================================================================
# STAGE 3: Production
# ============================================================================
FROM node:20-alpine AS production

# Install pnpm and dumb-init (for proper signal handling)
RUN npm install -g pnpm@10.5.0 && \
    apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S appuser && \
    adduser -S -u 1001 -G appuser appuser

# Set working directory
WORKDIR /app

# Copy only production dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./

# Copy built packages
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/auth/package.json ./packages/auth/
COPY --from=builder /app/packages/approvals/dist ./packages/approvals/dist
COPY --from=builder /app/packages/approvals/package.json ./packages/approvals/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Change ownership to app user
RUN chown -R appuser:appuser /app

# Switch to app user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "apps/server/dist/index.js"]
