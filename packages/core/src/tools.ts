/**
 * MCP Tool definitions and handlers
 */

import { z } from 'zod';
import type { ChargilyClient } from './client';
import * as schemas from './schemas';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  scopes: string[];
  approvalTier: 'none' | 'tier1' | 'tier2' | 'tier3';
  rateLimit: number; // requests per minute
  handler: (client: ChargilyClient, args: any) => Promise<any>;
}

export const TOOLS: ToolDefinition[] = [
  // ===== Balance Tools =====
  {
    name: 'get_balance',
    description: 'Retrieve the current account balance across all wallets (DZD, EUR, USD)',
    inputSchema: schemas.GetBalanceSchema,
    scopes: ['balance:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client) => {
      return await client.getBalance();
    },
  },

  // ===== Customer Tools =====
  {
    name: 'create_customer',
    description: 'Create a new customer in the Chargily Pay system',
    inputSchema: schemas.CreateCustomerSchema,
    scopes: ['customers:write'],
    approvalTier: 'none',
    rateLimit: 50,
    handler: async (client, args) => {
      return await client.createCustomer(args);
    },
  },
  {
    name: 'get_customer',
    description: 'Retrieve customer details by ID',
    inputSchema: schemas.GetCustomerSchema,
    scopes: ['customers:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.getCustomer(args.customer_id);
    },
  },
  {
    name: 'list_customers',
    description: 'List all customers with optional filtering',
    inputSchema: schemas.ListCustomersSchema,
    scopes: ['customers:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.listCustomers(args);
    },
  },
  {
    name: 'update_customer',
    description: 'Update customer information',
    inputSchema: schemas.UpdateCustomerSchema,
    scopes: ['customers:write'],
    approvalTier: 'tier2',
    rateLimit: 50,
    handler: async (client, args) => {
      const { customer_id, ...data } = args;
      return await client.updateCustomer(customer_id, data);
    },
  },
  {
    name: 'delete_customer',
    description: 'Delete a customer (soft delete, preserves transaction history)',
    inputSchema: schemas.DeleteCustomerSchema,
    scopes: ['customers:delete'],
    approvalTier: 'tier2',
    rateLimit: 10,
    handler: async (client, args) => {
      return await client.deleteCustomer(args.customer_id);
    },
  },

  // ===== Product Tools =====
  {
    name: 'create_product',
    description: 'Create a new product for sale',
    inputSchema: schemas.CreateProductSchema,
    scopes: ['products:write'],
    approvalTier: 'none',
    rateLimit: 50,
    handler: async (client, args) => {
      return await client.createProduct(args);
    },
  },
  {
    name: 'get_product',
    description: 'Retrieve product details by ID',
    inputSchema: schemas.GetProductSchema,
    scopes: ['products:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.getProduct(args.product_id);
    },
  },
  {
    name: 'list_products',
    description: 'List all products',
    inputSchema: schemas.ListProductsSchema,
    scopes: ['products:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.listProducts(args);
    },
  },
  {
    name: 'update_product',
    description: 'Update product information',
    inputSchema: schemas.UpdateProductSchema,
    scopes: ['products:write'],
    approvalTier: 'none',
    rateLimit: 50,
    handler: async (client, args) => {
      const { product_id, ...data } = args;
      return await client.updateProduct(product_id, data);
    },
  },
  {
    name: 'delete_product',
    description: 'Delete a product (only if no prices are associated)',
    inputSchema: schemas.DeleteProductSchema,
    scopes: ['products:delete'],
    approvalTier: 'tier1',
    rateLimit: 20,
    handler: async (client, args) => {
      return await client.deleteProduct(args.product_id);
    },
  },

  // ===== Price Tools =====
  {
    name: 'create_price',
    description: 'Create a price for a product',
    inputSchema: schemas.CreatePriceSchema,
    scopes: ['prices:write'],
    approvalTier: 'none',
    rateLimit: 50,
    handler: async (client, args) => {
      return await client.createPrice(args);
    },
  },
  {
    name: 'get_price',
    description: 'Retrieve price details by ID',
    inputSchema: schemas.GetPriceSchema,
    scopes: ['prices:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.getPrice(args.price_id);
    },
  },
  {
    name: 'list_prices',
    description: 'List all prices',
    inputSchema: schemas.ListPricesSchema,
    scopes: ['prices:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.listPrices(args);
    },
  },
  {
    name: 'update_price',
    description: 'Update price metadata (amount cannot be changed)',
    inputSchema: schemas.UpdatePriceSchema,
    scopes: ['prices:write'],
    approvalTier: 'none',
    rateLimit: 50,
    handler: async (client, args) => {
      const { price_id, ...data } = args;
      return await client.updatePrice(price_id, data);
    },
  },

  // ===== Checkout Tools =====
  {
    name: 'create_checkout',
    description: 'Create a new checkout session for payment',
    inputSchema: schemas.CreateCheckoutSchema,
    scopes: ['checkouts:create'],
    approvalTier: 'none', // Dynamic based on amount
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.createCheckout(args);
    },
  },
  {
    name: 'get_checkout',
    description: 'Retrieve checkout details by ID',
    inputSchema: schemas.GetCheckoutSchema,
    scopes: ['checkouts:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.getCheckout(args.checkout_id);
    },
  },
  {
    name: 'list_checkouts',
    description: 'List all checkouts with optional filters',
    inputSchema: schemas.ListCheckoutsSchema,
    scopes: ['checkouts:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.listCheckouts(args);
    },
  },
  {
    name: 'expire_checkout',
    description: 'Manually expire a checkout',
    inputSchema: schemas.ExpireCheckoutSchema,
    scopes: ['checkouts:expire'],
    approvalTier: 'tier2',
    rateLimit: 20,
    handler: async (client, args) => {
      return await client.expireCheckout(args.checkout_id);
    },
  },

  // ===== Payment Link Tools =====
  {
    name: 'create_payment_link',
    description: 'Create a reusable payment link',
    inputSchema: schemas.CreatePaymentLinkSchema,
    scopes: ['payment_links:create'],
    approvalTier: 'none',
    rateLimit: 50,
    handler: async (client, args) => {
      return await client.createPaymentLink(args);
    },
  },
  {
    name: 'get_payment_link',
    description: 'Retrieve payment link details',
    inputSchema: schemas.GetPaymentLinkSchema,
    scopes: ['payment_links:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.getPaymentLink(args.payment_link_id);
    },
  },
  {
    name: 'list_payment_links',
    description: 'List all payment links',
    inputSchema: schemas.ListPaymentLinksSchema,
    scopes: ['payment_links:read'],
    approvalTier: 'none',
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.listPaymentLinks(args);
    },
  },
  {
    name: 'update_payment_link',
    description: 'Update payment link details',
    inputSchema: schemas.UpdatePaymentLinkSchema,
    scopes: ['payment_links:write'],
    approvalTier: 'none',
    rateLimit: 50,
    handler: async (client, args) => {
      const { payment_link_id, ...data } = args;
      return await client.updatePaymentLink(payment_link_id, data);
    },
  },
];

/**
 * Get approval tier based on checkout amount
 */
export function getCheckoutApprovalTier(amount: number): 'none' | 'tier1' | 'tier2' | 'tier3' {
  if (amount < 5000) return 'tier1'; // < 50 DZD
  if (amount < 100000) return 'tier2'; // < 1,000 DZD
  return 'tier3'; // >= 1,000 DZD
}

/**
 * Find tool by name
 */
export function getTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
