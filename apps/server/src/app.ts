/**
 * Express application setup
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { httpLogger } from './utils/logger.js';
import { config } from './utils/config.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import healthRoutes from './routes/health.js';
import apiRoutes from './routes/api/index.js';

// Create Express app
export const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: config.corsCredentials,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_REQUEST_SIZE || '10mb' }));

// HTTP logging
app.use(httpLogger);

// ============================================================================
// ROUTES
// ============================================================================

// Health checks
app.use(healthRoutes);

// API v1 routes
app.use('/api/v1', apiRoutes);

// MCP endpoint (to be added)
// app.use('/mcp', mcpRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Chargily MCP Platform',
    version: process.env.APP_VERSION || '1.0.0',
    status: 'running',
    environment: config.nodeEnv,
    endpoints: {
      health: '/health',
      api: '/api/v1',
      mcp: '/mcp',
      docs: '/docs',
    },
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);
