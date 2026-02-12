/**
 * Core type definitions for Chargily MCP
 */

export type Environment = 'sandbox' | 'production';

export type PaymentMethod = 'edahabia' | 'cib' | 'chargily_app';

export type CheckoutStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'expired';

export type Currency = 'dzd' | 'eur' | 'usd';

export type Locale = 'ar' | 'en' | 'fr';

export type FeeAllocation = 'customer' | 'merchant' | 'split';

/**
 * Chargily API Configuration
 */
export interface ChargilyConfig {
  apiKey: string;
  mode: Environment;
  apiUrl?: string;
  webhookSecret?: string;
  timeout?: number;
  retryConfig?: RetryConfig;
}

/**
 * Retry configuration for API calls
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Balance object
 */
export interface Balance {
  id: string;
  entity: 'balance';
  livemode: boolean;
  current_balance: BalanceWallet[];
}

export interface BalanceWallet {
  currency: Currency;
  amount: number;
  available_balance: number;
  on_hold: number;
}

/**
 * Customer object
 */
export interface Customer {
  id: string;
  entity: 'customer';
  livemode: boolean;
  name: string;
  email: string;
  phone?: string;
  address?: CustomerAddress;
  metadata?: Record<string, any>;
  created_at: number;
  updated_at: number;
}

export interface CustomerAddress {
  address?: string;
  state?: string;
  country: string;
}

/**
 * Product object
 */
export interface Product {
  id: string;
  entity: 'product';
  livemode: boolean;
  name: string;
  description?: string;
  images?: string[];
  metadata?: Record<string, any>;
  created_at: number;
  updated_at: number;
}

/**
 * Price object
 */
export interface Price {
  id: string;
  entity: 'price';
  product_id: string;
  amount: number;
  currency: Currency;
  metadata?: Record<string, any>;
  created_at: number;
  updated_at: number;
}

/**
 * Checkout object
 */
export interface Checkout {
  id: string;
  entity: 'checkout';
  livemode: boolean;
  amount: number;
  currency: Currency;
  fees: number;
  fees_on_merchant: number;
  fees_on_customer: number;
  status: CheckoutStatus;
  checkout_url: string;
  qr_code_url?: string;
  payment_method: PaymentMethod;
  success_url: string;
  failure_url?: string;
  customer_id?: string;
  invoice_id?: string;
  description?: string;
  locale: Locale;
  shipping_address?: string;
  collect_shipping_address: boolean;
  discount?: Discount;
  pass_fees_to_customer: boolean;
  webhook_endpoint?: string;
  metadata?: Record<string, any>;
  created_at: number;
  updated_at: number;
}

export interface Discount {
  type: 'percentage' | 'amount';
  value: number;
}

/**
 * Payment Link object
 */
export interface PaymentLink {
  id: string;
  entity: 'payment_link';
  livemode: boolean;
  name: string;
  url: string;
  items: PaymentLinkItem[];
  active: boolean;
  collect_shipping_address: boolean;
  pass_fees_to_customer: boolean;
  locale: Locale;
  metadata?: Record<string, any>;
  created_at: number;
  updated_at: number;
}

export interface PaymentLinkItem {
  price_id: string;
  quantity: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

/**
 * Webhook event
 */
export interface WebhookEvent {
  id: string;
  type: 'checkout.paid' | 'checkout.failed' | 'checkout.canceled';
  data: Checkout;
  livemode: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * MCP Tool Context
 */
export interface ToolContext {
  config: ChargilyConfig;
  tenantId?: string;
  userId?: string;
  scopes: string[];
  requestId: string;
}

/**
 * MCP Resource URI
 */
export type ResourceURI = `chargily://${string}`;

/**
 * Approval tier
 */
export type ApprovalTier = 'none' | 'tier1' | 'tier2' | 'tier3';

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string;
  timestamp: Date;
  user_id?: string;
  tenant_id?: string;
  agent_type: 'human' | 'ai_agent' | 'voice_agent';
  agent_identifier: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  tool_name?: string;
  input_data?: any;
  output_data?: any;
  status: 'success' | 'failure' | 'pending_approval';
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  pci_relevant: boolean;
  data_sensitivity: 'public' | 'internal' | 'confidential' | 'pci';
}

/**
 * Error categories
 */
export enum ErrorCategory {
  AUTHENTICATION_ERROR = 'auth_error',
  AUTHORIZATION_ERROR = 'permission_denied',
  VALIDATION_ERROR = 'invalid_input',
  NOT_FOUND = 'not_found',
  CHARGILY_API_ERROR = 'upstream_error',
  RATE_LIMIT_ERROR = 'rate_limited',
  TIMEOUT_ERROR = 'timeout',
  TOOL_NOT_FOUND = 'tool_not_found',
  RESOURCE_UNAVAILABLE = 'resource_unavailable',
}

/**
 * MCP Error
 */
export class MCPError extends Error {
  constructor(
    public category: ErrorCategory,
    message: string,
    public statusCode?: number,
    public retryable = false,
  ) {
    super(message);
    this.name = 'MCPError';
  }
}
