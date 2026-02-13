'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Key, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function ApiKeysPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    scopes: ['balance:read', 'customers:*', 'checkouts:*'],
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiClient.auth.listApiKeys(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.auth.generateApiKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setShowCreateForm(false);
      setFormData({ name: '', scopes: ['balance:read', 'customers:*', 'checkouts:*'] });
      toast.success('API key created successfully');
    },
    onError: () => {
      toast.error('Failed to create API key');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiClient.auth.revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key revoked');
    },
    onError: () => {
      toast.error('Failed to revoke API key');
    },
  });

  const apiKeys = data?.data?.apiKeys || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for accessing Chargily MCP Platform
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create API Key
        </button>
      </div>

      {showCreateForm && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Create New API Key</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Key Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="My API Key"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium">API Key</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Last Used</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Created</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    Loading API keys...
                  </td>
                </tr>
              ) : apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No API keys found. Create one to get started.
                  </td>
                </tr>
              ) : (
                apiKeys.map((key: any) => (
                  <tr key={key.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium">{key.name}</td>
                    <td className="px-6 py-4">
                      <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                        {key.key}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      {key.isActive ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDate(key.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      {key.isActive && (
                        <button
                          onClick={() => revokeMutation.mutate(key.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
