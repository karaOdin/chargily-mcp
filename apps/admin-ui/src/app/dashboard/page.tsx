'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { CreditCard, Key, Settings, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => apiClient.auth.me(),
  });

  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: () => apiClient.chargily.getBalance(),
    enabled: !!user?.data?.hasChargilyKey,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to Chargily MCP Platform
        </p>
      </div>

      {/* Chargily Setup Status */}
      {!user?.data?.hasChargilyKey && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <div className="flex items-center gap-3">
            <Wallet className="h-6 w-6 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-900">Set up your Chargily account</h3>
              <p className="text-sm text-yellow-700">
                Connect your Chargily Pay account to start using MCP tools with AI assistants.
              </p>
              <a
                href="/dashboard/settings"
                className="mt-2 inline-flex items-center text-sm font-medium text-yellow-900 hover:underline"
              >
                Add Chargily API Key →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Balance Cards */}
      {user?.data?.hasChargilyKey && balance?.data && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Account Balance</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {balance.data.wallets?.map((wallet: any) => (
              <div
                key={wallet.currency}
                className="rounded-lg border bg-card p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase">
                      {wallet.currency}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(wallet.balance, wallet.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ready: {formatCurrency(wallet.ready_for_payout, wallet.currency)}
                    </p>
                  </div>
                  <div className="rounded-full bg-blue-100 p-3">
                    <CreditCard className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <a
            href="/dashboard/api-keys"
            className="rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <Key className="h-5 w-5 mb-2 text-blue-600" />
            <h3 className="font-medium">API Keys</h3>
            <p className="text-sm text-muted-foreground">
              Manage your MCP API keys
            </p>
          </a>
          <a
            href="/dashboard/settings"
            className="rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <Settings className="h-5 w-5 mb-2 text-green-600" />
            <h3 className="font-medium">Settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure Chargily integration
            </p>
          </a>
          <a
            href="https://docs.chargily.com/pay"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <Wallet className="h-5 w-5 mb-2 text-purple-600" />
            <h3 className="font-medium">Documentation</h3>
            <p className="text-sm text-muted-foreground">
              Learn about Chargily Pay
            </p>
          </a>
        </div>
      </div>

      {/* Mode Indicator */}
      {user?.data && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${user.data.chargilyMode === 'sandbox' ? 'bg-yellow-500' : 'bg-green-500'}`} />
              <span className="text-sm font-medium">
                {user.data.chargilyMode === 'sandbox' ? 'Sandbox Mode' : 'Production Mode'}
              </span>
            </div>
            <a
              href="/dashboard/settings"
              className="text-sm text-muted-foreground hover:underline"
            >
              Change mode
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
