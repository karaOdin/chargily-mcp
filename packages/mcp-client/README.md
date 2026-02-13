# Chargily MCP Client

Local stdio bridge that connects Claude Desktop to Chargily MCP Server.

## How It Works

```
Claude Desktop (stdio) ←→ MCP Client (this) ←→ Chargily Server (HTTP + Bearer Auth)
```

This client solves two problems:
1. Claude Desktop uses stdio transport, our server uses HTTP
2. Claude Desktop's mcp-remote expects OAuth, we use Bearer tokens

## Usage

### With Claude Desktop

Add to `claude_desktop_config.json`:

**Windows (WSL server):**
```json
{
  "mcpServers": {
    "chargily": {
      "command": "node",
      "args": [
        "\\\\wsl.localhost\\Ubuntu\\home\\karaodin\\chargily-mcp\\packages\\mcp-client\\index.js",
        "http://localhost:3000/mcp",
        "your_access_token_here"
      ]
    }
  }
}
```

**Linux/macOS:**
```json
{
  "mcpServers": {
    "chargily": {
      "command": "node",
      "args": [
        "/home/karaodin/chargily-mcp/packages/mcp-client/index.js",
        "http://localhost:3000/mcp",
        "your_access_token_here"
      ]
    }
  }
}
```

### Standalone Testing

```bash
# Set environment variables
export MCP_SERVER_URL="http://localhost:3000/mcp"
export MCP_TOKEN="your_token_here"

# Run client
node index.js

# Or pass as arguments
node index.js http://localhost:3000/mcp your_token_here
```

## Arguments

1. **Server URL**: HTTP endpoint of Chargily MCP server (default: `http://localhost:3000/mcp`)
2. **Access Token**: Bearer token for authentication

## Environment Variables

- `MCP_SERVER_URL`: Server URL (alternative to arg 1)
- `MCP_TOKEN`: Access token (alternative to arg 2)

## Error Handling

All errors are logged to stderr and returned as JSON-RPC error responses:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Error description"
  },
  "id": null
}
```

## Protocol

Uses JSON-RPC 2.0 over stdio (newline-delimited JSON).
