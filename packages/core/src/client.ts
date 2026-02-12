/**
 * Chargily Pay API Client
 * Provides type-safe wrapper around Chargily Pay REST API
 */

import { fetch } from 'undici';
import type {
  ChargilyConfig,
  Balance,
  Customer,
  Product,
  Price,
  Checkout,
  PaymentLink,
  PaginatedResponse,
} from './types';
import { MCPError, ErrorCategory } from './types';

export class ChargilyClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: ChargilyConfig) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;

    // Set base URL based on mode
    this.baseUrl =
      config.apiUrl ||
      (config.mode === 'production'
        ? 'https://pay.chargily.net/api/v2'
        : 'https://pay.chargily.net/test/api/v2');
  }

  /**
   * Make authenticated request to Chargily API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options?: { idempotencyKey?: string }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        throw new MCPError(
          this.mapStatusToCategory(response.status),
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          this.isRetryable(response.status)
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new MCPError(
          ErrorCategory.TIMEOUT_ERROR,
          'Request timeout',
          undefined,
          true
        );
      }

      throw new MCPError(
        ErrorCategory.CHARGILY_API_ERROR,
        error instanceof Error ? error.message : 'Unknown error',
        undefined,
        true
      );
    }
  }

  private mapStatusToCategory(status: number): ErrorCategory {
    if (status === 401) return ErrorCategory.AUTHENTICATION_ERROR;
    if (status === 403) return ErrorCategory.AUTHORIZATION_ERROR;
    if (status === 404) return ErrorCategory.NOT_FOUND;
    if (status === 400 || status === 422) return ErrorCategory.VALIDATION_ERROR;
    if (status === 429) return ErrorCategory.RATE_LIMIT_ERROR;
    return ErrorCategory.CHARGILY_API_ERROR;
  }

  private isRetryable(status: number): boolean {
    return status >= 500 || status === 429 || status === 408;
  }

  // ===== Balance =====

  async getBalance(): Promise<Balance> {
    return this.request<Balance>('GET', '/balance');
  }

  // ===== Customers =====

  async createCustomer(data: {
    name: string;
    email: string;
    phone?: string;
    address?: {
      address?: string;
      state?: string;
      country: string;
    };
    metadata?: Record<string, any>;
  }): Promise<Customer> {
    return this.request<Customer>('POST', '/customers', data);
  }

  async getCustomer(customerId: string): Promise<Customer> {
    return this.request<Customer>('GET', `/customers/${customerId}`);
  }

  async listCustomers(params?: {
    page?: number;
    per_page?: number;
    email?: string;
    phone?: string;
  }): Promise<PaginatedResponse<Customer>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<Customer>>(
      'GET',
      `/customers${query ? `?${query}` : ''}`
    );
  }

  async updateCustomer(
    customerId: string,
    data: Partial<Omit<Customer, 'id' | 'entity' | 'livemode' | 'created_at' | 'updated_at'>>
  ): Promise<Customer> {
    return this.request<Customer>('PUT', `/customers/${customerId}`, data);
  }

  async deleteCustomer(customerId: string): Promise<{ id: string; deleted: boolean }> {
    return this.request<{ id: string; deleted: boolean }>('DELETE', `/customers/${customerId}`);
  }

  // ===== Products =====

  async createProduct(data: {
    name: string;
    description?: string;
    images?: string[];
    metadata?: Record<string, any>;
  }): Promise<Product> {
    return this.request<Product>('POST', '/products', data);
  }

  async getProduct(productId: string): Promise<Product> {
    return this.request<Product>('GET', `/products/${productId}`);
  }

  async listProducts(params?: {
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Product>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<Product>>(
      'GET',
      `/products${query ? `?${query}` : ''}`
    );
  }

  async updateProduct(
    productId: string,
    data: Partial<Omit<Product, 'id' | 'entity' | 'livemode' | 'created_at' | 'updated_at'>>
  ): Promise<Product> {
    return this.request<Product>('PUT', `/products/${productId}`, data);
  }

  async deleteProduct(productId: string): Promise<{ id: string; deleted: boolean }> {
    return this.request<{ id: string; deleted: boolean }>('DELETE', `/products/${productId}`);
  }

  // ===== Prices =====

  async createPrice(data: {
    product_id: string;
    amount: number;
    currency: 'dzd';
    metadata?: Record<string, any>;
  }): Promise<Price> {
    return this.request<Price>('POST', '/prices', data);
  }

  async getPrice(priceId: string): Promise<Price> {
    return this.request<Price>('GET', `/prices/${priceId}`);
  }

  async listPrices(params?: {
    product_id?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Price>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<Price>>(
      'GET',
      `/prices${query ? `?${query}` : ''}`
    );
  }

  async updatePrice(
    priceId: string,
    data: { metadata?: Record<string, any> }
  ): Promise<Price> {
    return this.request<Price>('PUT', `/prices/${priceId}`, data);
  }

  // ===== Checkouts =====

  async createCheckout(
    data: {
      amount: number;
      currency: 'dzd';
      payment_method?: 'edahabia' | 'cib' | 'chargily_app';
      success_url: string;
      failure_url?: string;
      customer_id?: string;
      description?: string;
      locale?: 'ar' | 'en' | 'fr';
      shipping_address?: string;
      collect_shipping_address?: boolean;
      percentage_discount?: number;
      amount_discount?: number;
      chargily_pay_fees_allocation?: 'customer' | 'merchant' | 'split';
      webhook_endpoint?: string;
      metadata?: Record<string, any>;
    },
    idempotencyKey?: string
  ): Promise<Checkout> {
    return this.request<Checkout>('POST', '/checkouts', data, { idempotencyKey });
  }

  async getCheckout(checkoutId: string): Promise<Checkout> {
    return this.request<Checkout>('GET', `/checkouts/${checkoutId}`);
  }

  async listCheckouts(params?: {
    page?: number;
    per_page?: number;
    status?: 'pending' | 'paid' | 'failed' | 'canceled' | 'expired';
    customer_id?: string;
    payment_method?: 'edahabia' | 'cib' | 'chargily_app';
  }): Promise<PaginatedResponse<Checkout>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<Checkout>>(
      'GET',
      `/checkouts${query ? `?${query}` : ''}`
    );
  }

  async expireCheckout(checkoutId: string): Promise<Checkout> {
    return this.request<Checkout>('POST', `/checkouts/${checkoutId}/expire`);
  }

  // ===== Payment Links =====

  async createPaymentLink(data: {
    name: string;
    items: Array<{ price_id: string; quantity: number }>;
    collect_shipping_address?: boolean;
    locale?: 'ar' | 'en' | 'fr';
    pass_fees_to_customer?: boolean;
    metadata?: Record<string, any>;
  }): Promise<PaymentLink> {
    return this.request<PaymentLink>('POST', '/payment-links', data);
  }

  async getPaymentLink(linkId: string): Promise<PaymentLink> {
    return this.request<PaymentLink>('GET', `/payment-links/${linkId}`);
  }

  async listPaymentLinks(params?: {
    page?: number;
    per_page?: number;
    active?: boolean;
  }): Promise<PaginatedResponse<PaymentLink>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request<PaginatedResponse<PaymentLink>>(
      'GET',
      `/payment-links${query ? `?${query}` : ''}`
    );
  }

  async updatePaymentLink(
    linkId: string,
    data: {
      name?: string;
      active?: boolean;
      collect_shipping_address?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<PaymentLink> {
    return this.request<PaymentLink>('PUT', `/payment-links/${linkId}`, data);
  }
}
