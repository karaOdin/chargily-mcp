/**
 * API Client for Chargily MCP Platform
 */

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// API Methods
export const apiClient = {
  // Auth
  auth: {
    signup: (data: { email: string; password: string; name?: string }) =>
      api.post('/api/v1/auth/signup', data),
    login: (data: { email: string; password: string }) =>
      api.post('/api/v1/auth/login', data),
    verify: () => api.get('/api/v1/auth/verify'),
    me: () => api.get('/api/v1/auth/me'),
    updateProfile: (data: { chargilyApiKey?: string; chargilyMode?: string; name?: string }) =>
      api.patch('/api/v1/auth/me', data),
    generateApiKey: (data: { name: string; scopes: string[]; expiresIn?: number }) =>
      api.post('/api/v1/auth/api-keys', data),
    listApiKeys: () => api.get('/api/v1/auth/api-keys'),
    revokeApiKey: (id: string) => api.delete(`/api/v1/auth/api-keys/${id}`),
  },

  // Webhooks
  webhooks: {
    list: (params?: { eventType?: string; processed?: boolean; limit?: number; offset?: number }) =>
      api.get('/api/v1/webhooks/logs', { params }),
    stats: () => api.get('/api/v1/webhooks/stats'),
    retry: () => api.post('/api/v1/webhooks/retry'),
  },

  // Approvals
  approvals: {
    listPending: (params?: { skip?: number; take?: number }) =>
      api.get('/api/v1/approvals/pending', { params }),
    approve: (id: string, reason?: string) =>
      api.post(`/api/v1/approvals/${id}/approve`, { reason }),
    reject: (id: string, reason: string) =>
      api.post(`/api/v1/approvals/${id}/reject`, { reason }),
    stats: () => api.get('/api/v1/approvals/stats'),
  },

  // MCP
  mcp: {
    listTools: () => api.post('/mcp/tools/list'),
    callTool: (name: string, args: any) => api.post('/mcp/tools/call', { name, arguments: args }),
    listResources: () => api.post('/mcp/resources/list'),
    readResource: (uri: string) => api.post('/mcp/resources/read', { uri }),
    listPrompts: () => api.post('/mcp/prompts/list'),
    getPrompt: (name: string, args?: any) =>
      api.post('/mcp/prompts/get', { name, arguments: args }),
  },

  // Chargily
  chargily: {
    getBalance: () => api.get('/api/v1/chargily/balance'),
    listCustomers: (params?: any) => api.get('/api/v1/chargily/customers', { params }),
    listCheckouts: (params?: any) => api.get('/api/v1/chargily/checkouts', { params }),
    listProducts: (params?: any) => api.get('/api/v1/chargily/products', { params }),
  },
};
