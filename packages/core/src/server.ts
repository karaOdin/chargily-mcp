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
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ChargilyClient } from './client';
import type { ChargilyConfig } from './types';
import { TOOLS, getTool } from './tools';
import { RESOURCES } from './resources';
import { PROMPTS } from './prompts';
import { MCPError, ErrorCategory } from './types';
import { zodToJsonSchema } from './schema-utils';

export interface AuthContext {
  userId?: string;
  tenantId?: string;
  scopes: string[];
}

export interface ApprovalConfig {
  enabled: boolean;
  tier1Max: number; // DZD cents
  tier2Max: number; // DZD cents
  tier3Max: number; // DZD cents
  onApprovalRequired?: (request: any) => Promise<boolean>;
}

export class ChargilyMCPServer {
  private server: Server;
  private client: ChargilyClient;
  private authContext?: AuthContext;
  private approvalConfig?: ApprovalConfig;
  private additionalResources: any[];

  constructor(
    config: ChargilyConfig,
    authContext?: AuthContext,
    approvalConfig?: ApprovalConfig,
    additionalResources?: any[]
  ) {
    this.client = new ChargilyClient(config);
    this.authContext = authContext;
    this.approvalConfig = approvalConfig;
    this.additionalResources = additionalResources || [];

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

  /**
   * Get all resources (core + additional)
   */
  private get allResources() {
    return [...RESOURCES, ...this.additionalResources];
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: zodToJsonSchema(tool.inputSchema),
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

        // Check scopes
        this.checkScopes(tool.scopes);

        // Check approval tier
        await this.checkApproval(tool, validatedArgs);

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
        resources: this.allResources.map((resource) => ({
          uri: resource.uriPattern.source,
          name: resource.description,
          description: resource.description,
          mimeType: 'application/json',
        })),
      };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      // Find matching resource
      for (const resource of this.allResources) {
        const match = uri.match(resource.uriPattern);
        if (match) {
          try {
            // Extract parameters from URI
            const params: Record<string, string> = {};
            const groups = match.slice(1); // Skip full match

            // Map captured groups to parameter names
            const patternStr = resource.uriPattern.source;
            const paramMatches = patternStr.matchAll(/\(([^)]+)\)/g);
            let i = 0;
            for (const _match of paramMatches) {
              if (groups[i]) {
                params[`param${i}`] = groups[i];
              }
              i++;
            }

            // Call resource handler
            const result = await resource.handler(this.client, uri, params);

            return {
              contents: [
                {
                  uri,
                  mimeType: result.mimeType || 'application/json',
                  text: typeof result.content === 'string'
                    ? result.content
                    : JSON.stringify(result.content, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new MCPError(
              ErrorCategory.CHARGILY_API_ERROR,
              `Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }

      throw new MCPError(
        ErrorCategory.NOT_FOUND,
        `Resource not found: ${uri}`
      );
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

    // Get prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Find prompt by name
      const prompt = PROMPTS.find((p) => p.name === name);
      if (!prompt) {
        throw new MCPError(
          ErrorCategory.NOT_FOUND,
          `Prompt '${name}' not found`
        );
      }

      // Validate required arguments
      for (const [argName, config] of Object.entries(prompt.arguments)) {
        if (config.required && (!args || !(argName in args))) {
          throw new MCPError(
            ErrorCategory.VALIDATION_ERROR,
            `Required argument '${argName}' missing for prompt '${name}'`
          );
        }
      }

      // Render template with arguments
      let renderedTemplate = prompt.template;
      const providedArgs = args || {};

      // Replace {{argument}} placeholders
      for (const [argName, value] of Object.entries(providedArgs)) {
        const placeholder = new RegExp(`\\{\\{\\s*${argName}\\s*\\}\\}`, 'g');
        renderedTemplate = renderedTemplate.replace(placeholder, String(value));
      }

      return {
        description: prompt.description,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: renderedTemplate,
            },
          },
        ],
      };
    });
  }

  /**
   * Check if user has required scopes
   */
  private checkScopes(requiredScopes: string[]): void {
    // If no auth context, allow (for local development/testing)
    if (!this.authContext) {
      return;
    }

    const userScopes = this.authContext.scopes || [];

    // Check for admin scope (grants all permissions)
    if (userScopes.includes('admin') || userScopes.includes('*')) {
      return;
    }

    // Check if user has all required scopes
    for (const requiredScope of requiredScopes) {
      const hasScope = userScopes.some((userScope) => {
        // Exact match
        if (userScope === requiredScope) return true;

        // Wildcard match (e.g., "customers:*" matches "customers:read")
        if (userScope.endsWith(':*')) {
          const prefix = userScope.slice(0, -2);
          return requiredScope.startsWith(prefix + ':');
        }

        return false;
      });

      if (!hasScope) {
        throw new MCPError(
          ErrorCategory.AUTHORIZATION_ERROR,
          `Missing required scope: ${requiredScope}`,
          403
        );
      }
    }
  }

  /**
   * Check if operation requires approval
   */
  private async checkApproval(tool: any, args: any): Promise<void> {
    // If approvals not configured, skip
    if (!this.approvalConfig || !this.approvalConfig.enabled) {
      return;
    }

    // Determine required tier based on tool and arguments
    const requiredTier = this.getRequiredApprovalTier(tool, args);

    if (requiredTier === 'none') {
      return; // No approval needed
    }

    // For read operations, no approval needed
    if (tool.scopes.every((s: string) => s.endsWith(':read'))) {
      return;
    }

    // Check if amount-based approval is needed
    const amount = this.extractAmount(args);
    if (amount !== null) {
      const tier = this.calculateTierByAmount(amount);

      if (tier === 'tier1') {
        // Instant approval for small amounts
        return;
      }

      if (tier === 'tier2' || tier === 'tier3') {
        // Request approval
        const approved = await this.requestApproval({
          tool: tool.name,
          args,
          amount,
          tier,
          userId: this.authContext?.userId,
          tenantId: this.authContext?.tenantId,
        });

        if (!approved) {
          throw new MCPError(
            ErrorCategory.AUTHORIZATION_ERROR,
            `Operation requires ${tier} approval. Approval was denied or timed out.`,
            403
          );
        }
      }
    }

    // For sensitive operations, always require approval
    if (tool.approvalTier === 'tier3') {
      const approved = await this.requestApproval({
        tool: tool.name,
        args,
        amount: null,
        tier: 'tier3',
        userId: this.authContext?.userId,
        tenantId: this.authContext?.tenantId,
      });

      if (!approved) {
        throw new MCPError(
          ErrorCategory.AUTHORIZATION_ERROR,
          'Operation requires dual approval. Approval was denied or timed out.',
          403
        );
      }
    }
  }

  /**
   * Get required approval tier for a tool
   */
  private getRequiredApprovalTier(tool: any, _args: any): 'none' | 'tier1' | 'tier2' | 'tier3' {
    return tool.approvalTier;
  }

  /**
   * Extract amount from tool arguments
   */
  private extractAmount(args: any): number | null {
    if (args.amount !== undefined) {
      return args.amount;
    }
    return null;
  }

  /**
   * Calculate approval tier based on amount
   */
  private calculateTierByAmount(amount: number): 'tier1' | 'tier2' | 'tier3' {
    if (!this.approvalConfig) {
      return 'tier1';
    }

    if (amount < this.approvalConfig.tier1Max) {
      return 'tier1'; // Instant approval
    }

    if (amount < this.approvalConfig.tier2Max) {
      return 'tier2'; // Single approval
    }

    return 'tier3'; // Dual approval
  }

  /**
   * Request approval for an operation
   */
  private async requestApproval(request: any): Promise<boolean> {
    if (this.approvalConfig?.onApprovalRequired) {
      return await this.approvalConfig.onApprovalRequired(request);
    }

    // Default: auto-approve for development
    console.warn('⚠️  Approval required but no handler configured. Auto-approving for development.');
    return true;
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
