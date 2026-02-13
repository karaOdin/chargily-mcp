import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { fetch } from 'undici';
import { z } from 'zod';
import { createHmac } from 'crypto';
import { EventEmitter } from 'events';

// src/server.ts

// src/types.ts
var ErrorCategory = /* @__PURE__ */ ((ErrorCategory2) => {
  ErrorCategory2["AUTHENTICATION_ERROR"] = "auth_error";
  ErrorCategory2["AUTHORIZATION_ERROR"] = "permission_denied";
  ErrorCategory2["VALIDATION_ERROR"] = "invalid_input";
  ErrorCategory2["NOT_FOUND"] = "not_found";
  ErrorCategory2["CHARGILY_API_ERROR"] = "upstream_error";
  ErrorCategory2["RATE_LIMIT_ERROR"] = "rate_limited";
  ErrorCategory2["TIMEOUT_ERROR"] = "timeout";
  ErrorCategory2["TOOL_NOT_FOUND"] = "tool_not_found";
  ErrorCategory2["RESOURCE_UNAVAILABLE"] = "resource_unavailable";
  return ErrorCategory2;
})(ErrorCategory || {});
var MCPError = class extends Error {
  constructor(category, message, statusCode, retryable = false) {
    super(message);
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.name = "MCPError";
  }
};

// src/client.ts
var ChargilyClient = class {
  baseUrl;
  apiKey;
  timeout;
  constructor(config) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 3e4;
    this.baseUrl = config.apiUrl || (config.mode === "production" ? "https://pay.chargily.net/api/v2" : "https://pay.chargily.net/test/api/v2");
  }
  /**
   * Make authenticated request to Chargily API
   */
  async request(method, path, body, options) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    if (options?.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : void 0,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new MCPError(
          this.mapStatusToCategory(response.status),
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          this.isRetryable(response.status)
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new MCPError(
          "timeout" /* TIMEOUT_ERROR */,
          "Request timeout",
          void 0,
          true
        );
      }
      throw new MCPError(
        "upstream_error" /* CHARGILY_API_ERROR */,
        error instanceof Error ? error.message : "Unknown error",
        void 0,
        true
      );
    }
  }
  mapStatusToCategory(status) {
    if (status === 401) return "auth_error" /* AUTHENTICATION_ERROR */;
    if (status === 403) return "permission_denied" /* AUTHORIZATION_ERROR */;
    if (status === 404) return "not_found" /* NOT_FOUND */;
    if (status === 400 || status === 422) return "invalid_input" /* VALIDATION_ERROR */;
    if (status === 429) return "rate_limited" /* RATE_LIMIT_ERROR */;
    return "upstream_error" /* CHARGILY_API_ERROR */;
  }
  isRetryable(status) {
    return status >= 500 || status === 429 || status === 408;
  }
  // ===== Balance =====
  async getBalance() {
    return this.request("GET", "/balance");
  }
  // ===== Customers =====
  async createCustomer(data) {
    return this.request("POST", "/customers", data);
  }
  async getCustomer(customerId) {
    return this.request("GET", `/customers/${customerId}`);
  }
  async listCustomers(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(
      "GET",
      `/customers${query ? `?${query}` : ""}`
    );
  }
  async updateCustomer(customerId, data) {
    return this.request("PUT", `/customers/${customerId}`, data);
  }
  async deleteCustomer(customerId) {
    return this.request("DELETE", `/customers/${customerId}`);
  }
  // ===== Products =====
  async createProduct(data) {
    return this.request("POST", "/products", data);
  }
  async getProduct(productId) {
    return this.request("GET", `/products/${productId}`);
  }
  async listProducts(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(
      "GET",
      `/products${query ? `?${query}` : ""}`
    );
  }
  async updateProduct(productId, data) {
    return this.request("PUT", `/products/${productId}`, data);
  }
  async deleteProduct(productId) {
    return this.request("DELETE", `/products/${productId}`);
  }
  // ===== Prices =====
  async createPrice(data) {
    return this.request("POST", "/prices", data);
  }
  async getPrice(priceId) {
    return this.request("GET", `/prices/${priceId}`);
  }
  async listPrices(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(
      "GET",
      `/prices${query ? `?${query}` : ""}`
    );
  }
  async updatePrice(priceId, data) {
    return this.request("PUT", `/prices/${priceId}`, data);
  }
  // ===== Checkouts =====
  async createCheckout(data, idempotencyKey) {
    return this.request("POST", "/checkouts", data, { idempotencyKey });
  }
  async getCheckout(checkoutId) {
    return this.request("GET", `/checkouts/${checkoutId}`);
  }
  async listCheckouts(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(
      "GET",
      `/checkouts${query ? `?${query}` : ""}`
    );
  }
  async expireCheckout(checkoutId) {
    return this.request("POST", `/checkouts/${checkoutId}/expire`);
  }
  // ===== Payment Links =====
  async createPaymentLink(data) {
    return this.request("POST", "/payment-links", data);
  }
  async getPaymentLink(linkId) {
    return this.request("GET", `/payment-links/${linkId}`);
  }
  async listPaymentLinks(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(
      "GET",
      `/payment-links${query ? `?${query}` : ""}`
    );
  }
  async updatePaymentLink(linkId, data) {
    return this.request("PUT", `/payment-links/${linkId}`, data);
  }
};
var GetBalanceSchema = z.object({});
var CreateCustomerSchema = z.object({
  name: z.string().max(255),
  email: z.string().email(),
  phone: z.string().regex(/^(\+213|0)[5-7][0-9]{8}$/).optional(),
  address: z.object({
    address: z.string().optional(),
    state: z.string().optional(),
    country: z.enum(["dz"])
  }).optional(),
  metadata: z.record(z.any()).optional()
});
var GetCustomerSchema = z.object({
  customer_id: z.string().regex(/^cus_[a-zA-Z0-9]+$/)
});
var ListCustomersSchema = z.object({
  page: z.number().int().min(1).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(20).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional()
});
var UpdateCustomerSchema = z.object({
  customer_id: z.string().regex(/^cus_[a-zA-Z0-9]+$/),
  name: z.string().max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^(\+213|0)[5-7][0-9]{8}$/).optional(),
  address: z.object({
    address: z.string().optional(),
    state: z.string().optional(),
    country: z.enum(["dz"])
  }).optional(),
  metadata: z.record(z.any()).optional()
});
var DeleteCustomerSchema = z.object({
  customer_id: z.string().regex(/^cus_[a-zA-Z0-9]+$/),
  reason: z.enum(["user_request", "gdpr_deletion", "duplicate", "fraud"])
});
var CreateProductSchema = z.object({
  name: z.string().max(255),
  description: z.string().optional(),
  images: z.array(z.string().url()).max(8).optional(),
  metadata: z.record(z.any()).optional()
});
var GetProductSchema = z.object({
  product_id: z.string().regex(/^prod_[a-zA-Z0-9]+$/)
});
var ListProductsSchema = z.object({
  page: z.number().int().min(1).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(20).optional()
});
var UpdateProductSchema = z.object({
  product_id: z.string().regex(/^prod_[a-zA-Z0-9]+$/),
  name: z.string().max(255).optional(),
  description: z.string().optional(),
  images: z.array(z.string().url()).max(8).optional(),
  metadata: z.record(z.any()).optional()
});
var DeleteProductSchema = z.object({
  product_id: z.string().regex(/^prod_[a-zA-Z0-9]+$/)
});
var CreatePriceSchema = z.object({
  product_id: z.string().regex(/^prod_[a-zA-Z0-9]+$/),
  amount: z.number().int().min(100),
  currency: z.enum(["dzd"]).default("dzd"),
  metadata: z.record(z.any()).optional()
});
var GetPriceSchema = z.object({
  price_id: z.string().regex(/^price_[a-zA-Z0-9]+$/)
});
var ListPricesSchema = z.object({
  product_id: z.string().optional(),
  page: z.number().int().min(1).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(20).optional()
});
var UpdatePriceSchema = z.object({
  price_id: z.string().regex(/^price_[a-zA-Z0-9]+$/),
  metadata: z.record(z.any()).optional()
});
var CreateCheckoutSchema = z.object({
  amount: z.number().int().min(5e3).max(1e7),
  currency: z.enum(["dzd"]).default("dzd"),
  payment_method: z.enum(["edahabia", "cib", "chargily_app"]).default("edahabia").optional(),
  success_url: z.string().url(),
  failure_url: z.string().url().optional(),
  customer_id: z.string().regex(/^cus_[a-zA-Z0-9]+$/).optional(),
  description: z.string().max(500).optional(),
  locale: z.enum(["ar", "en", "fr"]).default("ar").optional(),
  shipping_address: z.string().optional(),
  collect_shipping_address: z.boolean().default(false).optional(),
  percentage_discount: z.number().int().min(0).max(100).optional(),
  amount_discount: z.number().int().min(0).optional(),
  chargily_pay_fees_allocation: z.enum(["customer", "merchant", "split"]).default("merchant").optional(),
  webhook_endpoint: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});
var GetCheckoutSchema = z.object({
  checkout_id: z.string().regex(/^checkout_[a-zA-Z0-9]+$/)
});
var ListCheckoutsSchema = z.object({
  page: z.number().int().min(1).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(20).optional(),
  status: z.enum(["pending", "paid", "failed", "canceled", "expired"]).optional(),
  customer_id: z.string().optional(),
  payment_method: z.enum(["edahabia", "cib", "chargily_app"]).optional()
});
var CancelCheckoutSchema = z.object({
  checkout_id: z.string().regex(/^checkout_[a-zA-Z0-9]+$/),
  reason: z.enum(["customer_request", "fraud_suspicion", "duplicate", "other"])
});
var ExpireCheckoutSchema = z.object({
  checkout_id: z.string().regex(/^checkout_[a-zA-Z0-9]+$/)
});
var CreatePaymentLinkSchema = z.object({
  name: z.string(),
  items: z.array(z.object({
    price_id: z.string(),
    quantity: z.number().int().min(1)
  })),
  collect_shipping_address: z.boolean().default(false).optional(),
  locale: z.enum(["ar", "en", "fr"]).default("ar").optional(),
  pass_fees_to_customer: z.boolean().default(false).optional(),
  metadata: z.record(z.any()).optional()
});
var GetPaymentLinkSchema = z.object({
  payment_link_id: z.string().regex(/^link_[a-zA-Z0-9]+$/)
});
var ListPaymentLinksSchema = z.object({
  page: z.number().int().min(1).default(1).optional(),
  per_page: z.number().int().min(1).max(100).default(20).optional(),
  active: z.boolean().optional()
});
var UpdatePaymentLinkSchema = z.object({
  payment_link_id: z.string().regex(/^link_[a-zA-Z0-9]+$/),
  name: z.string().optional(),
  active: z.boolean().optional(),
  collect_shipping_address: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});
var VerifyWebhookSchema = z.object({
  payload: z.string(),
  signature: z.string(),
  secret: z.string()
});

// src/tools.ts
var TOOLS = [
  // ===== Balance Tools =====
  {
    name: "get_balance",
    description: "Retrieve the current account balance across all wallets (DZD, EUR, USD)",
    inputSchema: GetBalanceSchema,
    scopes: ["balance:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client) => {
      return await client.getBalance();
    }
  },
  // ===== Customer Tools =====
  {
    name: "create_customer",
    description: "Create a new customer in the Chargily Pay system",
    inputSchema: CreateCustomerSchema,
    scopes: ["customers:write"],
    approvalTier: "none",
    rateLimit: 50,
    handler: async (client, args) => {
      return await client.createCustomer(args);
    }
  },
  {
    name: "get_customer",
    description: "Retrieve customer details by ID",
    inputSchema: GetCustomerSchema,
    scopes: ["customers:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.getCustomer(args.customer_id);
    }
  },
  {
    name: "list_customers",
    description: "List all customers with optional filtering",
    inputSchema: ListCustomersSchema,
    scopes: ["customers:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.listCustomers(args);
    }
  },
  {
    name: "update_customer",
    description: "Update customer information",
    inputSchema: UpdateCustomerSchema,
    scopes: ["customers:write"],
    approvalTier: "tier2",
    rateLimit: 50,
    handler: async (client, args) => {
      const { customer_id, ...data } = args;
      return await client.updateCustomer(customer_id, data);
    }
  },
  {
    name: "delete_customer",
    description: "Delete a customer (soft delete, preserves transaction history)",
    inputSchema: DeleteCustomerSchema,
    scopes: ["customers:delete"],
    approvalTier: "tier2",
    rateLimit: 10,
    handler: async (client, args) => {
      return await client.deleteCustomer(args.customer_id);
    }
  },
  // ===== Product Tools =====
  {
    name: "create_product",
    description: "Create a new product for sale",
    inputSchema: CreateProductSchema,
    scopes: ["products:write"],
    approvalTier: "none",
    rateLimit: 50,
    handler: async (client, args) => {
      return await client.createProduct(args);
    }
  },
  {
    name: "get_product",
    description: "Retrieve product details by ID",
    inputSchema: GetProductSchema,
    scopes: ["products:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.getProduct(args.product_id);
    }
  },
  {
    name: "list_products",
    description: "List all products",
    inputSchema: ListProductsSchema,
    scopes: ["products:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.listProducts(args);
    }
  },
  {
    name: "update_product",
    description: "Update product information",
    inputSchema: UpdateProductSchema,
    scopes: ["products:write"],
    approvalTier: "none",
    rateLimit: 50,
    handler: async (client, args) => {
      const { product_id, ...data } = args;
      return await client.updateProduct(product_id, data);
    }
  },
  {
    name: "delete_product",
    description: "Delete a product (only if no prices are associated)",
    inputSchema: DeleteProductSchema,
    scopes: ["products:delete"],
    approvalTier: "tier1",
    rateLimit: 20,
    handler: async (client, args) => {
      return await client.deleteProduct(args.product_id);
    }
  },
  // ===== Price Tools =====
  {
    name: "create_price",
    description: "Create a price for a product",
    inputSchema: CreatePriceSchema,
    scopes: ["prices:write"],
    approvalTier: "none",
    rateLimit: 50,
    handler: async (client, args) => {
      return await client.createPrice(args);
    }
  },
  {
    name: "get_price",
    description: "Retrieve price details by ID",
    inputSchema: GetPriceSchema,
    scopes: ["prices:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.getPrice(args.price_id);
    }
  },
  {
    name: "list_prices",
    description: "List all prices",
    inputSchema: ListPricesSchema,
    scopes: ["prices:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.listPrices(args);
    }
  },
  {
    name: "update_price",
    description: "Update price metadata (amount cannot be changed)",
    inputSchema: UpdatePriceSchema,
    scopes: ["prices:write"],
    approvalTier: "none",
    rateLimit: 50,
    handler: async (client, args) => {
      const { price_id, ...data } = args;
      return await client.updatePrice(price_id, data);
    }
  },
  // ===== Checkout Tools =====
  {
    name: "create_checkout",
    description: "Create a new checkout session for payment",
    inputSchema: CreateCheckoutSchema,
    scopes: ["checkouts:create"],
    approvalTier: "none",
    // Dynamic based on amount
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.createCheckout(args);
    }
  },
  {
    name: "get_checkout",
    description: "Retrieve checkout details by ID",
    inputSchema: GetCheckoutSchema,
    scopes: ["checkouts:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.getCheckout(args.checkout_id);
    }
  },
  {
    name: "list_checkouts",
    description: "List all checkouts with optional filters",
    inputSchema: ListCheckoutsSchema,
    scopes: ["checkouts:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.listCheckouts(args);
    }
  },
  {
    name: "expire_checkout",
    description: "Manually expire a checkout",
    inputSchema: ExpireCheckoutSchema,
    scopes: ["checkouts:expire"],
    approvalTier: "tier2",
    rateLimit: 20,
    handler: async (client, args) => {
      return await client.expireCheckout(args.checkout_id);
    }
  },
  // ===== Payment Link Tools =====
  {
    name: "create_payment_link",
    description: "Create a reusable payment link",
    inputSchema: CreatePaymentLinkSchema,
    scopes: ["payment_links:create"],
    approvalTier: "none",
    rateLimit: 50,
    handler: async (client, args) => {
      return await client.createPaymentLink(args);
    }
  },
  {
    name: "get_payment_link",
    description: "Retrieve payment link details",
    inputSchema: GetPaymentLinkSchema,
    scopes: ["payment_links:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.getPaymentLink(args.payment_link_id);
    }
  },
  {
    name: "list_payment_links",
    description: "List all payment links",
    inputSchema: ListPaymentLinksSchema,
    scopes: ["payment_links:read"],
    approvalTier: "none",
    rateLimit: 100,
    handler: async (client, args) => {
      return await client.listPaymentLinks(args);
    }
  },
  {
    name: "update_payment_link",
    description: "Update payment link details",
    inputSchema: UpdatePaymentLinkSchema,
    scopes: ["payment_links:write"],
    approvalTier: "none",
    rateLimit: 50,
    handler: async (client, args) => {
      const { payment_link_id, ...data } = args;
      return await client.updatePaymentLink(payment_link_id, data);
    }
  }
];
function getCheckoutApprovalTier(amount) {
  if (amount < 5e3) return "tier1";
  if (amount < 1e5) return "tier2";
  return "tier3";
}
function getTool(name) {
  return TOOLS.find((tool) => tool.name === name);
}

// src/resources.ts
var RESOURCES = [
  // ===== 1. Balance Resources =====
  {
    uriPattern: /^chargily:\/\/balance\/current$/,
    description: "Current account balance across all wallets",
    scopes: ["balance:read"],
    freshness: 30,
    handler: async (client) => {
      const balance = await client.getBalance();
      return {
        uri: "chargily://balance/current",
        mimeType: "application/json",
        content: balance
      };
    }
  },
  // ===== 2. Transaction Resources =====
  {
    uriPattern: /^chargily:\/\/transactions\/([a-z0-9_]+)$/,
    description: "Single transaction details",
    scopes: ["checkouts:read"],
    freshness: Infinity,
    // Immutable
    handler: async (client, uri, params) => {
      const checkoutId = params.param0;
      const checkout = await client.getCheckout(checkoutId);
      return {
        uri,
        mimeType: "application/json",
        content: {
          id: checkout.id,
          type: "checkout",
          status: checkout.status,
          amount: checkout.amount,
          currency: checkout.currency,
          fees: checkout.fees,
          customer_id: checkout.customer_id,
          payment_method: checkout.payment_method,
          created_at: checkout.created_at,
          metadata: checkout.metadata
        }
      };
    }
  },
  {
    uriPattern: /^chargily:\/\/transactions\/recent$/,
    description: "Most recent transactions (last 100)",
    scopes: ["checkouts:read"],
    freshness: 10,
    handler: async (client, uri) => {
      const urlObj = new URL(uri.replace("chargily://", "http://dummy/"));
      const limit = parseInt(urlObj.searchParams.get("limit") || "100");
      const status = urlObj.searchParams.get("status");
      const payment_method = urlObj.searchParams.get("payment_method");
      const response = await client.listCheckouts({
        per_page: Math.min(limit, 100),
        status,
        payment_method
      });
      return {
        uri,
        mimeType: "application/json",
        content: {
          transactions: response.data.map((checkout) => ({
            id: checkout.id,
            amount: checkout.amount,
            status: checkout.status,
            payment_method: checkout.payment_method,
            created_at: checkout.created_at
          })),
          total: response.data.length,
          last_updated: Math.floor(Date.now() / 1e3)
        }
      };
    }
  },
  // ===== 3. Customer Resources =====
  {
    uriPattern: /^chargily:\/\/customers\/([a-z0-9_]+)$/,
    description: "Customer profile and transaction history",
    scopes: ["customers:read"],
    freshness: 60,
    handler: async (client, uri, params) => {
      const customerId = params.param0;
      const customer = await client.getCustomer(customerId);
      const checkouts = await client.listCheckouts({
        customer_id: customerId,
        per_page: 5
      });
      const total_spent = checkouts.data.filter((c) => c.status === "paid").reduce((sum, c) => sum + c.amount, 0);
      return {
        uri,
        mimeType: "application/json",
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
            created_at: c.created_at
          }))
        }
      };
    }
  },
  {
    uriPattern: /^chargily:\/\/customers\/top$/,
    description: "Top customers by spend",
    scopes: ["customers:read", "checkouts:read"],
    freshness: 300,
    // 5 minutes
    handler: async (client, uri) => {
      const urlObj = new URL(uri.replace("chargily://", "http://dummy/"));
      const limit = parseInt(urlObj.searchParams.get("limit") || "10");
      const customersResponse = await client.listCustomers({ per_page: 100 });
      const customerStats = await Promise.all(
        customersResponse.data.map(async (customer) => {
          const checkouts = await client.listCheckouts({
            customer_id: customer.id,
            per_page: 100
          });
          const total_spent = checkouts.data.filter((c) => c.status === "paid").reduce((sum, c) => sum + c.amount, 0);
          const transaction_count = checkouts.data.filter((c) => c.status === "paid").length;
          return {
            id: customer.id,
            name: customer.name,
            total_spent,
            transaction_count,
            average_order_value: transaction_count > 0 ? Math.round(total_spent / transaction_count) : 0
          };
        })
      );
      const topCustomers = customerStats.sort((a, b) => b.total_spent - a.total_spent).slice(0, limit);
      return {
        uri,
        mimeType: "application/json",
        content: {
          customers: topCustomers,
          period: "30d",
          last_updated: Math.floor(Date.now() / 1e3)
        }
      };
    }
  },
  // ===== 4. Report Resources =====
  {
    uriPattern: /^chargily:\/\/reports\/daily$/,
    description: "Daily transaction summary",
    scopes: ["checkouts:read"],
    freshness: 60,
    // 1 minute
    handler: async (client, uri) => {
      const urlObj = new URL(uri.replace("chargily://", "http://dummy/"));
      const dateStr = urlObj.searchParams.get("date") || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const checkouts = await client.listCheckouts({ per_page: 100 });
      const todayCheckouts = checkouts.data.filter((c) => {
        const checkoutDate = new Date(c.created_at * 1e3).toISOString().split("T")[0];
        return checkoutDate === dateStr;
      });
      const successful = todayCheckouts.filter((c) => c.status === "paid");
      const failed = todayCheckouts.filter((c) => c.status === "failed");
      const canceled = todayCheckouts.filter((c) => c.status === "canceled");
      const total_amount = successful.reduce((sum, c) => sum + c.amount, 0);
      const total_fees = successful.reduce((sum, c) => sum + (c.fees || 0), 0);
      const by_payment_method = {};
      successful.forEach((c) => {
        const method = c.payment_method || "unknown";
        if (!by_payment_method[method]) {
          by_payment_method[method] = { count: 0, amount: 0 };
        }
        by_payment_method[method].count++;
        by_payment_method[method].amount += c.amount;
      });
      return {
        uri,
        mimeType: "application/json",
        content: {
          date: dateStr,
          timezone: "Africa/Algiers",
          summary: {
            total_transactions: todayCheckouts.length,
            successful_payments: successful.length,
            failed_payments: failed.length,
            canceled_checkouts: canceled.length,
            total_amount,
            total_fees,
            net_revenue: total_amount - total_fees
          },
          by_payment_method,
          last_updated: Math.floor(Date.now() / 1e3)
        }
      };
    }
  },
  {
    uriPattern: /^chargily:\/\/reports\/monthly$/,
    description: "Monthly transaction summary",
    scopes: ["checkouts:read"],
    freshness: 300,
    // 5 minutes
    handler: async (client, uri) => {
      const urlObj = new URL(uri.replace("chargily://", "http://dummy/"));
      const monthStr = urlObj.searchParams.get("month") || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
      const checkouts = await client.listCheckouts({ per_page: 100 });
      const monthCheckouts = checkouts.data.filter((c) => {
        const checkoutMonth = new Date(c.created_at * 1e3).toISOString().slice(0, 7);
        return checkoutMonth === monthStr;
      });
      const successful = monthCheckouts.filter((c) => c.status === "paid");
      const total_amount = successful.reduce((sum, c) => sum + c.amount, 0);
      const total_fees = successful.reduce((sum, c) => sum + (c.fees || 0), 0);
      return {
        uri,
        mimeType: "application/json",
        content: {
          month: monthStr,
          summary: {
            total_transactions: monthCheckouts.length,
            successful_payments: successful.length,
            total_amount,
            total_fees,
            net_revenue: total_amount - total_fees,
            average_transaction_value: successful.length > 0 ? Math.round(total_amount / successful.length) : 0,
            success_rate: monthCheckouts.length > 0 ? successful.length / monthCheckouts.length * 100 : 0
          },
          last_updated: Math.floor(Date.now() / 1e3)
        }
      };
    }
  },
  // ===== 5. Webhook Resources =====
  {
    uriPattern: /^chargily:\/\/webhooks\/logs$/,
    description: "Recent webhook delivery logs",
    scopes: ["webhooks:read"],
    freshness: 10,
    handler: async (_client, uri) => {
      return {
        uri,
        mimeType: "application/json",
        content: {
          logs: [],
          total: 0,
          last_updated: Math.floor(Date.now() / 1e3),
          note: "Webhook logs available via server API: GET /api/v1/webhooks/logs"
        }
      };
    }
  },
  {
    uriPattern: /^chargily:\/\/webhooks\/events\/([a-z0-9_]+)$/,
    description: "Single webhook event details",
    scopes: ["webhooks:read"],
    freshness: Infinity,
    // Immutable
    handler: async (_client, uri, params) => {
      const eventId = params.param0;
      return {
        uri,
        mimeType: "application/json",
        content: {
          id: eventId,
          note: "Webhook event details available via server API: GET /api/v1/webhooks/logs"
        }
      };
    }
  },
  // ===== 6. Settlement Resources =====
  {
    uriPattern: /^chargily:\/\/settlements\/latest$/,
    description: "Latest settlement information",
    scopes: ["settlements:read"],
    freshness: 300,
    // 5 minutes
    handler: async (client, uri) => {
      const balance = await client.getBalance();
      return {
        uri,
        mimeType: "application/json",
        content: {
          balance,
          note: "Settlement details depend on Chargily V2 API settlement endpoints (coming soon)",
          last_updated: Math.floor(Date.now() / 1e3)
        }
      };
    }
  },
  {
    uriPattern: /^chargily:\/\/settlements\/history$/,
    description: "Settlement history",
    scopes: ["settlements:read"],
    freshness: 300,
    // 5 minutes
    handler: async (_client, uri) => {
      return {
        uri,
        mimeType: "application/json",
        content: {
          settlements: [],
          note: "Settlement history depends on Chargily V2 API settlement endpoints (coming soon)",
          last_updated: Math.floor(Date.now() / 1e3)
        }
      };
    }
  },
  // ===== 7. Analytics Resources =====
  {
    uriPattern: /^chargily:\/\/analytics\/conversion$/,
    description: "Conversion rate analytics",
    scopes: ["checkouts:read"],
    freshness: 300,
    // 5 minutes
    handler: async (client, uri) => {
      const checkouts = await client.listCheckouts({ per_page: 100 });
      const total = checkouts.data.length;
      const paid = checkouts.data.filter((c) => c.status === "paid").length;
      const failed = checkouts.data.filter((c) => c.status === "failed").length;
      const canceled = checkouts.data.filter((c) => c.status === "canceled").length;
      const pending = checkouts.data.filter((c) => c.status === "pending").length;
      return {
        uri,
        mimeType: "application/json",
        content: {
          summary: {
            total_checkouts: total,
            successful_payments: paid,
            failed_payments: failed,
            canceled_checkouts: canceled,
            pending_checkouts: pending,
            conversion_rate: total > 0 ? paid / total * 100 : 0,
            failure_rate: total > 0 ? failed / total * 100 : 0
          },
          by_payment_method: {},
          last_updated: Math.floor(Date.now() / 1e3)
        }
      };
    }
  },
  {
    uriPattern: /^chargily:\/\/analytics\/fraud-signals$/,
    description: "Fraud detection signals",
    scopes: ["checkouts:read"],
    freshness: 60,
    handler: async (client, uri) => {
      const checkouts = await client.listCheckouts({ per_page: 100 });
      const failedCheckouts = checkouts.data.filter((c) => c.status === "failed");
      return {
        uri,
        mimeType: "application/json",
        content: {
          signals: {
            high_failure_rate: failedCheckouts.length > checkouts.data.length * 0.3,
            failed_attempts_count: failedCheckouts.length,
            suspicious_patterns: []
          },
          failed_checkouts: failedCheckouts.map((c) => ({
            id: c.id,
            amount: c.amount,
            customer_id: c.customer_id,
            created_at: c.created_at
          })),
          last_updated: Math.floor(Date.now() / 1e3)
        }
      };
    }
  },
  // ===== 8. Product Resources =====
  {
    uriPattern: /^chargily:\/\/products\/catalog$/,
    description: "Complete product catalog",
    scopes: ["products:read", "prices:read"],
    freshness: 300,
    // 5 minutes
    handler: async (client, uri) => {
      const products = await client.listProducts({ per_page: 100 });
      const catalog = await Promise.all(
        products.data.map(async (product) => {
          const prices = await client.listPrices({
            product_id: product.id,
            per_page: 10
          });
          return {
            id: product.id,
            name: product.name,
            description: product.description,
            images: product.images,
            prices: prices.data.map((price) => ({
              id: price.id,
              amount: price.amount,
              currency: price.currency
            })),
            created_at: product.created_at
          };
        })
      );
      return {
        uri,
        mimeType: "application/json",
        content: {
          products: catalog,
          total: catalog.length,
          last_updated: Math.floor(Date.now() / 1e3)
        }
      };
    }
  }
];

// src/prompts.ts
var PROMPTS = [
  {
    name: "investigate_failed_payment",
    description: "Investigate why a specific payment failed and suggest remediation steps",
    arguments: {
      checkout_id: { type: "string", required: true, description: "The checkout ID to investigate" },
      include_customer_history: { type: "boolean", required: false, description: "Include customer payment history" }
    },
    template: `You are a payment investigation specialist for Chargily Pay.

TASK: Investigate why checkout {{checkout_id}} failed and provide actionable remediation steps.

INVESTIGATION STEPS:
1. Fetch checkout details using get_checkout tool
2. Analyze the status, payment_method, and any error codes
3. {{#if include_customer_history}}If include_customer_history is true, fetch customer details and recent transactions{{/if}}
4. Check for common failure patterns:
   - Insufficient funds
   - Invalid card details
   - Network timeouts
   - Payment method restrictions
5. Review similar failures in the last 24 hours

Provide a structured report with:
- Root cause analysis
- Customer payment history (if requested)
- Recommended actions for merchant
- Suggested customer communication`
  },
  {
    name: "daily_finance_summary",
    description: "Generate a comprehensive daily financial summary with insights",
    arguments: {
      date: { type: "string", required: false, description: "Date in YYYY-MM-DD format (default: today)" },
      include_comparison: { type: "boolean", required: false, description: "Compare with previous day" }
    },
    template: `You are a financial analyst generating the daily summary for Chargily Pay merchant.

TASK: Generate comprehensive daily financial report for {{date}}.

Use the chargily://reports/daily resource to fetch today's data.

INCLUDE IN REPORT:
1. **Key Metrics**
   - Total transactions
   - Successful payments vs failed
   - Total revenue and net revenue (after fees)
   - Average transaction value
   - Success rate percentage

2. **Revenue Breakdown**
   - By payment method (EDAHABIA, CIB, Chargily App)
   - Hourly trend analysis
   - Peak transaction times

3. **Issues & Alerts**
   - Failed payments and reasons
   - Unusual patterns or spikes
   - Fraud signals if any

4. **Actionable Insights**
   - Recommendations for improving conversion
   - Suggested payment method promotions
   - Customer engagement opportunities

{{#if include_comparison}}
Compare all metrics with the previous day and highlight significant changes.
{{/if}}

Format as a professional executive summary.`
  },
  {
    name: "customer_support_helper",
    description: "Help customer support resolve payment and account issues",
    arguments: {
      customer_id: { type: "string", required: false, description: "Customer ID to look up" },
      issue_type: { type: "string", required: true, description: "Type of issue: payment_failed, refund_request, account_question" },
      context: { type: "string", required: false, description: "Additional context about the issue" }
    },
    template: `You are a customer support assistant for Chargily Pay merchants.

CUSTOMER ISSUE: {{issue_type}}
{{#if customer_id}}CUSTOMER ID: {{customer_id}}{{/if}}
{{#if context}}CONTEXT: {{context}}{{/if}}

SUPPORT WORKFLOW:

{{#if customer_id}}
1. Look up customer profile using chargily://customers/{{customer_id}}
2. Review recent transaction history
3. Check for patterns (multiple failures, refund history)
{{/if}}

ISSUE-SPECIFIC GUIDANCE:

**If payment_failed:**
- Check the specific checkout details
- Identify failure reason (network, funds, validation)
- Verify payment method availability
- Suggest alternative payment methods if applicable
- Provide customer-friendly explanation

**If refund_request:**
- Locate the original transaction
- Verify transaction is eligible for refund
- Check merchant refund policy
- Calculate refund amount (full/partial)
- Explain refund timeline (typically 5-7 business days for Algerian banks)

**If account_question:**
- Review customer account details
- Check transaction history
- Verify account status
- Answer specific questions about balance, fees, or limits

Provide:
1. Summary of the situation
2. Step-by-step resolution
3. Customer communication script
4. Follow-up actions needed`
  },
  {
    name: "create_checkout_flow",
    description: "Guide through the process of creating a checkout",
    arguments: {
      amount: { type: "number", required: true, description: "Amount in DZD cents (e.g., 10000 for 100 DZD)" },
      customer_email: { type: "string", required: false, description: "Customer email address" },
      product_name: { type: "string", required: false, description: "Product or service name" }
    },
    template: `You are a Chargily Pay integration assistant helping create a checkout.

CHECKOUT DETAILS:
- Amount: {{amount}} DZD cents ({{amount / 100}} DZD)
{{#if customer_email}}- Customer Email: {{customer_email}}{{/if}}
{{#if product_name}}- Product: {{product_name}}{{/if}}

CHECKOUT CREATION WORKFLOW:

1. **Validate Amount**
   - Minimum: 50 DZD (5000 cents)
   - Maximum: 100,000 DZD (10,000,000 cents)
   - Your amount: {{amount / 100}} DZD \u2713

2. **Customer Setup** (if new customer)
   {{#if customer_email}}
   - Search for existing customer with email: {{customer_email}}
   - If not found, create new customer using create_customer tool
   {{else}}
   - No customer email provided, checkout will be anonymous
   {{/if}}

3. **Create Checkout**
   Use create_checkout tool with:
   - amount: {{amount}}
   - currency: "dzd"
   - success_url: "https://yoursite.com/success"
   - failure_url: "https://yoursite.com/failure"
   {{#if customer_email}}- customer_id: (from step 2){{/if}}
   {{#if product_name}}- description: "{{product_name}}"{{/if}}
   - payment_method: "edahabia" (default) or "cib"

4. **Payment URL**
   - Checkout will return a checkout_url
   - Share this URL with customer
   - Customer completes payment on Chargily's secure page

5. **Webhook Confirmation**
   - You'll receive webhook at your endpoint when payment succeeds
   - Event type: checkout.paid

Execute these steps now and provide the payment URL.`
  },
  {
    name: "reconciliation_report",
    description: "Generate financial reconciliation report for accounting",
    arguments: {
      start_date: { type: "string", required: true, description: "Start date YYYY-MM-DD" },
      end_date: { type: "string", required: true, description: "End date YYYY-MM-DD" },
      include_fees: { type: "boolean", required: false, description: "Include fee breakdown" }
    },
    template: `You are a financial reconciliation specialist for Chargily Pay.

RECONCILIATION PERIOD: {{start_date}} to {{end_date}}

TASK: Generate a complete reconciliation report for accounting purposes.

DATA COLLECTION:
1. Fetch all transactions for the period using list_checkouts
2. Use chargily://reports/daily for each day in range
3. Get current balance from chargily://balance/current

RECONCILIATION REPORT STRUCTURE:

**1. Transaction Summary**
- Total transactions initiated
- Successful payments (paid status)
- Failed payments
- Canceled/expired checkouts
- Pending checkouts

**2. Financial Summary**
- Gross revenue (sum of successful payments)
{{#if include_fees}}
- Total Chargily fees
- Net revenue (after fees)
- Fee percentage
{{/if}}
- Refunds issued (if any)
- Net settlement amount

**3. Payment Method Breakdown**
- EDAHABIA transactions and amounts
- CIB transactions and amounts
- Chargily App transactions and amounts

**4. Daily Breakdown**
Table showing each day with:
- Date
- Transaction count
- Gross amount
- Net amount
- Success rate

**5. Exceptions & Adjustments**
- List any failed transactions
- Disputed amounts
- Pending settlements

**6. Reconciliation Verification**
- Beginning balance (if available)
- Plus: Total successful payments
- Minus: Fees and refunds
- Expected ending balance
- Actual ending balance from API
- Variance (should be 0)

Format as a formal accounting document suitable for financial records.`
  },
  {
    name: "fraud_signal_summary",
    description: "Analyze fraud signals and suspicious patterns",
    arguments: {
      time_period: { type: "string", required: false, description: "Time period to analyze: 24h, 7d, 30d (default: 24h)" },
      threshold: { type: "string", required: false, description: "Alert threshold: low, medium, high (default: medium)" }
    },
    template: `You are a fraud detection analyst for Chargily Pay.

ANALYSIS PERIOD: {{time_period}}
ALERT THRESHOLD: {{threshold}}

TASK: Identify and analyze potential fraud signals and suspicious patterns.

DATA SOURCES:
1. chargily://analytics/fraud-signals
2. Recent transactions from chargily://transactions/recent
3. Failed payment patterns
4. Customer behavior anomalies

FRAUD SIGNAL ANALYSIS:

**1. High-Risk Patterns**
Identify:
- Multiple failed payment attempts from same customer
- Unusual transaction amounts (significantly above average)
- Rapid succession of transactions
- Transactions from new customers with high values
- Payment methods switching (testing cards)

**2. Failure Rate Analysis**
- Overall failure rate
- Failure rate by payment method
- Failure rate by customer segment
- Time-based failure patterns

**3. Geographic Anomalies**
- Unusual locations (if available)
- VPN/proxy indicators
- Cross-border inconsistencies

**4. Customer Behavior**
- First-time customers with high-value orders
- Customers with multiple failed attempts
- Accounts with mismatched information

**5. Risk Scoring**
For each suspicious transaction:
- Risk level: LOW / MEDIUM / HIGH / CRITICAL
- Fraud indicators present
- Recommended action

**6. Recommendations**
- Immediate actions needed
- Additional verification steps
- Payment method restrictions
- Customer communication approach
- Long-term fraud prevention strategies

ALERT LEVELS:
- LOW: Monitor only
- MEDIUM: Review before settlement
- HIGH: Hold payment for manual review
- CRITICAL: Block transaction, contact customer

Generate detailed report with specific transaction IDs and actionable recommendations.`
  },
  {
    name: "monthly_business_review",
    description: "Comprehensive monthly business performance analysis",
    arguments: {
      month: { type: "string", required: true, description: "Month in YYYY-MM format" },
      compare_previous: { type: "boolean", required: false, description: "Compare with previous month" }
    },
    template: `You are a business intelligence analyst for Chargily Pay merchants.

REVIEW PERIOD: {{month}}

TASK: Generate comprehensive monthly business review with insights and recommendations.

DATA COLLECTION:
1. chargily://reports/monthly?month={{month}}
2. chargily://customers/top for customer insights
3. chargily://analytics/conversion for performance metrics
4. chargily://products/catalog for product performance

BUSINESS REVIEW STRUCTURE:

**EXECUTIVE SUMMARY**
- Key metrics at a glance
- Month-over-month growth
- Major achievements
- Critical issues

**1. REVENUE ANALYSIS**
- Total revenue and transaction volume
- Average transaction value
- Revenue by payment method
- Daily revenue trends
- Peak sales periods

**2. CUSTOMER INSIGHTS**
- New vs returning customers
- Top customers by spend
- Customer acquisition cost
- Customer lifetime value indicators
- Customer retention signals

**3. PRODUCT PERFORMANCE**
- Best-selling products/services
- Revenue by product category
- Product conversion rates
- Underperforming products

**4. OPERATIONAL METRICS**
- Payment success rate
- Average checkout completion time
- Payment method preferences
- Failed transaction analysis
- Refund rate

**5. GROWTH OPPORTUNITIES**
- Underutilized payment methods
- Customer segments to target
- Pricing optimization suggestions
- Cross-sell/upsell opportunities
- Marketing campaign ideas

**6. RISK & CHALLENGES**
- Fraud indicators
- Technical issues
- Customer complaints
- Competitive threats

**7. RECOMMENDATIONS**
Priority actions for next month:
1. [Most impactful action]
2. [Quick wins]
3. [Long-term strategies]

{{#if compare_previous}}
**MONTH-OVER-MONTH COMPARISON**
Compare all metrics with previous month and highlight:
- Significant improvements \u2713
- Areas of concern \u26A0\uFE0F
- Trends to monitor \u{1F441}\uFE0F
{{/if}}

Format as a professional business review suitable for stakeholders.`
  },
  {
    name: "refund_investigation",
    description: "Investigate refund request and determine eligibility",
    arguments: {
      checkout_id: { type: "string", required: true, description: "Checkout ID for refund" },
      refund_reason: { type: "string", required: false, description: "Reason for refund request" },
      requested_amount: { type: "number", required: false, description: "Partial refund amount in DZD cents" }
    },
    template: `You are a refund specialist for Chargily Pay.

REFUND REQUEST DETAILS:
- Checkout ID: {{checkout_id}}
{{#if refund_reason}}- Reason: {{refund_reason}}{{/if}}
{{#if requested_amount}}- Requested Amount: {{requested_amount / 100}} DZD{{/if}}

TASK: Investigate and process refund request following merchant policies.

INVESTIGATION WORKFLOW:

**1. Verify Transaction**
- Fetch checkout details using get_checkout tool
- Verify transaction status (must be "paid")
- Check transaction date (within refund window?)
- Original amount and payment method

**2. Eligibility Check**
\u2713 Transaction exists and is paid
\u2713 Within refund period (typically 30 days)
\u2713 No previous refund issued
\u2713 Merchant refund policy allows
{{#if requested_amount}}
\u2713 Partial refund amount \u2264 original amount
{{/if}}

**3. Customer Verification**
- Fetch customer details
- Check refund history
- Verify legitimacy of request
- Check for abuse patterns

**4. Refund Calculation**
{{#if requested_amount}}
- Requested: {{requested_amount / 100}} DZD
- Original: [fetch from checkout]
- Refund fees: [calculate based on policy]
{{else}}
- Full refund of original amount
- Chargily fees: [typically not refunded]
{{/if}}

**5. Processing**
If approved:
- Refund method: Original payment method
- Processing time: 5-7 business days (Algerian banks)
- Customer notification required
- Update transaction records

**6. Decision & Communication**

DECISION: [APPROVED / DENIED / REQUIRES MANAGER REVIEW]

REASONING:
[Detailed explanation of decision]

CUSTOMER COMMUNICATION:
[Draft email/message for customer]

MERCHANT ACTIONS:
[Steps merchant needs to take]

Note: Chargily Pay V2 API refund endpoints coming soon. For now, manual processing required.`
  },
  {
    name: "customer_lifecycle",
    description: "Analyze customer journey and lifecycle value",
    arguments: {
      customer_id: { type: "string", required: true, description: "Customer ID to analyze" },
      include_predictions: { type: "boolean", required: false, description: "Include predictive insights" }
    },
    template: `You are a customer analytics specialist for Chargily Pay.

CUSTOMER: {{customer_id}}

TASK: Comprehensive customer lifecycle analysis with actionable insights.

DATA COLLECTION:
1. chargily://customers/{{customer_id}} - Full customer profile
2. All transactions for this customer
3. Payment patterns and behavior

LIFECYCLE ANALYSIS:

**1. CUSTOMER PROFILE**
- Account created date
- Contact information
- Segment classification

**2. TRANSACTION HISTORY**
- First transaction date
- Most recent transaction
- Total transactions count
- Total amount spent
- Average order value
- Purchase frequency

**3. PAYMENT BEHAVIOR**
- Preferred payment method
- Success rate
- Failed attempts
- Refund history
- Average time to complete checkout

**4. VALUE METRICS**
- Lifetime value (LTV)
- Average purchase frequency
- Days since last purchase
- Customer tenure

**5. ENGAGEMENT PATTERNS**
- Active periods (days/times of transactions)
- Seasonal trends
- Product preferences
- Shopping cart patterns

**6. LIFECYCLE STAGE**
Classify customer as:
- NEW: 0-30 days, first purchase
- ACTIVE: Regular purchases, high engagement
- AT_RISK: No purchase in 30+ days
- CHURNED: No purchase in 90+ days
- VIP: Top 10% spender

**7. RISK ASSESSMENT**
- Churn probability
- Fraud risk score
- Payment failure risk

{{#if include_predictions}}
**8. PREDICTIVE INSIGHTS**
- Next purchase probability
- Predicted next purchase date
- Estimated next order value
- Recommended offers
- Churn prevention strategies
{{/if}}

**9. RECOMMENDATIONS**
Personalized actions:
- Re-engagement campaigns
- Upsell/cross-sell opportunities
- Loyalty rewards suggestions
- Payment method incentives
- Communication timing

Generate insights that merchants can act on immediately.`
  },
  {
    name: "payment_optimization",
    description: "Analyze payment flow and suggest optimizations",
    arguments: {
      focus_area: { type: "string", required: false, description: "Focus area: conversion, speed, methods, fees" },
      time_range: { type: "string", required: false, description: "Analysis time range: 7d, 30d, 90d (default: 30d)" }
    },
    template: `You are a payment optimization consultant for Chargily Pay.

OPTIMIZATION FOCUS: {{focus_area}}
ANALYSIS PERIOD: {{time_range}}

TASK: Analyze payment performance and provide actionable optimization recommendations.

DATA ANALYSIS:
1. chargily://analytics/conversion - Conversion metrics
2. chargily://reports/monthly - Revenue data
3. Recent transactions patterns
4. Payment method performance

OPTIMIZATION ANALYSIS:

**1. CONVERSION RATE OPTIMIZATION**
Current Performance:
- Overall conversion rate
- Conversion by payment method
- Checkout abandonment rate
- Failed payment rate

Recommendations:
- Checkout flow improvements
- Payment method additions
- Error message clarity
- Mobile optimization
- One-click payment options

**2. PROCESSING SPEED**
Performance Metrics:
- Average checkout completion time
- Payment processing latency
- Webhook delivery time

Speed Improvements:
- Cache optimization
- API call reduction
- Parallel processing opportunities
- Error handling improvements

**3. PAYMENT METHOD STRATEGY**
Current Mix:
- EDAHABIA usage %
- CIB usage %
- Chargily App usage %

Optimization:
- Underutilized method promotion
- Payment method routing
- Fallback strategies
- Local method preferences
- Cost-benefit analysis per method

**4. FEE OPTIMIZATION**
Cost Analysis:
- Total fees paid
- Fee percentage of revenue
- Fee by payment method
- Volume-based fee opportunities

Savings Strategies:
- Payment method selection
- Transaction batching
- Fee structure negotiation
- Cost allocation to customers

**5. TECHNICAL OPTIMIZATIONS**
- API usage efficiency
- Webhook reliability
- Error rate reduction
- Retry logic optimization
- Idempotency implementation

**6. USER EXPERIENCE**
- Checkout page improvements
- Mobile responsiveness
- Payment method display
- Error messaging
- Success confirmation

**7. FRAUD & SECURITY**
- Balance security with friction
- Risk-based authentication
- Payment limit optimization
- Fraud detection tuning

**PRIORITY RECOMMENDATIONS**
Ranked by impact and effort:

HIGH IMPACT, LOW EFFORT:
1. [Quick wins]

HIGH IMPACT, HIGH EFFORT:
1. [Strategic improvements]

QUICK FIXES:
1. [Immediate actions]

**IMPLEMENTATION ROADMAP**
Week 1: [Actions]
Week 2-4: [Actions]
Month 2-3: [Strategic initiatives]

**EXPECTED OUTCOMES**
- Conversion rate improvement: +X%
- Average transaction value: +X%
- Processing cost reduction: -X%
- Customer satisfaction: +X points

Generate specific, measurable recommendations with implementation guidance.`
  }
];

// src/schema-utils.ts
function zodToJsonSchema(schema) {
  const def = schema._def;
  const typeName = def.typeName;
  switch (typeName) {
    case "ZodObject": {
      const shape = def.shape();
      const properties = {};
      const required = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        const fieldDef = value._def;
        if (fieldDef.typeName !== "ZodOptional" && fieldDef.typeName !== "ZodDefault") {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        required: required.length > 0 ? required : void 0
      };
    }
    case "ZodString": {
      const result = { type: "string" };
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === "email") {
            result.format = "email";
          } else if (check.kind === "url") {
            result.format = "uri";
          } else if (check.kind === "regex") {
            result.pattern = check.regex.source;
          } else if (check.kind === "min") {
            result.minLength = check.value;
          } else if (check.kind === "max") {
            result.maxLength = check.value;
          }
        }
      }
      return result;
    }
    case "ZodNumber": {
      const result = { type: "number" };
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === "int") {
            result.type = "integer";
          } else if (check.kind === "min") {
            result.minimum = check.value;
          } else if (check.kind === "max") {
            result.maximum = check.value;
          }
        }
      }
      return result;
    }
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray": {
      const items = zodToJsonSchema(def.type);
      const result = { type: "array", items };
      if (def.minLength) {
        result.minItems = def.minLength.value;
      }
      if (def.maxLength) {
        result.maxItems = def.maxLength.value;
      }
      return result;
    }
    case "ZodEnum": {
      return {
        type: "string",
        enum: def.values
      };
    }
    case "ZodOptional":
      return zodToJsonSchema(def.innerType);
    case "ZodDefault": {
      const innerSchema = zodToJsonSchema(def.innerType);
      innerSchema.default = def.defaultValue();
      return innerSchema;
    }
    case "ZodRecord": {
      return {
        type: "object",
        additionalProperties: zodToJsonSchema(def.valueType)
      };
    }
    case "ZodUnion":
    case "ZodDiscriminatedUnion": {
      return {
        anyOf: def.options.map((option) => zodToJsonSchema(option))
      };
    }
    case "ZodLiteral": {
      return {
        type: typeof def.value,
        const: def.value
      };
    }
    case "ZodAny":
      return {};
    default:
      return { type: "object" };
  }
}

// src/server.ts
var ChargilyMCPServer = class {
  server;
  client;
  authContext;
  approvalConfig;
  additionalResources;
  constructor(config, authContext, approvalConfig, additionalResources) {
    this.client = new ChargilyClient(config);
    this.authContext = authContext;
    this.approvalConfig = approvalConfig;
    this.additionalResources = additionalResources || [];
    this.server = new Server(
      {
        name: "chargily-mcp-server",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );
    this.setupHandlers();
  }
  /**
   * Get all resources (core + additional)
   */
  get allResources() {
    return [...RESOURCES, ...this.additionalResources];
  }
  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: zodToJsonSchema(tool.inputSchema)
        }))
      };
    });
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = getTool(name);
      if (!tool) {
        throw new MCPError(
          "tool_not_found" /* TOOL_NOT_FOUND */,
          `Tool '${name}' not found`
        );
      }
      try {
        const validatedArgs = tool.inputSchema.parse(args);
        this.checkScopes(tool.scopes);
        await this.checkApproval(tool, validatedArgs);
        const result = await tool.handler(this.client, validatedArgs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        if (error instanceof MCPError) {
          throw error;
        }
        throw new MCPError(
          "upstream_error" /* CHARGILY_API_ERROR */,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    });
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: this.allResources.map((resource) => ({
          uri: resource.uriPattern.source,
          name: resource.description,
          description: resource.description,
          mimeType: "application/json"
        }))
      };
    });
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      for (const resource of this.allResources) {
        const match = uri.match(resource.uriPattern);
        if (match) {
          try {
            const params = {};
            const groups = match.slice(1);
            const patternStr = resource.uriPattern.source;
            const paramMatches = patternStr.matchAll(/\(([^)]+)\)/g);
            let i = 0;
            for (const _match of paramMatches) {
              if (groups[i]) {
                params[`param${i}`] = groups[i];
              }
              i++;
            }
            const result = await resource.handler(this.client, uri, params);
            return {
              contents: [
                {
                  uri,
                  mimeType: result.mimeType || "application/json",
                  text: typeof result.content === "string" ? result.content : JSON.stringify(result.content, null, 2)
                }
              ]
            };
          } catch (error) {
            throw new MCPError(
              "upstream_error" /* CHARGILY_API_ERROR */,
              `Failed to read resource: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }
      }
      throw new MCPError(
        "not_found" /* NOT_FOUND */,
        `Resource not found: ${uri}`
      );
    });
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: PROMPTS.map((prompt) => ({
          name: prompt.name,
          description: prompt.description,
          arguments: Object.entries(prompt.arguments).map(([name, config]) => ({
            name,
            description: config.description,
            required: config.required
          }))
        }))
      };
    });
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const prompt = PROMPTS.find((p) => p.name === name);
      if (!prompt) {
        throw new MCPError(
          "not_found" /* NOT_FOUND */,
          `Prompt '${name}' not found`
        );
      }
      for (const [argName, config] of Object.entries(prompt.arguments)) {
        if (config.required && (!args || !(argName in args))) {
          throw new MCPError(
            "invalid_input" /* VALIDATION_ERROR */,
            `Required argument '${argName}' missing for prompt '${name}'`
          );
        }
      }
      let renderedTemplate = prompt.template;
      const providedArgs = args || {};
      for (const [argName, value] of Object.entries(providedArgs)) {
        const placeholder = new RegExp(`\\{\\{\\s*${argName}\\s*\\}\\}`, "g");
        renderedTemplate = renderedTemplate.replace(placeholder, String(value));
      }
      return {
        description: prompt.description,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: renderedTemplate
            }
          }
        ]
      };
    });
  }
  /**
   * Check if user has required scopes
   */
  checkScopes(requiredScopes) {
    if (!this.authContext) {
      return;
    }
    const userScopes = this.authContext.scopes || [];
    if (userScopes.includes("admin") || userScopes.includes("*")) {
      return;
    }
    for (const requiredScope of requiredScopes) {
      const hasScope = userScopes.some((userScope) => {
        if (userScope === requiredScope) return true;
        if (userScope.endsWith(":*")) {
          const prefix = userScope.slice(0, -2);
          return requiredScope.startsWith(prefix + ":");
        }
        return false;
      });
      if (!hasScope) {
        throw new MCPError(
          "permission_denied" /* AUTHORIZATION_ERROR */,
          `Missing required scope: ${requiredScope}`,
          403
        );
      }
    }
  }
  /**
   * Check if operation requires approval
   */
  async checkApproval(tool, args) {
    if (!this.approvalConfig || !this.approvalConfig.enabled) {
      return;
    }
    const requiredTier = this.getRequiredApprovalTier(tool, args);
    if (requiredTier === "none") {
      return;
    }
    if (tool.scopes.every((s) => s.endsWith(":read"))) {
      return;
    }
    const amount = this.extractAmount(args);
    if (amount !== null) {
      const tier = this.calculateTierByAmount(amount);
      if (tier === "tier1") {
        return;
      }
      if (tier === "tier2" || tier === "tier3") {
        const approved = await this.requestApproval({
          tool: tool.name,
          args,
          amount,
          tier,
          userId: this.authContext?.userId,
          tenantId: this.authContext?.tenantId
        });
        if (!approved) {
          throw new MCPError(
            "permission_denied" /* AUTHORIZATION_ERROR */,
            `Operation requires ${tier} approval. Approval was denied or timed out.`,
            403
          );
        }
      }
    }
    if (tool.approvalTier === "tier3") {
      const approved = await this.requestApproval({
        tool: tool.name,
        args,
        amount: null,
        tier: "tier3",
        userId: this.authContext?.userId,
        tenantId: this.authContext?.tenantId
      });
      if (!approved) {
        throw new MCPError(
          "permission_denied" /* AUTHORIZATION_ERROR */,
          "Operation requires dual approval. Approval was denied or timed out.",
          403
        );
      }
    }
  }
  /**
   * Get required approval tier for a tool
   */
  getRequiredApprovalTier(tool, _args) {
    return tool.approvalTier;
  }
  /**
   * Extract amount from tool arguments
   */
  extractAmount(args) {
    if (args.amount !== void 0) {
      return args.amount;
    }
    return null;
  }
  /**
   * Calculate approval tier based on amount
   */
  calculateTierByAmount(amount) {
    if (!this.approvalConfig) {
      return "tier1";
    }
    if (amount < this.approvalConfig.tier1Max) {
      return "tier1";
    }
    if (amount < this.approvalConfig.tier2Max) {
      return "tier2";
    }
    return "tier3";
  }
  /**
   * Request approval for an operation
   */
  async requestApproval(request) {
    if (this.approvalConfig?.onApprovalRequired) {
      return await this.approvalConfig.onApprovalRequired(request);
    }
    console.warn("\u26A0\uFE0F  Approval required but no handler configured. Auto-approving for development.");
    return true;
  }
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Chargily MCP Server running on stdio");
  }
};
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = {
    apiKey: process.env.CHARGILY_API_KEY || "",
    mode: process.env.CHARGILY_MODE || "sandbox"
  };
  const server = new ChargilyMCPServer(config);
  server.start().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}
function verifyWebhookSignature(payload, signature, secret) {
  try {
    const expectedSignature = createHmac("sha256", secret).update(payload).digest("hex");
    return signature === expectedSignature;
  } catch {
    return false;
  }
}
function parseWebhookEvent(payload) {
  return JSON.parse(payload);
}
function isValidWebhookEvent(event) {
  return typeof event === "object" && typeof event.id === "string" && typeof event.type === "string" && typeof event.entity === "string" && typeof event.livemode === "boolean" && typeof event.data === "object" && typeof event.created_at === "number";
}
var ResourceSubscriptionManager = class extends EventEmitter {
  subscriptions;
  resourceCache;
  constructor() {
    super();
    this.subscriptions = /* @__PURE__ */ new Map();
    this.resourceCache = /* @__PURE__ */ new Map();
  }
  /**
   * Subscribe to resource updates
   */
  subscribe(uriPattern, callback) {
    const subscriptionId = this.generateId();
    const subscription = {
      id: subscriptionId,
      uriPattern,
      callback,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.subscriptions.set(subscriptionId, subscription);
    return subscriptionId;
  }
  /**
   * Unsubscribe from resource updates
   */
  unsubscribe(subscriptionId) {
    return this.subscriptions.delete(subscriptionId);
  }
  /**
   * Publish a resource update
   */
  publish(uri, resource, changeType = "updated") {
    const event = {
      uri,
      resource,
      timestamp: Date.now(),
      changeType
    };
    if (changeType === "deleted") {
      this.resourceCache.delete(uri);
    } else {
      this.resourceCache.set(uri, {
        data: resource,
        lastUpdated: event.timestamp
      });
    }
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesPattern(uri, subscription.uriPattern)) {
        try {
          subscription.callback(event);
        } catch (error) {
          console.error("Subscription callback error:", error);
        }
      }
    }
    this.emit("resource:update", event);
  }
  /**
   * Get all active subscriptions
   */
  getSubscriptions() {
    return Array.from(this.subscriptions.values());
  }
  /**
   * Get subscription count
   */
  getSubscriptionCount() {
    return this.subscriptions.size;
  }
  /**
   * Clear all subscriptions
   */
  clearAll() {
    this.subscriptions.clear();
    this.resourceCache.clear();
  }
  /**
   * Check if URI matches pattern
   */
  matchesPattern(uri, pattern) {
    if (typeof pattern === "string") {
      if (pattern.includes("*")) {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        return regex.test(uri);
      }
      return uri === pattern;
    }
    return pattern.test(uri);
  }
  /**
   * Generate unique subscription ID
   */
  generateId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  /**
   * Auto-invalidate resources based on webhook events
   */
  invalidateOnWebhook(eventType) {
    const invalidationRules = {
      "checkout.paid": [
        "chargily://transactions/recent",
        "chargily://reports/daily",
        "chargily://analytics/conversion",
        "chargily://balance/current"
      ],
      "checkout.failed": [
        "chargily://transactions/recent",
        "chargily://analytics/conversion",
        "chargily://analytics/fraud-signals"
      ],
      "checkout.canceled": [
        "chargily://transactions/recent",
        "chargily://analytics/conversion"
      ],
      "customer.created": [
        "chargily://customers/top"
      ],
      "customer.updated": [
        "chargily://customers/*"
      ]
    };
    const urisToInvalidate = invalidationRules[eventType] || [];
    for (const uri of urisToInvalidate) {
      this.publish(uri, null, "updated");
    }
  }
  /**
   * Get cached resource
   */
  getCached(uri) {
    const cached = this.resourceCache.get(uri);
    return cached ? cached.data : null;
  }
  /**
   * Check if resource is fresh
   */
  isFresh(uri, ttl) {
    const cached = this.resourceCache.get(uri);
    if (!cached) return false;
    const age = Date.now() - cached.lastUpdated;
    return age < ttl * 1e3;
  }
};
var subscriptionManager = new ResourceSubscriptionManager();
function watchResource(uri, callback) {
  const subscriptionId = subscriptionManager.subscribe(uri, callback);
  return () => {
    subscriptionManager.unsubscribe(subscriptionId);
  };
}
function watchResources(patterns, callback) {
  const subscriptionIds = patterns.map(
    (pattern) => subscriptionManager.subscribe(pattern, callback)
  );
  return () => {
    subscriptionIds.forEach((id) => subscriptionManager.unsubscribe(id));
  };
}

export { CancelCheckoutSchema, ChargilyClient, ChargilyMCPServer, CreateCheckoutSchema, CreateCustomerSchema, CreatePaymentLinkSchema, CreatePriceSchema, CreateProductSchema, DeleteCustomerSchema, DeleteProductSchema, ErrorCategory, ExpireCheckoutSchema, GetBalanceSchema, GetCheckoutSchema, GetCustomerSchema, GetPaymentLinkSchema, GetPriceSchema, GetProductSchema, ListCheckoutsSchema, ListCustomersSchema, ListPaymentLinksSchema, ListPricesSchema, ListProductsSchema, MCPError, PROMPTS, RESOURCES, ResourceSubscriptionManager, TOOLS, UpdateCustomerSchema, UpdatePaymentLinkSchema, UpdatePriceSchema, UpdateProductSchema, VerifyWebhookSchema, getCheckoutApprovalTier, getTool, isValidWebhookEvent, parseWebhookEvent, subscriptionManager, verifyWebhookSignature, watchResource, watchResources, zodToJsonSchema };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map