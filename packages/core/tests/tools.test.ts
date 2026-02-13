/**
 * MCP Tools Tests
 */

import { describe, it, expect } from 'vitest';
import { TOOLS, getTool } from '../src/tools';

describe('MCP Tools', () => {
  describe('TOOLS array', () => {
    it('should have 25 tools defined', () => {
      expect(TOOLS).toHaveLength(25);
    });

    it('should have unique tool names', () => {
      const names = TOOLS.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('all tools should have required properties', () => {
      TOOLS.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('scopes');
        expect(tool).toHaveProperty('approvalTier');
        expect(tool).toHaveProperty('rateLimit');
        expect(tool).toHaveProperty('handler');
        expect(typeof tool.handler).toBe('function');
      });
    });

    it('all tools should have valid approval tiers', () => {
      const validTiers = ['none', 'tier1', 'tier2', 'tier3'];
      TOOLS.forEach((tool) => {
        expect(validTiers).toContain(tool.approvalTier);
      });
    });

    it('all tools should have positive rate limits', () => {
      TOOLS.forEach((tool) => {
        expect(tool.rateLimit).toBeGreaterThan(0);
      });
    });
  });

  describe('getTool', () => {
    it('should find existing tool', () => {
      const tool = getTool('get_balance');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_balance');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = getTool('nonexistent_tool');
      expect(tool).toBeUndefined();
    });
  });

  describe('tool scopes', () => {
    it('read tools should have :read scope', () => {
      const readTools = ['get_balance', 'get_customer', 'list_customers'];
      readTools.forEach((toolName) => {
        const tool = getTool(toolName);
        expect(tool?.scopes.some((s) => s.endsWith(':read'))).toBe(true);
      });
    });

    it('write tools should have :write or :create scope', () => {
      const writeTools = ['create_customer', 'update_customer', 'create_product'];
      writeTools.forEach((toolName) => {
        const tool = getTool(toolName);
        const hasWriteScope = tool?.scopes.some((s) =>
          s.endsWith(':write') || s.endsWith(':create')
        );
        expect(hasWriteScope).toBe(true);
      });
    });
  });
});
