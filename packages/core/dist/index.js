import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ListPromptsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { fetch } from 'undici';
import { z } from 'zod';

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
  {
    uriPattern: /^chargily:\/\/balance\/current$/,
    description: "Current account balance across all wallets",
    scopes: ["balance:read"],
    freshness: 30,
    handler: async () => {
      return { uri: "chargily://balance/current", mimeType: "application/json", content: {} };
    }
  },
  {
    uriPattern: /^chargily:\/\/transactions\/([a-z0-9_]+)$/,
    description: "Single transaction details",
    scopes: ["checkouts:read"],
    freshness: Infinity,
    // Immutable
    handler: async (uri, _params) => {
      return { uri, mimeType: "application/json", content: {} };
    }
  }
  // Additional resources defined in MCP_RESOURCES.md
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
3. If include_customer_history is true, fetch customer details and recent transactions
4. Check for common failure patterns
5. Review similar failures in the last 24 hours

Provide a structured report with root cause analysis, customer history, and recommended actions.`
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

Include key metrics, revenue breakdown by payment method, issues & alerts, and actionable insights.`
  }
  // Additional prompts defined in MCP_PROMPTS.md
];

// src/server.ts
var ChargilyMCPServer = class {
  server;
  client;
  constructor(config) {
    this.client = new ChargilyClient(config);
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
  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: "object",
            properties: {}
            // Would be derived from zod schema
          }
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
        resources: RESOURCES.map((resource) => ({
          uri: resource.uriPattern.source,
          name: resource.description,
          description: resource.description,
          mimeType: "application/json"
        }))
      };
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

export { CancelCheckoutSchema, ChargilyClient, ChargilyMCPServer, CreateCheckoutSchema, CreateCustomerSchema, CreatePaymentLinkSchema, CreatePriceSchema, CreateProductSchema, DeleteCustomerSchema, DeleteProductSchema, ErrorCategory, ExpireCheckoutSchema, GetBalanceSchema, GetCheckoutSchema, GetCustomerSchema, GetPaymentLinkSchema, GetPriceSchema, GetProductSchema, ListCheckoutsSchema, ListCustomersSchema, ListPaymentLinksSchema, ListPricesSchema, ListProductsSchema, MCPError, PROMPTS, RESOURCES, TOOLS, UpdateCustomerSchema, UpdatePaymentLinkSchema, UpdatePriceSchema, UpdateProductSchema, VerifyWebhookSchema, getCheckoutApprovalTier, getTool };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map