/**
 * MCP Routes - HTTP/SSE transport for MCP protocol
 * Exposes MCP server functionality via REST API
 */

import express, { Request, Response } from 'express';
import { ChargilyMCPServer } from '@chargily/mcp-core';
import { subscriptionManager } from '@chargily/mcp-core/subscriptions';
import { authenticate } from '../middleware/auth.middleware.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { SERVER_RESOURCES } from '../mcp/server-resources.js';
import { approvalService } from '../services/approval.service.js';
import { userRepository } from '../repositories/index.js';

const router = express.Router();

// Apply authentication to all MCP routes
router.use(authenticate);

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
 * GET /mcp
 * MCP endpoint info
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Chargily MCP Server',
    version: '1.0.0',
    protocol: 'HTTP',
    endpoints: {
      'tools/list': 'POST /mcp/tools/list',
      'tools/call': 'POST /mcp/tools/call',
      'resources/list': 'POST /mcp/resources/list',
      'resources/read': 'POST /mcp/resources/read',
      'prompts/list': 'POST /mcp/prompts/list',
      'prompts/get': 'POST /mcp/prompts/get',
      stream: 'GET /mcp/stream (SSE)',
    },
    authentication: 'Bearer token required',
    documentation: 'See MCP_TOOLS.md, MCP_RESOURCES.md, MCP_PROMPTS.md',
  });
});

export default router;
