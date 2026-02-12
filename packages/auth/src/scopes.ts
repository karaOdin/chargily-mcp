/**
 * Scope management and validation
 */

import { AuthError } from './types';

export const SCOPES = {
  // Balance
  BALANCE_READ: 'balance:read',

  // Customers
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  CUSTOMERS_DELETE: 'customers:delete',

  // Products
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  PRODUCTS_DELETE: 'products:delete',

  // Prices
  PRICES_READ: 'prices:read',
  PRICES_WRITE: 'prices:write',

  // Checkouts
  CHECKOUTS_READ: 'checkouts:read',
  CHECKOUTS_CREATE: 'checkouts:create',
  CHECKOUTS_CANCEL: 'checkouts:cancel',
  CHECKOUTS_EXPIRE: 'checkouts:expire',

  // Payment Links
  PAYMENT_LINKS_READ: 'payment_links:read',
  PAYMENT_LINKS_CREATE: 'payment_links:create',
  PAYMENT_LINKS_WRITE: 'payment_links:write',

  // Webhooks
  WEBHOOKS_READ: 'webhooks:read',
  WEBHOOKS_CONFIGURE: 'webhooks:configure',

  // Reports
  REPORTS_READ: 'reports:read',

  // Analytics
  ANALYTICS_READ: 'analytics:read',

  // Settlements
  SETTLEMENTS_READ: 'settlements:read',

  // Admin
  ADMIN: 'admin',
} as const;

export type Scope = typeof SCOPES[keyof typeof SCOPES];

/**
 * Scope hierarchy for wildcard matching
 */
const SCOPE_HIERARCHY: Record<string, string[]> = {
  'admin': Object.values(SCOPES),
  'customers:*': [
    SCOPES.CUSTOMERS_READ,
    SCOPES.CUSTOMERS_WRITE,
    SCOPES.CUSTOMERS_DELETE,
  ],
  'products:*': [
    SCOPES.PRODUCTS_READ,
    SCOPES.PRODUCTS_WRITE,
    SCOPES.PRODUCTS_DELETE,
  ],
  'checkouts:*': [
    SCOPES.CHECKOUTS_READ,
    SCOPES.CHECKOUTS_CREATE,
    SCOPES.CHECKOUTS_CANCEL,
    SCOPES.CHECKOUTS_EXPIRE,
  ],
};

export class ScopeManager {
  /**
   * Check if user has required scopes
   */
  hasScopes(userScopes: string[], requiredScopes: string[]): boolean {
    const expandedUserScopes = this.expandScopes(userScopes);

    return requiredScopes.every((required) =>
      expandedUserScopes.includes(required)
    );
  }

  /**
   * Require scopes or throw error
   */
  requireScopes(userScopes: string[], requiredScopes: string[]): void {
    if (!this.hasScopes(userScopes, requiredScopes)) {
      throw new AuthError(
        `Missing required scopes: ${requiredScopes.join(', ')}`,
        'insufficient_scope',
        403
      );
    }
  }

  /**
   * Expand wildcard scopes
   */
  expandScopes(scopes: string[]): string[] {
    const expanded = new Set<string>();

    for (const scope of scopes) {
      if (SCOPE_HIERARCHY[scope]) {
        SCOPE_HIERARCHY[scope].forEach((s) => expanded.add(s));
      } else {
        expanded.add(scope);
      }
    }

    return Array.from(expanded);
  }

  /**
   * Validate scope format
   */
  validateScope(scope: string): boolean {
    const pattern = /^[a-z_]+:[a-z_*]+$/;
    return pattern.test(scope) || scope === 'admin';
  }

  /**
   * Get all available scopes
   */
  getAllScopes(): string[] {
    return Object.values(SCOPES);
  }

  /**
   * Group scopes by resource
   */
  groupByResource(scopes: string[]): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};

    for (const scope of scopes) {
      const [resource] = scope.split(':');
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(scope);
    }

    return grouped;
  }
}
