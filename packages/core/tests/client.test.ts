/**
 * ChargilyClient Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChargilyClient } from '../src/client';

describe('ChargilyClient', () => {
  let client: ChargilyClient;

  beforeEach(() => {
    client = new ChargilyClient({
      apiKey: 'test_sk_123',
      mode: 'sandbox',
    });
  });

  describe('constructor', () => {
    it('should set sandbox URL in sandbox mode', () => {
      const sandboxClient = new ChargilyClient({
        apiKey: 'test_sk_123',
        mode: 'sandbox',
      });

      expect(sandboxClient['baseUrl']).toBe('https://pay.chargily.net/test/api/v2');
    });

    it('should set production URL in production mode', () => {
      const prodClient = new ChargilyClient({
        apiKey: 'live_sk_123',
        mode: 'production',
      });

      expect(prodClient['baseUrl']).toBe('https://pay.chargily.net/api/v2');
    });

    it('should set custom timeout if provided', () => {
      const customClient = new ChargilyClient({
        apiKey: 'test_sk_123',
        mode: 'sandbox',
        timeout: 60000,
      });

      expect(customClient['timeout']).toBe(60000);
    });
  });

  describe('error handling', () => {
    it('should map 401 status to authentication error', async () => {
      // Mock fetch to return 401
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      }) as any;

      await expect(client.getBalance()).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const timeoutClient = new ChargilyClient({
        apiKey: 'test_sk_123',
        mode: 'sandbox',
        timeout: 1, // 1ms timeout
      });

      // Mock a slow response
      global.fetch = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      ) as any;

      await expect(timeoutClient.getBalance()).rejects.toThrow('timeout');
    });
  });
});
