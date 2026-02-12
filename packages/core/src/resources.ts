/**
 * MCP Resource definitions
 * Resources provide read-only access to data via URI-based addressing
 */

export interface ResourceDefinition {
  uriPattern: RegExp;
  description: string;
  scopes: string[];
  freshness: number; // TTL in seconds
  handler: (uri: string, params: Record<string, string>) => Promise<any>;
}

export const RESOURCES: ResourceDefinition[] = [
  {
    uriPattern: /^chargily:\/\/balance\/current$/,
    description: 'Current account balance across all wallets',
    scopes: ['balance:read'],
    freshness: 30,
    handler: async () => {
      // Implementation would fetch from client and format
      return { uri: 'chargily://balance/current', mimeType: 'application/json', content: {} };
    },
  },
  {
    uriPattern: /^chargily:\/\/transactions\/([a-z0-9_]+)$/,
    description: 'Single transaction details',
    scopes: ['checkouts:read'],
    freshness: Infinity, // Immutable
    handler: async (uri, _params) => {
      return { uri, mimeType: 'application/json', content: {} };
    },
  },
  // Additional resources defined in MCP_RESOURCES.md
];
