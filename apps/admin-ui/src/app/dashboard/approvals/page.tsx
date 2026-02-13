'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export default function ApprovalsPage() {
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => apiClient.approvals.listPending(),
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.approvals.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Request approved successfully');
    },
    onError: () => {
      toast.error('Failed to approve request');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.approvals.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setRejectingId(null);
      setRejectReason('');
      toast.success('Request rejected');
    },
    onError: () => {
      toast.error('Failed to reject request');
    },
  });

  const approvals = data?.data?.approvals || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Approval Queue</h1>
        <p className="text-muted-foreground">
          Review and approve pending high-value transactions
        </p>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
            Loading approvals...
          </div>
        ) : approvals.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
            No pending approvals
          </div>
        ) : (
          approvals.map((approval: any) => (
            <div key={approval.id} className="rounded-lg border bg-card p-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{approval.action}</h3>
                  <p className="text-sm text-muted-foreground">
                    Requested by {approval.user.name || approval.user.email}
                  </p>
                </div>
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                  {approval.tier.toUpperCase()}
                </span>
              </div>

              <div className="mb-4 grid gap-2 rounded-lg bg-muted p-4 text-sm">
                {Object.entries(approval.input).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="font-medium">
                      {typeof value === 'number' && key.includes('amount')
                        ? formatCurrency(value as number)
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mb-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Created {formatDate(approval.createdAt)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    Expires {formatDate(approval.expiresAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {approval.approvals.length} / {approval.requiredApprovers} approvals
                  </span>
                </div>
              </div>

              {rejectingId === approval.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (required)"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => rejectMutation.mutate({ id: approval.id, reason: rejectReason })}
                      disabled={!rejectReason || rejectMutation.isPending}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason('');
                      }}
                      className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate(approval.id)}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectingId(approval.id)}
                    className="flex items-center gap-2 rounded-lg border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
