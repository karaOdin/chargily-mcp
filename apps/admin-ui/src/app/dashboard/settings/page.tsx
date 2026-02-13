'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [mode, setMode] = useState<'sandbox' | 'production'>('sandbox');
  const [name, setName] = useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => apiClient.auth.me(),
    onSuccess: (data) => {
      if (data?.data) {
        setMode(data.data.chargilyMode || 'sandbox');
        setName(data.data.name || '');
      }
    },
  });

  const updateSettings = useMutation({
    mutationFn: (data: { chargilyApiKey?: string; chargilyMode?: string; name?: string }) =>
      apiClient.auth.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['user']);
      queryClient.invalidateQueries(['balance']);
      setApiKey(''); // Clear the input after successful update
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate({
      chargilyApiKey: apiKey || undefined,
      chargilyMode: mode,
      name: name || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and Chargily integration
        </p>
      </div>

      {updateSettings.isSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-900">
            Settings updated successfully!
          </AlertDescription>
        </Alert>
      )}

      {updateSettings.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to update settings. Please try again.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Settings */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Profile</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.data?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed
              </p>
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>
        </div>

        {/* Chargily Integration */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Chargily Integration</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mode">Mode</Label>
              <RadioGroup value={mode} onValueChange={(value) => setMode(value as 'sandbox' | 'production')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sandbox" id="sandbox" />
                  <Label htmlFor="sandbox" className="font-normal cursor-pointer">
                    Sandbox (Testing)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="production" id="production" />
                  <Label htmlFor="production" className="font-normal cursor-pointer">
                    Production (Live)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground mt-1">
                Use sandbox mode for testing, production for real transactions
              </p>
            </div>

            <div>
              <Label htmlFor="apiKey">Chargily API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={user?.data?.hasChargilyKey ? '••••••••••••••••' : 'test_sk_...'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Get your API key from{' '}
                <a
                  href="https://pay.chargily.com/test/dashboard/settings/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Chargily Dashboard
                </a>
              </p>
              {user?.data?.hasChargilyKey && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  API key configured
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateSettings.isLoading}
            className="min-w-[120px]"
          >
            {updateSettings.isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </form>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="font-semibold text-blue-900 mb-2">How to get your API Key</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Go to your Chargily Pay dashboard</li>
          <li>Navigate to Settings → API Keys</li>
          <li>Create a new API key or copy an existing one</li>
          <li>Use test keys (test_sk_...) for sandbox mode</li>
          <li>Use live keys (live_sk_...) for production mode</li>
        </ol>
      </div>
    </div>
  );
}
