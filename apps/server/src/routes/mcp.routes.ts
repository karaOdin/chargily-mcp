/**
 * MCP Routes - HTTP/SSE transport for MCP protocol
 * Exposes MCP server functionality via REST API
 */

import express, { Request, Response, NextFunction } from 'express';
import { ChargilyMCPServer } from '@chargily/mcp-core';
import { subscriptionManager } from '@chargily/mcp-core/subscriptions';
import { authenticate } from '../middleware/auth.middleware.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { SERVER_RESOURCES } from '../mcp/server-resources.js';
import { approvalService } from '../services/approval.service.js';
import { userRepository } from '../repositories/index.js';

const router = express.Router();

// MCP-specific auth middleware that returns JSON-RPC errors
router.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.get('authorization');
    if (!authHeader) {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Missing authorization header',
        },
        id: req.body?.id || null,
      });
    }

    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Invalid authorization format',
        },
        id: req.body?.id || null,
      });
    }

    const token = match[1];
    const { authService } = await import('../services/auth.service.js');

    try {
      const payload = authService.verifyJWT(token);
      req.user = {
        id: payload.sub,
        tenantId: payload.tid,
        scopes: payload.scopes,
        method: 'jwt',
      };
      next();
    } catch (error) {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: error instanceof Error ? error.message : 'Authentication failed',
        },
        id: req.body?.id || null,
      });
    }
  } catch (error) {
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
      },
      id: req.body?.id || null,
    });
  }
});

// Create MCP server instance (shared across requests)
let mcpServer: ChargilyMCPServer | null = null;

async function getMCPServer(req: Request): Promise<ChargilyMCPServer> {
  // Create new instance with request-specific auth context
  const authContext = {
    userId: req.user?.id,
    tenantId: req.user?.tenantId,
    scopes: req.user?.scopes || [],
  };

  // Get user's Chargily API key and mode from database
  const user = req.user?.id ? await userRepository.findById(req.user.id) : null;

  // Use user's API key if available, otherwise fall back to global config
  const chargilyApiKey = user?.chargilyApiKey || config.chargilyApiKey;
  const chargilyMode = (user?.chargilyMode as 'sandbox' | 'production') || config.chargilyMode as 'sandbox' | 'production';

  if (!chargilyApiKey) {
    throw new Error('Chargily API key not configured. Please set your API key in settings.');
  }

  const approvalConfig = {
    enabled: config.approvalsEnabled,
    tier1Max: parseInt(process.env.APPROVAL_TIER1_MAX || '5000'), // 50 DZD
    tier2Max: parseInt(process.env.APPROVAL_TIER2_MAX || '100000'), // 1,000 DZD
    tier3Max: parseInt(process.env.APPROVAL_TIER3_MAX || '999999999'),
    onApprovalRequired: async (request: any) => {
      try {
        logger.info(
          {
            action: request.action,
            tier: request.tier,
            amount: request.amount,
            userId: authContext.userId,
          },
          'Approval required for action'
        );

        // Request approval through the approval service
        const result = await approvalService.requestApproval({
          action: request.action,
          input: request.input,
          tier: request.tier,
          amount: request.amount,
          userId: authContext.userId || 'anonymous',
          tenantId: authContext.tenantId,
          requiredApprovers: approvalService.getRequiredApprovers(request.tier),
          expiresIn: 3600, // 1 hour
        });

        if (!result.approved) {
          logger.warn(
            {
              action: request.action,
              approvalId: result.approvalId,
              reason: result.reason,
            },
            'Action not approved'
          );
        }

        return result.approved;
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            action: request.action,
          },
          'Approval request failed'
        );
        return false;
      }
    },
  };

  return new ChargilyMCPServer(
    {
      apiKey: chargilyApiKey,
      mode: chargilyMode,
    },
    authContext,
    approvalConfig,
    SERVER_RESOURCES
  );
}

/**
 * POST /mcp/tools/list
 * List available MCP tools
 */
router.post('/tools/list', async (req: Request, res: Response) => {
  try {
    const server = await getMCPServer(req);

    // Simulate MCP protocol request
    const result = await server['server']._requestHandlers.get('tools/list')?.({
      method: 'tools/list',
      params: {},
    } as any);

    res.json(result);
  } catch (error) {
    logger.error({ error }, 'MCP tools/list failed');
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mcp/tools/call
 * Execute an MCP tool
 */
router.post('/tools/call', async (req: Request, res: Response) => {
  try {
    const { name, arguments: args } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Tool name is required' });
      return;
    }

    const server = await getMCPServer(req);

    const result = await server['server']._requestHandlers.get('tools/call')?.({
      method: 'tools/call',
      params: { name, arguments: args || {} },
    } as any);

    res.json(result);
  } catch (error) {
    logger.error({ error, tool: req.body.name }, 'MCP tool call failed');

    if (error instanceof Error && error.message.includes('Missing required scope')) {
      res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mcp/resources/list
 * List available MCP resources
 */
router.post('/resources/list', async (req: Request, res: Response) => {
  try {
    const server = await getMCPServer(req);

    const result = await server['server']._requestHandlers.get('resources/list')?.({
      method: 'resources/list',
      params: {},
    } as any);

    res.json(result);
  } catch (error) {
    logger.error({ error }, 'MCP resources/list failed');
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mcp/resources/read
 * Read an MCP resource
 */
router.post('/resources/read', async (req: Request, res: Response) => {
  try {
    const { uri } = req.body;

    if (!uri) {
      res.status(400).json({ error: 'Resource URI is required' });
      return;
    }

    const server = await getMCPServer(req);

    const result = await server['server']._requestHandlers.get('resources/read')?.({
      method: 'resources/read',
      params: { uri },
    } as any);

    res.json(result);
  } catch (error) {
    logger.error({ error, uri: req.body.uri }, 'MCP resource read failed');
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mcp/prompts/list
 * List available MCP prompts
 */
router.post('/prompts/list', async (req: Request, res: Response) => {
  try {
    const server = await getMCPServer(req);

    const result = await server['server']._requestHandlers.get('prompts/list')?.({
      method: 'prompts/list',
      params: {},
    } as any);

    res.json(result);
  } catch (error) {
    logger.error({ error }, 'MCP prompts/list failed');
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /mcp/prompts/get
 * Get a rendered prompt
 */
router.post('/prompts/get', async (req: Request, res: Response) => {
  try {
    const { name, arguments: args } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Prompt name is required' });
      return;
    }

    const server = await getMCPServer(req);

    const result = await server['server']._requestHandlers.get('prompts/get')?.({
      method: 'prompts/get',
      params: { name, arguments: args || {} },
    } as any);

    res.json(result);
  } catch (error) {
    logger.error({ error, prompt: req.body.name }, 'MCP prompt get failed');
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /mcp/stream
 * SSE endpoint for real-time MCP resource updates
 */
router.get('/stream', (req: Request, res: Response) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Parse resource filters from query
  const resourceTypes = req.query.resources
    ? (req.query.resources as string).split(',')
    : ['balance', 'checkout', 'customer', 'product']; // Default resources

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    timestamp: Date.now(),
    subscribed: resourceTypes,
  })}\n\n`);

  // Subscribe to resource updates
  const subscriptionIds: string[] = [];

  resourceTypes.forEach((resourceType) => {
    const subscriptionId = subscriptionManager.subscribe(
      resourceType,
      (event: any) => {
        try {
          // Send SSE event to client
          const sseData = {
            type: 'resource_update',
            resource: resourceType,
            event: event,
            timestamp: Date.now(),
          };

          res.write(`event: resource_update\n`);
          res.write(`data: ${JSON.stringify(sseData)}\n\n`);

          logger.debug(
            {
              userId: req.user?.id,
              resourceType,
              eventType: event.type,
            },
            'SSE resource update sent'
          );
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : 'Unknown error',
              resourceType,
            },
            'Failed to send SSE event'
          );
        }
      }
    );

    subscriptionIds.push(subscriptionId);
  });

  logger.info(
    {
      userId: req.user?.id,
      resources: resourceTypes,
      subscriptions: subscriptionIds.length,
    },
    'MCP SSE connection established'
  );

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat\n\n`);
    } catch (error) {
      // Connection closed, clear interval
      clearInterval(heartbeat);
    }
  }, 30000); // 30 seconds

  // Clean up on connection close
  req.on('close', () => {
    clearInterval(heartbeat);

    // Unsubscribe from all resources
    subscriptionIds.forEach((subscriptionId) => {
      resourceTypes.forEach((resourceType) => {
        subscriptionManager.unsubscribe(resourceType, subscriptionId);
      });
    });

    logger.info(
      {
        userId: req.user?.id,
        resources: resourceTypes,
        duration: Date.now(),
      },
      'MCP SSE connection closed'
    );
  });

  // Handle client errors
  req.on('error', (error) => {
    logger.error(
      {
        error: error.message,
        userId: req.user?.id,
      },
      'SSE connection error'
    );
    clearInterval(heartbeat);
  });
});

/**
 * POST /mcp
 * Unified MCP JSON-RPC endpoint
 * Handles all MCP protocol messages in standard JSON-RPC format
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { jsonrpc, method, params, id } = req.body;

    // Validate JSON-RPC format
    if (jsonrpc !== '2.0') {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc must be "2.0"',
        },
        id: id || null,
      });
    }

    if (!method) {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request: method is required',
        },
        id: id || null,
      });
    }

    // Handle notifications (no id field) - just acknowledge with 200
    if (id === undefined || id === null) {
      // This is a notification, not a request
      // Notifications don't get responses, just acknowledge
      return res.status(200).json({});
    }

    const server = await getMCPServer(req);
    const handler = server['server']._requestHandlers.get(method);

    if (!handler) {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
        id: id,
      });
    }

    const handlerResult = await handler({
      method,
      params: params || {},
    } as any);

    // MCP handlers return the actual data, wrap in JSON-RPC envelope
    return res.json({
      jsonrpc: '2.0',
      result: handlerResult,
      id: id,
    });

  } catch (error) {
    logger.error({ error, method: req.body.method }, 'MCP JSON-RPC request failed');

    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
      id: req.body.id || null,
    });
  }
});

/**
 * GET /mcp
 * MCP endpoint info
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Chargily MCP Server',
    version: '1.0.0',
    protocol: 'HTTP + JSON-RPC 2.0',
    endpoints: {
      '/': 'POST /mcp - Unified JSON-RPC endpoint (recommended)',
      'tools/list': 'POST /mcp/tools/list - Legacy endpoint',
      'tools/call': 'POST /mcp/tools/call - Legacy endpoint',
      'resources/list': 'POST /mcp/resources/list - Legacy endpoint',
      'resources/read': 'POST /mcp/resources/read - Legacy endpoint',
      'prompts/list': 'POST /mcp/prompts/list - Legacy endpoint',
      'prompts/get': 'POST /mcp/prompts/get - Legacy endpoint',
      stream: 'GET /mcp/stream (SSE) - Real-time updates',
    },
    authentication: 'Bearer token required in Authorization header',
    documentation: 'See MCP_TOOLS.md, MCP_RESOURCES.md, MCP_PROMPTS.md',
  });
});

export default router;
