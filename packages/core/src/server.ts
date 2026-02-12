/**
 * Chargily MCP Server
 * Main server implementation using @modelcontextprotocol/sdk
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ChargilyClient } from './client';
import type { ChargilyConfig } from './types';
import { TOOLS, getTool } from './tools';
import { RESOURCES } from './resources';
import { PROMPTS } from './prompts';
import { MCPError, ErrorCategory } from './types';

export class ChargilyMCPServer {
  private server: Server;
  private client: ChargilyClient;

  constructor(config: ChargilyConfig) {
    this.client = new ChargilyClient(config);

    this.server = new Server(
      {
        name: 'chargily-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: {}, // Would be derived from zod schema
          },
        })),
      };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = getTool(name);
      if (!tool) {
        throw new MCPError(
          ErrorCategory.TOOL_NOT_FOUND,
          `Tool '${name}' not found`
        );
      }

      try {
        // Validate input
        const validatedArgs = tool.inputSchema.parse(args);

        // Check scopes (would integrate with auth middleware)
        // await this.checkScopes(tool.scopes);

        // Check approval tier (would integrate with approval system)
        // await this.checkApproval(tool.approvalTier, validatedArgs);

        // Execute tool
        const result = await tool.handler(this.client, validatedArgs);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof MCPError) {
          throw error;
        }
        throw new MCPError(
          ErrorCategory.CHARGILY_API_ERROR,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: RESOURCES.map((resource) => ({
          uri: resource.uriPattern.source,
          name: resource.description,
          description: resource.description,
          mimeType: 'application/json',
        })),
      };
    });

    // List prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: PROMPTS.map((prompt) => ({
          name: prompt.name,
          description: prompt.description,
          arguments: Object.entries(prompt.arguments).map(([name, config]) => ({
            name,
            description: config.description,
            required: config.required,
          })),
        })),
      };
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Chargily MCP Server running on stdio');
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: ChargilyConfig = {
    apiKey: process.env.CHARGILY_API_KEY || '',
    mode: (process.env.CHARGILY_MODE as 'sandbox' | 'production') || 'sandbox',
  };

  const server = new ChargilyMCPServer(config);
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
