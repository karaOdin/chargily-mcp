#!/usr/bin/env node
/**
 * Chargily MCP Bridge for Windows
 * Bridges stdio (Claude Desktop) <-> HTTP (Chargily MCP Server in WSL)
 */

const http = require('http');
const https = require('https');
const readline = require('readline');

const SERVER_URL = process.argv[2] || 'http://localhost:3000/mcp';
const TOKEN = process.argv[3];

if (!TOKEN) {
  console.error('Error: Token is required');
  console.error('Usage: node chargily-bridge.js <server_url> <token>');
  console.error('Example: node chargily-bridge.js http://localhost:3000/mcp eyJhbGc...');
  process.exit(1);
}

// Parse URL
const url = new URL(SERVER_URL);
const isHttps = url.protocol === 'https:';
const httpModule = isHttps ? https : http;

console.error(`[Bridge] Started: ${SERVER_URL}`);
console.error(`[Bridge] Token: ${TOKEN.substring(0, 20)}...`);

// Create readline interface for stdio
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Handle incoming JSON-RPC requests from Claude Desktop
rl.on('line', async (line) => {
  if (!line.trim()) return;

  try {
    const request = JSON.parse(line);
    console.error(`[Bridge] Request: ${request.method}`);

    // Prepare HTTP request to MCP server
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'Chargily-MCP-Bridge/1.0'
      }
    };

    const requestData = JSON.stringify(request);

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(JSON.stringify(response));
          console.error(`[Bridge] Response: OK (${data.length} bytes)`);
        } catch (error) {
          console.error(`[Bridge] Parse error: ${error.message}`);
          console.error(`[Bridge] Response was: ${data.substring(0, 500)}`);
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32700,
              message: `Parse error: ${error.message}`
            },
            id: request.id || null
          }));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`[Bridge] Request error: ${error.message}`);
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: `Connection error: ${error.message}`
        },
        id: request.id || null
      }));
    });

    req.write(requestData);
    req.end();

  } catch (error) {
    console.error(`[Bridge] Parse error: ${error.message}`);
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: `Parse error: ${error.message}`
      },
      id: null
    }));
  }
});

rl.on('close', () => {
  console.error('[Bridge] Stdio closed, exiting');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error('[Bridge] Received SIGINT, exiting');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[Bridge] Received SIGTERM, exiting');
  process.exit(0);
});
