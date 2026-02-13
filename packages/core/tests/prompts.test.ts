/**
 * MCP Prompts Tests
 */

import { describe, it, expect } from 'vitest';
import { PROMPTS } from '../src/prompts';

describe('MCP Prompts', () => {
  it('should have 10 prompts defined', () => {
    expect(PROMPTS).toHaveLength(10);
  });

  it('all prompts should have required properties', () => {
    PROMPTS.forEach((prompt) => {
      expect(prompt).toHaveProperty('name');
      expect(prompt).toHaveProperty('description');
      expect(prompt).toHaveProperty('arguments');
      expect(prompt).toHaveProperty('template');
      expect(typeof prompt.template).toBe('string');
    });
  });

  it('all prompt arguments should have proper config', () => {
    PROMPTS.forEach((prompt) => {
      Object.entries(prompt.arguments).forEach(([argName, config]) => {
        expect(config).toHaveProperty('type');
        expect(config).toHaveProperty('required');
        expect(typeof config.type).toBe('string');
        expect(typeof config.required).toBe('boolean');
      });
    });
  });

  it('all prompts should have non-empty templates', () => {
    PROMPTS.forEach((prompt) => {
      expect(prompt.template.length).toBeGreaterThan(0);
    });
  });

  it('templates should use {{argument}} placeholders correctly', () => {
    PROMPTS.forEach((prompt) => {
      // Check that template uses arguments defined in config
      Object.keys(prompt.arguments).forEach((argName) => {
        if (prompt.arguments[argName].required) {
          // Required arguments should appear in template
          expect(prompt.template).toMatch(new RegExp(`\\{\\{\\s*${argName}\\s*\\}\\}`));
        }
      });
    });
  });

  describe('specific prompts', () => {
    it('investigate_failed_payment should have checkout_id argument', () => {
      const prompt = PROMPTS.find((p) => p.name === 'investigate_failed_payment');
      expect(prompt).toBeDefined();
      expect(prompt?.arguments.checkout_id).toBeDefined();
      expect(prompt?.arguments.checkout_id.required).toBe(true);
    });

    it('daily_finance_summary should have date argument', () => {
      const prompt = PROMPTS.find((p) => p.name === 'daily_finance_summary');
      expect(prompt).toBeDefined();
      expect(prompt?.arguments.date).toBeDefined();
    });

    it('customer_support_helper should have issue_type argument', () => {
      const prompt = PROMPTS.find((p) => p.name === 'customer_support_helper');
      expect(prompt).toBeDefined();
      expect(prompt?.arguments.issue_type).toBeDefined();
      expect(prompt?.arguments.issue_type.required).toBe(true);
    });
  });
});
