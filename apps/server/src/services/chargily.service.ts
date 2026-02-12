/**
 * Chargily Service - Business logic for Chargily operations
 */

import { ChargilyClient } from '@chargily/mcp-core';
import { config, getChargilyApiKey } from '../utils/config.js';
import { auditLogRepository } from '../repositories/index.js';
import { logger } from '../utils/logger.js';
import type { Environment } from '@chargily/mcp-core';

export class ChargilyService {
  private client: ChargilyClient;

  constructor() {
    const apiKey = getChargilyApiKey();
    const mode = config.chargilyMode as Environment;

    this.client = new ChargilyClient({
      apiKey,
      mode,
      timeout: 30000,
    });

    logger.info({ mode }, 'Chargily client initialized');
  }

  /**
   * Get account balance
   */
  async getBalance(context: { userId: string; tenantId?: string; ipAddress?: string }) {
    const startTime = Date.now();

    try {
      const balance = await this.client.getBalance();

      await this.logAudit({
        ...context,
        action: 'get_balance',
        resource: 'balance',
        output: balance,
        success: true,
        duration: Date.now() - startTime,
      });

      return balance;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'get_balance',
        resource: 'balance',
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Create customer
   */
  async createCustomer(
    data: {
      name: string;
      email: string;
      phone?: string;
      address?: any;
      metadata?: any;
    },
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const customer = await this.client.createCustomer(data);

      await this.logAudit({
        ...context,
        action: 'create_customer',
        resource: 'customer',
        resourceId: customer.id,
        input: data,
        output: customer,
        success: true,
        duration: Date.now() - startTime,
      });

      return customer;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'create_customer',
        resource: 'customer',
        input: data,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Get customer
   */
  async getCustomer(
    id: string,
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const customer = await this.client.getCustomer(id);

      await this.logAudit({
        ...context,
        action: 'get_customer',
        resource: 'customer',
        resourceId: id,
        output: customer,
        success: true,
        duration: Date.now() - startTime,
      });

      return customer;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'get_customer',
        resource: 'customer',
        resourceId: id,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * List customers
   */
  async listCustomers(
    params: { page?: number; per_page?: number },
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const customers = await this.client.listCustomers(params);

      await this.logAudit({
        ...context,
        action: 'list_customers',
        resource: 'customer',
        input: params,
        output: { count: customers.data?.length || 0 },
        success: true,
        duration: Date.now() - startTime,
      });

      return customers;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'list_customers',
        resource: 'customer',
        input: params,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(
    id: string,
    data: { name?: string; email?: string; phone?: string; address?: any; metadata?: any },
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const customer = await this.client.updateCustomer(id, data);

      await this.logAudit({
        ...context,
        action: 'update_customer',
        resource: 'customer',
        resourceId: id,
        input: data,
        output: customer,
        success: true,
        duration: Date.now() - startTime,
      });

      return customer;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'update_customer',
        resource: 'customer',
        resourceId: id,
        input: data,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Delete customer
   */
  async deleteCustomer(
    id: string,
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      await this.client.deleteCustomer(id);

      await this.logAudit({
        ...context,
        action: 'delete_customer',
        resource: 'customer',
        resourceId: id,
        success: true,
        duration: Date.now() - startTime,
      });

      return { success: true };
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'delete_customer',
        resource: 'customer',
        resourceId: id,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Create checkout
   */
  async createCheckout(
    data: {
      amount: number;
      currency?: string;
      payment_method?: string;
      success_url: string;
      failure_url?: string;
      webhook_url?: string;
      customer_id?: string;
      metadata?: any;
      description?: string;
      locale?: string;
    },
    context: { userId: string; tenantId?: string; ipAddress?: string; approved?: boolean; approvalId?: string }
  ) {
    const startTime = Date.now();

    try {
      const checkout = await this.client.createCheckout(data);

      await this.logAudit({
        ...context,
        action: 'create_checkout',
        resource: 'checkout',
        resourceId: checkout.id,
        input: data,
        output: checkout,
        success: true,
        duration: Date.now() - startTime,
        approved: context.approved || false,
        approvalId: context.approvalId,
      });

      return checkout;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'create_checkout',
        resource: 'checkout',
        input: data,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Get checkout
   */
  async getCheckout(
    id: string,
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const checkout = await this.client.getCheckout(id);

      await this.logAudit({
        ...context,
        action: 'get_checkout',
        resource: 'checkout',
        resourceId: id,
        output: checkout,
        success: true,
        duration: Date.now() - startTime,
      });

      return checkout;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'get_checkout',
        resource: 'checkout',
        resourceId: id,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * List checkouts
   */
  async listCheckouts(
    params: { page?: number; per_page?: number },
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const checkouts = await this.client.listCheckouts(params);

      await this.logAudit({
        ...context,
        action: 'list_checkouts',
        resource: 'checkout',
        input: params,
        output: { count: checkouts.data?.length || 0 },
        success: true,
        duration: Date.now() - startTime,
      });

      return checkouts;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'list_checkouts',
        resource: 'checkout',
        input: params,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Expire checkout
   */
  async expireCheckout(
    id: string,
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const checkout = await this.client.expireCheckout(id);

      await this.logAudit({
        ...context,
        action: 'expire_checkout',
        resource: 'checkout',
        resourceId: id,
        output: checkout,
        success: true,
        duration: Date.now() - startTime,
      });

      return checkout;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'expire_checkout',
        resource: 'checkout',
        resourceId: id,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Create product
   */
  async createProduct(
    data: { name: string; description?: string; images?: string[]; metadata?: any },
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const product = await this.client.createProduct(data);

      await this.logAudit({
        ...context,
        action: 'create_product',
        resource: 'product',
        resourceId: product.id,
        input: data,
        output: product,
        success: true,
        duration: Date.now() - startTime,
      });

      return product;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'create_product',
        resource: 'product',
        input: data,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Get product
   */
  async getProduct(
    id: string,
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const product = await this.client.getProduct(id);

      await this.logAudit({
        ...context,
        action: 'get_product',
        resource: 'product',
        resourceId: id,
        output: product,
        success: true,
        duration: Date.now() - startTime,
      });

      return product;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'get_product',
        resource: 'product',
        resourceId: id,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * List products
   */
  async listProducts(
    params: { page?: number; per_page?: number },
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const products = await this.client.listProducts(params);

      await this.logAudit({
        ...context,
        action: 'list_products',
        resource: 'product',
        input: params,
        output: { count: products.data?.length || 0 },
        success: true,
        duration: Date.now() - startTime,
      });

      return products;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'list_products',
        resource: 'product',
        input: params,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Create price
   */
  async createPrice(
    data: { product_id: string; amount: number; currency?: string; metadata?: any },
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const price = await this.client.createPrice({
        ...data,
        currency: 'dzd',
      });

      await this.logAudit({
        ...context,
        action: 'create_price',
        resource: 'price',
        resourceId: price.id,
        input: data,
        output: price,
        success: true,
        duration: Date.now() - startTime,
      });

      return price;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'create_price',
        resource: 'price',
        input: data,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Get price
   */
  async getPrice(
    id: string,
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const price = await this.client.getPrice(id);

      await this.logAudit({
        ...context,
        action: 'get_price',
        resource: 'price',
        resourceId: id,
        output: price,
        success: true,
        duration: Date.now() - startTime,
      });

      return price;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'get_price',
        resource: 'price',
        resourceId: id,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * List prices
   */
  async listPrices(
    params: { product_id?: string; page?: number; per_page?: number },
    context: { userId: string; tenantId?: string; ipAddress?: string }
  ) {
    const startTime = Date.now();

    try {
      const prices = await this.client.listPrices(params);

      await this.logAudit({
        ...context,
        action: 'list_prices',
        resource: 'price',
        input: params,
        output: { count: prices.data?.length || 0 },
        success: true,
        duration: Date.now() - startTime,
      });

      return prices;
    } catch (error) {
      await this.logAudit({
        ...context,
        action: 'list_prices',
        resource: 'price',
        input: params,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Log audit trail
   */
  private async logAudit(params: {
    userId: string;
    tenantId?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    input?: any;
    output?: any;
    success: boolean;
    error?: string;
    duration?: number;
    ipAddress?: string;
    approved?: boolean;
    approvalId?: string;
  }) {
    try {
      await auditLogRepository.log({
        ...params,
        statusCode: params.success ? 200 : 500,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to log audit');
    }
  }
}

export const chargilyService = new ChargilyService();
