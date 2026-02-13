# Windows + WSL Claude Desktop Setup

## The Problem

- Server runs in WSL (Linux)
- Claude Desktop runs on Windows
- `mcp-remote` expects OAuth, we use Bearer tokens
- Direct HTTP connection doesn't work

## The Solution

Use a local bridge script that runs on Windows.

---

## Setup Steps

### 1. **Create Windows Bridge Script**

Create `chargily-bridge.js` on Windows (e.g., `C:\Users\YourName\chargily-bridge.js`):

```javascript
const http = require('http');
const readline = require('readline');

const SERVER_URL = process.argv[2] || 'http://localhost:3000/mcp';
const TOKEN = process.argv[3];

if (!TOKEN) {
  console.error('Usage: node chargily-bridge.js <server_url> <token>');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line.trim()) return;

  try {
    const request = JSON.parse(line);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    };

    const req = http.request(SERVER_URL, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(data);
      });
    });

    req.on('error', (error) => {
      console.error(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: error.message },
        id: request.id || null
      }));
    });

    req.write(JSON.stringify(request));
    req.end();

  } catch (error) {
    console.error(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' },
      id: null
    }));
  }
});
```

### 2. **Configure Claude Desktop**

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chargily": {
      "command": "node",
      "args": [
        "C:\\Users\\YourName\\chargily-bridge.js",
        "http://localhost:3000/mcp",
        "YOUR_ACCESS_TOKEN_HERE"
      ]
    }
  }
}
```

### 3. **Get Your Access Token**

Open PowerShell on Windows:

```powershell
$body = @{
    email = "test@chargily.com"
    password = "test123456"
} | ConvertTo-Json

$response = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/auth/login" -Body $body -ContentType "application/json"

Write-Host $response.accessToken
```

Or use `curl` in WSL and copy the token:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@chargily.com","password":"test123456"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4
```

### 4. **Restart Claude Desktop**

Completely quit and restart Claude Desktop.

### 5. **Test Integration**

In Claude Desktop, try:
- "Check my Chargily balance"
- "List my customers"
- "Create a checkout for 10,000 DZD"

---

## Troubleshooting

### Server not accessible from Windows

Test if port 3000 is accessible:

```powershell
# In PowerShell
Test-NetConnection -ComputerName localhost -Port 3000
```

If connection fails, ensure WSL2 port forwarding is enabled:

```powershell
# Add firewall rule (run as Admin)
New-NetFirewallRule -DisplayName "WSL Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### Token expired

Tokens expire after 1 hour. Get a new token using the login command above.

### MCP server not showing in Claude

1. Check `claude_desktop_config.json` syntax (must be valid JSON)
2. Ensure paths use double backslashes (`\\`)
3. Check Windows Event Viewer for Node.js errors
4. Restart Claude Desktop completely (check Task Manager)

---

## Alternative: Direct HTTP (Advanced)

If you want to expose the server directly without the bridge:

1. **Server Side:** Already bound to `0.0.0.0:3000` ✅
2. **Windows Side:** Access via `http://localhost:3000` ✅
3. **Issue:** `mcp-remote` wants OAuth, we use Bearer tokens ❌

The bridge script solves this incompatibility.

---

## For Linux/macOS Users

No bridge needed! Use the direct stdio client:

```json
{
  "mcpServers": {
    "chargily": {
      "command": "node",
      "args": [
        "/home/karaodin/chargily-mcp/packages/mcp-client/index.js",
        "http://localhost:3000/mcp",
        "YOUR_TOKEN_HERE"
      ]
    }
  }
}
```
