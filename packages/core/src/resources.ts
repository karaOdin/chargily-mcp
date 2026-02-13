/**
 * MCP Resource definitions
 * Resources provide read-only access to data via URI-based addressing
 */

import type { ChargilyClient } from './client';

export interface ResourceDefinition {
  uriPattern: RegExp;
  description: string;
  scopes: string[];
  freshness: number; // TTL in seconds
  handler: (client: ChargilyClient, uri: string, params: Record<string, string>) => Promise<any>;
}

export const RESOURCES: ResourceDefinition[] = [
  // ===== 1. Balance Resources =====
  {
    uriPattern: /^chargily:\/\/balance\/current$/,
    description: 'Current account balance across all wallets',
    scopes: ['balance:read'],
    freshness: 30,
    handler: async (client) => {
      const balance = await client.getBalance();
      return {
        uri: 'chargily://balance/current',
        mimeType: 'application/json',
        content: balance,
      };
    },
  },

  // ===== 2. Transaction Resources =====
  {
    uriPattern: /^chargily:\/\/transactions\/([a-z0-9_]+)$/,
    description: 'Single transaction details',
    scopes: ['checkouts:read'],
    freshness: Infinity, // Immutable
    handler: async (client, uri, params) => {
      const checkoutId = params.param0;
      const checkout = await client.getCheckout(checkoutId);
      return {
        uri,
        mimeType: 'application/json',
        content: {
          id: checkout.id,
          type: 'checkout',
          status: checkout.status,
          amount: checkout.amount,
          currency: checkout.currency,
          fees: checkout.fees,
          customer_id: checkout.customer_id,
          payment_method: checkout.payment_method,
          created_at: checkout.created_at,
          metadata: checkout.metadata,
        },
      };
    },
  },

  {
    uriPattern: /^chargily:\/\/transactions\/recent$/,
    description: 'Most recent transactions (last 100)',
    scopes: ['checkouts:read'],
    freshness: 10,
    handler: async (client, uri) => {
      // Parse query params from URI (if any)
      const urlObj = new URL(uri.replace('chargily://', 'http://dummy/'));
      const limit = parseInt(urlObj.searchParams.get('limit') || '100');
      const status = urlObj.searchParams.get('status') as any;
      const payment_method = urlObj.searchParams.get('payment_method') as any;

      const response = await client.listCheckouts({
        per_page: Math.min(limit, 100),
        status,
        payment_method,
      });

      return {
        uri,
        mimeType: 'application/json',
        content: {
          transactions: response.data.map((checkout) => ({
            id: checkout.id,
            amount: checkout.amount,
            status: checkout.status,
            payment_method: checkout.payment_method,
            created_at: checkout.created_at,
          })),
          total: response.data.length,
          last_updated: Math.floor(Date.now() / 1000),
        },
      };
    },
  },

  // ===== 3. Customer Resources =====
  {
    uriPattern: /^chargily:\/\/customers\/([a-z0-9_]+)$/,
    description: 'Customer profile and transaction history',
    scopes: ['customers:read'],
    freshness: 60,
    handler: async (client, uri, params) => {
      const customerId = params.param0;
      const customer = await client.getCustomer(customerId);

      // Get recent checkouts for this customer
      const checkouts = await client.listCheckouts({
        customer_id: customerId,
        per_page: 5,
      });

      // Calculate total spent
      const total_spent = checkouts.data
        .filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount, 0);

      return {
        uri,
        mimeType: 'application/json',
        content: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          total_spent,
          transaction_count: checkouts.data.length,
          last_transaction_at: checkouts.data[0]?.created_at,
          created_at: customer.created_at,
          metadata: customer.metadata,
          recent_transactions: checkouts.data.map((c) => ({
            id: c.id,
            amount: c.amount,
            status: c.status,
            created_at: c.created_at,
          })),
        },
      };
    },
  },

  {
    uriPattern: /^chargily:\/\/customers\/top$/,
    description: 'Top customers by spend',
    scopes: ['customers:read', 'checkouts:read'],
    freshness: 300, // 5 minutes
    handler: async (client, uri) => {
      const urlObj = new URL(uri.replace('chargily://', 'http://dummy/'));
      const limit = parseInt(urlObj.searchParams.get('limit') || '10');

      // Get all customers
      const customersResponse = await client.listCustomers({ per_page: 100 });

      // Get spending for each customer
      const customerStats = await Promise.all(
        customersResponse.data.map(async (customer) => {
          const checkouts = await client.listCheckouts({
            customer_id: customer.id,
            per_page: 100,
          });

          const total_spent = checkouts.data
            .filter((c) => c.status === 'paid')
            .reduce((sum, c) => sum + c.amount, 0);

          const transaction_count = checkouts.data.filter((c) => c.status === 'paid').length;

          return {
            id: customer.id,
            name: customer.name,
            total_spent,
            transaction_count,
            average_order_value: transaction_count > 0 ? Math.round(total_spent / transaction_count) : 0,
          };
        })
      );

      // Sort by total_spent descending and take top N
      const topCustomers = customerStats
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, limit);

      return {
        uri,
        mimeType: 'application/json',
        content: {
          customers: topCustomers,
          period: '30d',
          last_updated: Math.floor(Date.now() / 1000),
        },
      };
    },
  },

  // ===== 4. Report Resources =====
  {
    uriPattern: /^chargily:\/\/reports\/daily$/,
    description: 'Daily transaction summary',
    scopes: ['checkouts:read'],
    freshness: 60, // 1 minute
    handler: async (client, uri) => {
      const urlObj = new URL(uri.replace('chargily://', 'http://dummy/'));
      const dateStr = urlObj.searchParams.get('date') || new Date().toISOString().split('T')[0];

      // Get checkouts for today
      const checkouts = await client.listCheckouts({ per_page: 100 });

      // Filter to today's transactions (simplified - in production use proper date filtering)
      const todayCheckouts = checkouts.data.filter((c) => {
        const checkoutDate = new Date(c.created_at * 1000).toISOString().split('T')[0];
        return checkoutDate === dateStr;
      });

      const successful = todayCheckouts.filter((c) => c.status === 'paid');
      const failed = todayCheckouts.filter((c) => c.status === 'failed');
      const canceled = todayCheckouts.filter((c) => c.status === 'canceled');

      const total_amount = successful.reduce((sum, c) => sum + c.amount, 0);
      const total_fees = successful.reduce((sum, c) => sum + (c.fees || 0), 0);

      // Group by payment method
      const by_payment_method: Record<string, { count: number; amount: number }> = {};
      successful.forEach((c) => {
        const method = c.payment_method || 'unknown';
        if (!by_payment_method[method]) {
          by_payment_method[method] = { count: 0, amount: 0 };
        }
        by_payment_method[method].count++;
        by_payment_method[method].amount += c.amount;
      });

      return {
        uri,
        mimeType: 'application/json',
        content: {
          date: dateStr,
          timezone: 'Africa/Algiers',
          summary: {
            total_transactions: todayCheckouts.length,
            successful_payments: successful.length,
            failed_payments: failed.length,
            canceled_checkouts: canceled.length,
            total_amount,
            total_fees,
            net_revenue: total_amount - total_fees,
          },
          by_payment_method,
          last_updated: Math.floor(Date.now() / 1000),
        },
      };
    },
  },

  {
    uriPattern: /^chargily:\/\/reports\/monthly$/,
    description: 'Monthly transaction summary',
    scopes: ['checkouts:read'],
    freshness: 300, // 5 minutes
    handler: async (client, uri) => {
      const urlObj = new URL(uri.replace('chargily://', 'http://dummy/'));
      const monthStr = urlObj.searchParams.get('month') || new Date().toISOString().slice(0, 7);

      // Get checkouts
      const checkouts = await client.listCheckouts({ per_page: 100 });

      // Filter to this month (simplified)
      const monthCheckouts = checkouts.data.filter((c) => {
        const checkoutMonth = new Date(c.created_at * 1000).toISOString().slice(0, 7);
        return checkoutMonth === monthStr;
      });

      const successful = monthCheckouts.filter((c) => c.status === 'paid');
      const total_amount = successful.reduce((sum, c) => sum + c.amount, 0);
      const total_fees = successful.reduce((sum, c) => sum + (c.fees || 0), 0);

      return {
        uri,
        mimeType: 'application/json',
        content: {
          month: monthStr,
          summary: {
            total_transactions: monthCheckouts.length,
            successful_payments: successful.length,
            total_amount,
            total_fees,
            net_revenue: total_amount - total_fees,
            average_transaction_value: successful.length > 0 ? Math.round(total_amount / successful.length) : 0,
            success_rate: monthCheckouts.length > 0 ? (successful.length / monthCheckouts.length) * 100 : 0,
          },
          last_updated: Math.floor(Date.now() / 1000),
        },
      };
    },
  },

  // ===== 5. Webhook Resources =====
  {
    uriPattern: /^chargily:\/\/webhooks\/logs$/,
    description: 'Recent webhook delivery logs',
    scopes: ['webhooks:read'],
    freshness: 10,
    handler: async (_client, uri) => {
      // Note: This would query the database WebhookLog table
      // For now, return empty structure
      return {
        uri,
        mimeType: 'application/json',
        content: {
          logs: [],
          total: 0,
          last_updated: Math.floor(Date.now() / 1000),
          note: 'Webhook logs available via server API: GET /api/v1/webhooks/logs',
        },
      };
    },
  },

  {
    uriPattern: /^chargily:\/\/webhooks\/events\/([a-z0-9_]+)$/,
    description: 'Single webhook event details',
    scopes: ['webhooks:read'],
    freshness: Infinity, // Immutable
    handler: async (_client, uri, params) => {
      const eventId = params.param0;

      return {
        uri,
        mimeType: 'application/json',
        content: {
          id: eventId,
          note: 'Webhook event details available via server API: GET /api/v1/webhooks/logs',
        },
      };
    },
  },

  // ===== 6. Settlement Resources =====
  {
    uriPattern: /^chargily:\/\/settlements\/latest$/,
    description: 'Latest settlement information',
    scopes: ['settlements:read'],
    freshness: 300, // 5 minutes
    handler: async (client, uri) => {
      // Get balance as proxy for settlement info
      const balance = await client.getBalance();

      return {
        uri,
        mimeType: 'application/json',
        content: {
          balance: balance,
          note: 'Settlement details depend on Chargily V2 API settlement endpoints (coming soon)',
          last_updated: Math.floor(Date.now() / 1000),
        },
      };
    },
  },

  {
    uriPattern: /^chargily:\/\/settlements\/history$/,
    description: 'Settlement history',
    scopes: ['settlements:read'],
    freshness: 300, // 5 minutes
    handler: async (_client, uri) => {
      return {
        uri,
        mimeType: 'application/json',
        content: {
          settlements: [],
          note: 'Settlement history depends on Chargily V2 API settlement endpoints (coming soon)',
          last_updated: Math.floor(Date.now() / 1000),
        },
      };
    },
  },

  // ===== 7. Analytics Resources =====
  {
    uriPattern: /^chargily:\/\/analytics\/conversion$/,
    description: 'Conversion rate analytics',
    scopes: ['checkouts:read'],
    freshness: 300, // 5 minutes
    handler: async (client, uri) => {
      const checkouts = await client.listCheckouts({ per_page: 100 });

      const total = checkouts.data.length;
      const paid = checkouts.data.filter((c) => c.status === 'paid').length;
      const failed = checkouts.data.filter((c) => c.status === 'failed').length;
      const canceled = checkouts.data.filter((c) => c.status === 'canceled').length;
      const pending = checkouts.data.filter((c) => c.status === 'pending').length;

      return {
        uri,
        mimeType: 'application/json',
        content: {
          summary: {
            total_checkouts: total,
            successful_payments: paid,
            failed_payments: failed,
            canceled_checkouts: canceled,
            pending_checkouts: pending,
            conversion_rate: total > 0 ? (paid / total) * 100 : 0,
            failure_rate: total > 0 ? (failed / total) * 100 : 0,
          },
          by_payment_method: {},
          last_updated: Math.floor(Date.now() / 1000),
        },
      };
    },
  },

  {
    uriPattern: /^chargily:\/\/analytics\/fraud-signals$/,
    description: 'Fraud detection signals',
    scopes: ['checkouts:read'],
    freshness: 60,
    handler: async (client, uri) => {
      const checkouts = await client.listCheckouts({ per_page: 100 });

      // Simple fraud detection: multiple failed attempts
      const failedCheckouts = checkouts.data.filter((c) => c.status === 'failed');

      return {
        uri,
        mimeType: 'application/json',
        content: {
          signals: {
            high_failure_rate: failedCheckouts.length > checkouts.data.length * 0.3,
            failed_attempts_count: failedCheckouts.length,
            suspicious_patterns: [],
          },
          failed_checkouts: failedCheckouts.map((c) => ({
            id: c.id,
            amount: c.amount,
            customer_id: c.customer_id,
            created_at: c.created_at,
          })),
          last_updated: Math.floor(Date.now() / 1000),
        },
      };
    },
  },

  // ===== 8. Product Resources =====
  {
    uriPattern: /^chargily:\/\/products\/catalog$/,
    description: 'Complete product catalog',
    scopes: ['products:read', 'prices:read'],
    freshness: 300, // 5 minutes
    handler: async (client, uri) => {
      const products = await client.listProducts({ per_page: 100 });

      // Get prices for all products
      const catalog = await Promise.all(
        products.data.map(async (product) => {
          const prices = await client.listPrices({
            product_id: product.id,
            per_page: 10,
          });

          return {
            id: product.id,
            name: product.name,
            description: product.description,
            images: product.images,
            prices: prices.data.map((price) => ({
              id: price.id,
              amount: price.amount,
              currency: price.currency,
            })),
            created_at: product.created_at,
          };
        })
      );

      return {
        uri,
        mimeType: 'application/json',
        content: {
          products: catalog,
          total: catalog.length,
          last_updated: Math.floor(Date.now() / 1000),
        },
      };
    },
  },
];
