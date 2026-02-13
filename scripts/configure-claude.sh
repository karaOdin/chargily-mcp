#!/bin/bash
# Chargily MCP - Claude Desktop Setup Tool

echo "🔧 Chargily MCP - Claude Desktop Setup"
echo ""

# Get credentials
read -p "Enter your email: " email
read -sp "Enter your password: " password
echo ""

# Login and get token
echo "Logging in..."
response=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"password\":\"$password\"}")

token=$(echo $response | python3 -c "import sys, json; print(json.load(sys.stdin).get('accessToken', ''))" 2>/dev/null)

if [ -z "$token" ]; then
  echo "❌ Login failed. Please check your credentials."
  exit 1
fi

echo "✅ Login successful!"

# Detect OS and set config path
if [[ "$OSTYPE" == "darwin"* ]]; then
  CONFIG_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CONFIG_DIR="$HOME/.config/Claude"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  CONFIG_DIR="$APPDATA/Claude"
else
  echo "❌ Unsupported OS"
  exit 1
fi

CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

# Create directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Create or update config
echo "📝 Configuring Claude Desktop..."

cat > "$CONFIG_FILE" <<EOF
{
  "mcpServers": {
    "chargily": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000/mcp",
        "headers": {
          "Authorization": "Bearer $token"
        }
      }
    }
  }
}
EOF

echo "✅ Configuration saved to: $CONFIG_FILE"
echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Restart Claude Desktop"
echo "2. You should see 'Chargily' in the MCP servers list"
echo "3. Start chatting! Try: 'Check my Chargily balance'"
echo ""
