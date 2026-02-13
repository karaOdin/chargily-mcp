'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Copy, Download } from 'lucide-react';

export default function ClaudeSetupPage() {
  const [copied, setCopied] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => apiClient.auth.me(),
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '';

  // Detect OS for proper path format
  const isWindows = typeof window !== 'undefined' && navigator.platform.toLowerCase().includes('win');

  const config = isWindows ? {
    mcpServers: {
      chargily: {
        command: 'node',
        args: [
          '\\\\wsl.localhost\\Ubuntu\\home\\karaodin\\chargily-mcp\\packages\\mcp-client\\index.js',
          'http://localhost:3000/mcp',
          token || 'YOUR_TOKEN_HERE',
        ],
      },
    },
  } : {
    mcpServers: {
      chargily: {
        command: 'node',
        args: [
          '/home/karaodin/chargily-mcp/packages/mcp-client/index.js',
          'http://localhost:3000/mcp',
          token || 'YOUR_TOKEN_HERE',
        ],
      },
    },
  };

  const configJson = JSON.stringify(config, null, 2);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(configJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadConfig = () => {
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'claude_desktop_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getConfigPath = (os: 'mac' | 'windows' | 'linux') => {
    const paths = {
      mac: '~/Library/Application Support/Claude/claude_desktop_config.json',
      windows: '%APPDATA%\\Claude\\claude_desktop_config.json',
      linux: '~/.config/Claude/claude_desktop_config.json',
    };
    return paths[os];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Claude Desktop Setup</h1>
        <p className="text-muted-foreground">
          Connect your Chargily account to Claude Desktop
        </p>
      </div>

      {!user?.data?.hasChargilyKey && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertDescription className="text-yellow-900">
            ⚠️ You need to configure your Chargily API key first.{' '}
            <a href="/dashboard/settings" className="underline">
              Go to Settings
            </a>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Setup Instructions</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Step 1: Locate Config File</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium w-24">macOS:</span>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  {getConfigPath('mac')}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium w-24">Windows:</span>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  {getConfigPath('windows')}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium w-24">Linux:</span>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  {getConfigPath('linux')}
                </code>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Step 2: Copy Configuration</h3>
            <div className="relative">
              <pre className="bg-muted p-4 rounded overflow-x-auto text-xs">
                {configJson}
              </pre>
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="bg-background"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadConfig}
                  className="bg-background"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Step 3: Restart Claude Desktop</h3>
            <p className="text-sm text-muted-foreground">
              Completely quit and restart Claude Desktop app
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Step 4: Test Integration</h3>
            <p className="text-sm text-muted-foreground mb-2">
              In Claude Desktop, try these commands:
            </p>
            <div className="bg-muted p-3 rounded space-y-1 text-sm">
              <div>💬 "Check my Chargily balance"</div>
              <div>💬 "List my recent customers"</div>
              <div>💬 "Create a checkout for 10,000 DZD"</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Quick Start Guide</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Download or copy the configuration above</li>
          <li>Paste it into your Claude Desktop config file</li>
          <li>Restart Claude Desktop</li>
          <li>Look for "Chargily" in the MCP servers list</li>
          <li>Start chatting with Claude about your Chargily account!</li>
        </ol>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-2">Available Commands</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="border rounded p-3">
            <div className="font-medium mb-1">💰 Balance</div>
            <div className="text-muted-foreground text-xs">
              "What's my balance?"
            </div>
          </div>
          <div className="border rounded p-3">
            <div className="font-medium mb-1">👥 Customers</div>
            <div className="text-muted-foreground text-xs">
              "Create a customer named..."
            </div>
          </div>
          <div className="border rounded p-3">
            <div className="font-medium mb-1">💳 Checkouts</div>
            <div className="text-muted-foreground text-xs">
              "Create a checkout for X DZD"
            </div>
          </div>
          <div className="border rounded p-3">
            <div className="font-medium mb-1">📦 Products</div>
            <div className="text-muted-foreground text-xs">
              "List all my products"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
