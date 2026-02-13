#!/usr/bin/env node
/**
 * Local MCP Client Wrapper
 * Bridges stdio (Claude Desktop) <-> HTTP (Chargily MCP Server)
 */

import fetch from 'node-fetch';

// Get config from environment or command line args
const MCP_SERVER_URL = process.argv[2] || process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
const MCP_TOKEN = process.argv[3] || process.env.MCP_TOKEN;

if (!MCP_TOKEN) {
  console.error('Error: MCP_TOKEN is required');
  console.error('Usage: node index.js <server_url> <token>');
  console.error('   Or: MCP_SERVER_URL=... MCP_TOKEN=... node index.js');
  process.exit(1);
}

// Create stdio transport for Claude Desktop
process.stdin.setEncoding('utf8');
process.stdout.setEncoding('utf8');

const server = {
  async request(request) {
    try {
      const response = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MCP_TOKEN}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Request failed:', error.message);
      throw error;
    }
  }
};

// Handle stdio communication
let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;

  // Process complete JSON-RPC messages (newline-delimited)
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const request = JSON.parse(line);
      const response = await server.request(request);
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error.message,
        },
        id: null,
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

console.error(`MCP Client started: ${MCP_SERVER_URL}`);
