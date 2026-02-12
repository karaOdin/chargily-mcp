/**
 * Zod schemas for MCP tool input validation
 */

import { z } from 'zod';

// ===== Balance Schemas =====

export const GetBalanceSchema = z.object({});

// ===== Customer Schemas =====

export const CreateCustomerSchema = z.object({
  name: z.string().max(255),
  email: z.string().email(),
  phone: z.string().regex(/^(\+213|0)[5-7][0-9]{8}$/).optional(),
  address: z.object({
    address: z.string().optional(),
    state: z.string().optional(),
    country: z.enum(['dz']),
  }).optional(),
  metadata: z.record(z.any()).optional(),
});

export const GetCustomerSchema = z.object({
  customer_id: z.string().regex(/^cus_[a-zA-Z0-9]+$/),
});

export const ListCustomersSchema = z.object({
  page: z.number().int().min(1).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(20).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const UpdateCustomerSchema = z.object({
  customer_id: z.string().regex(/^cus_[a-zA-Z0-9]+$/),
  name: z.string().max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^(\+213|0)[5-7][0-9]{8}$/).optional(),
  address: z.object({
    address: z.string().optional(),
    state: z.string().optional(),
    country: z.enum(['dz']),
  }).optional(),
  metadata: z.record(z.any()).optional(),
});

export const DeleteCustomerSchema = z.object({
  customer_id: z.string().regex(/^cus_[a-zA-Z0-9]+$/),
  reason: z.enum(['user_request', 'gdpr_deletion', 'duplicate', 'fraud']),
});

// ===== Product Schemas =====

export const CreateProductSchema = z.object({
  name: z.string().max(255),
  description: z.string().optional(),
  images: z.array(z.string().url()).max(8).optional(),
  metadata: z.record(z.any()).optional(),
});

export const GetProductSchema = z.object({
  product_id: z.string().regex(/^prod_[a-zA-Z0-9]+$/),
});

export const ListProductsSchema = z.object({
  page: z.number().int().min(1).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(20).optional(),
});

export const UpdateProductSchema = z.object({
  product_id: z.string().regex(/^prod_[a-zA-Z0-9]+$/),
  name: z.string().max(255).optional(),
  description: z.string().optional(),
  images: z.array(z.string().url()).max(8).optional(),
  metadata: z.record(z.any()).optional(),
});

export const DeleteProductSchema = z.object({
  product_id: z.string().regex(/^prod_[a-zA-Z0-9]+$/),
});

// ===== Price Schemas =====

export const CreatePriceSchema = z.object({
  product_id: z.string().regex(/^prod_[a-zA-Z0-9]+$/),
  amount: z.number().int().min(100),
  currency: z.enum(['dzd']).default('dzd'),
  metadata: z.record(z.any()).optional(),
});

export const GetPriceSchema = z.object({
  price_id: z.string().regex(/^price_[a-zA-Z0-9]+$/),
});

export const ListPricesSchema = z.object({
  product_id: z.string().optional(),
  page: z.number().int().min(1).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(20).optional(),
});

export const UpdatePriceSchema = z.object({
  price_id: z.string().regex(/^price_[a-zA-Z0-9]+$/),
  metadata: z.record(z.any()).optional(),
});

// ===== Checkout Schemas =====

export const CreateCheckoutSchema = z.object({
  amount: z.number().int().min(5000).max(10000000),
  currency: z.enum(['dzd']).default('dzd'),
  payment_method: z.enum(['edahabia', 'cib', 'chargily_app']).default('edahabia').optional(),
  success_url: z.string().url(),
  failure_url: z.string().url().optional(),
  customer_id: z.string().regex(/^cus_[a-zA-Z0-9]+$/).optional(),
  description: z.string().max(500).optional(),
  locale: z.enum(['ar', 'en', 'fr']).default('ar').optional(),
  shipping_address: z.string().optional(),
  collect_shipping_address: z.boolean().default(false).optional(),
  percentage_discount: z.number().int().min(0).max(100).optional(),
  amount_discount: z.number().int().min(0).optional(),
  chargily_pay_fees_allocation: z.enum(['customer', 'merchant', 'split']).default('merchant').optional(),
  webhook_endpoint: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

export const GetCheckoutSchema = z.object({
  checkout_id: z.string().regex(/^checkout_[a-zA-Z0-9]+$/),
});

export const ListCheckoutsSchema = z.object({
  page: z.number().int().min(1).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(20).optional(),
  status: z.enum(['pending', 'paid', 'failed', 'canceled', 'expired']).optional(),
  customer_id: z.string().optional(),
  payment_method: z.enum(['edahabia', 'cib', 'chargily_app']).optional(),
});

export const CancelCheckoutSchema = z.object({
  checkout_id: z.string().regex(/^checkout_[a-zA-Z0-9]+$/),
  reason: z.enum(['customer_request', 'fraud_suspicion', 'duplicate', 'other']),
});

export const ExpireCheckoutSchema = z.object({
  checkout_id: z.string().regex(/^checkout_[a-zA-Z0-9]+$/),
});

// ===== Payment Link Schemas =====

export const CreatePaymentLinkSchema = z.object({
  name: z.string(),
  items: z.array(z.object({
    price_id: z.string(),
    quantity: z.number().int().min(1),
  })),
  collect_shipping_address: z.boolean().default(false).optional(),
  locale: z.enum(['ar', 'en', 'fr']).default('ar').optional(),
  pass_fees_to_customer: z.boolean().default(false).optional(),
  metadata: z.record(z.any()).optional(),
});

export const GetPaymentLinkSchema = z.object({
  payment_link_id: z.string().regex(/^link_[a-zA-Z0-9]+$/),
});

export const ListPaymentLinksSchema = z.object({
  page: z.number().int().min(1).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(20).optional(),
  active: z.boolean().optional(),
});

export const UpdatePaymentLinkSchema = z.object({
  payment_link_id: z.string().regex(/^link_[a-zA-Z0-9]+$/),
  name: z.string().optional(),
  active: z.boolean().optional(),
  collect_shipping_address: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

// ===== Webhook Schemas =====

export const VerifyWebhookSchema = z.object({
  payload: z.string(),
  signature: z.string(),
  secret: z.string(),
});
