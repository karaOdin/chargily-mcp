#!/bin/bash

# Get token from login
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@chargily.com","password":"test123456"}')

TOKEN=$(echo $RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  exit 1
fi

echo "Got token: ${TOKEN:0:50}..."
echo ""
echo "Testing MCP client..."
echo ""

# Test tools/list
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | \
  timeout 3 node /home/karaodin/chargily-mcp/packages/mcp-client/index.js \
  http://localhost:3000/mcp "$TOKEN"
