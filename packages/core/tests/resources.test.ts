/**
 * MCP Resources Tests
 */

import { describe, it, expect } from 'vitest';
import { RESOURCES } from '../src/resources';

describe('MCP Resources', () => {
  it('should have 14 resources defined', () => {
    expect(RESOURCES).toHaveLength(14);
  });

  it('all resources should have required properties', () => {
    RESOURCES.forEach((resource) => {
      expect(resource).toHaveProperty('uriPattern');
      expect(resource).toHaveProperty('description');
      expect(resource).toHaveProperty('scopes');
      expect(resource).toHaveProperty('freshness');
      expect(resource).toHaveProperty('handler');
      expect(typeof resource.handler).toBe('function');
    });
  });

  it('all resources should have valid URI patterns', () => {
    RESOURCES.forEach((resource) => {
      expect(resource.uriPattern).toBeInstanceOf(RegExp);
      // Should match chargily:// scheme
      expect(resource.uriPattern.source).toMatch(/^chargily:/);
    });
  });

  it('all resources should have positive freshness values', () => {
    RESOURCES.forEach((resource) => {
      expect(resource.freshness).toBeGreaterThanOrEqual(0);
    });
  });

  it('should have correct URI patterns for known resources', () => {
    const balanceResource = RESOURCES.find((r) =>
      r.uriPattern.test('chargily://balance/current')
    );
    expect(balanceResource).toBeDefined();
    expect(balanceResource?.description).toContain('balance');

    const transactionResource = RESOURCES.find((r) =>
      r.uriPattern.test('chargily://transactions/checkout_123')
    );
    expect(transactionResource).toBeDefined();
  });

  describe('resource freshness', () => {
    it('balance should have 30s freshness', () => {
      const balance = RESOURCES.find((r) =>
        r.uriPattern.test('chargily://balance/current')
      );
      expect(balance?.freshness).toBe(30);
    });

    it('immutable resources should have Infinity freshness', () => {
      const transaction = RESOURCES.find((r) =>
        r.uriPattern.test('chargily://transactions/checkout_123')
      );
      expect(transaction?.freshness).toBe(Infinity);
    });
  });
});
