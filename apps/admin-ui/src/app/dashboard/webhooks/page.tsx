'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function WebhooksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => apiClient.webhooks.list({ limit: 100 }),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const webhooks = data?.data?.webhooks || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhook Logs</h1>
          <p className="text-muted-foreground">
            Monitor incoming webhook events from Chargily
          </p>
        </div>
        <button
          onClick={() => apiClient.webhooks.retry()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Retry Failed
        </button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium">Event Type</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Event ID</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Verified</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Retries</th>
                <th className="px-6 py-3 text-left text-sm font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    Loading webhooks...
                  </td>
                </tr>
              ) : webhooks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No webhooks found
                  </td>
                </tr>
              ) : (
                webhooks.map((webhook: any) => (
                  <tr key={webhook.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium">
                      {webhook.eventType}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                      {webhook.eventId.substring(0, 16)}...
                    </td>
                    <td className="px-6 py-4">
                      {webhook.processed ? (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Processed
                        </div>
                      ) : webhook.error ? (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <XCircle className="h-4 w-4" />
                          Failed
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-yellow-600">
                          <Clock className="h-4 w-4" />
                          Pending
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {webhook.verified ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          Verified
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">{webhook.retryCount}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDate(webhook.createdAt)}
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
