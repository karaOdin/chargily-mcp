'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Wallet } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => apiClient.auth.login({ email, password }),
    onSuccess: (response) => {
      localStorage.setItem('auth_token', response.data.accessToken);
      router.push('/dashboard');
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Login failed');
    },
  });

  const signupMutation = useMutation({
    mutationFn: () => apiClient.auth.signup({ email, password, name }),
    onSuccess: (response) => {
      localStorage.setItem('auth_token', response.data.accessToken);
      router.push('/dashboard');
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Signup failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSignup) {
      signupMutation.mutate();
    } else {
      loginMutation.mutate();
    }
  };

  const isLoading = loginMutation.isLoading || signupMutation.isLoading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Chargily MCP</h1>
          <p className="text-gray-600 mt-2">
            Connect AI assistants to Chargily Pay
          </p>
        </div>

        <div className="rounded-lg border bg-white p-8 shadow-lg">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              {isSignup ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {isSignup
                ? 'Sign up to get started with MCP'
                : 'Sign in to your account'}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required={isSignup}
                />
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
              {isSignup && (
                <p className="text-xs text-gray-500 mt-1">
                  At least 8 characters
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignup ? 'Creating account...' : 'Signing in...'}
                </>
              ) : (
                <>{isSignup ? 'Sign Up' : 'Sign In'}</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
              }}
              className="text-sm text-blue-600 hover:underline"
            >
              {isSignup
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          By continuing, you agree to Chargily MCP's Terms of Service and Privacy
          Policy
        </p>
      </div>
    </div>
  );
}
