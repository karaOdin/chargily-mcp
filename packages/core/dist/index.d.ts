import { z } from 'zod';

/**
 * Core type definitions for Chargily MCP
 */
type Environment = 'sandbox' | 'production';
type PaymentMethod = 'edahabia' | 'cib' | 'chargily_app';
type CheckoutStatus = 'pending' | 'paid' | 'failed' | 'canceled' | 'expired';
type Currency = 'dzd' | 'eur' | 'usd';
type Locale = 'ar' | 'en' | 'fr';
type FeeAllocation = 'customer' | 'merchant' | 'split';
/**
 * Chargily API Configuration
 */
interface ChargilyConfig {
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
interface RetryConfig {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}
/**
 * Balance object
 */
interface Balance {
    id: string;
    entity: 'balance';
    livemode: boolean;
    current_balance: BalanceWallet[];
}
interface BalanceWallet {
    currency: Currency;
    amount: number;
    available_balance: number;
    on_hold: number;
}
/**
 * Customer object
 */
interface Customer {
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
interface CustomerAddress {
    address?: string;
    state?: string;
    country: string;
}
/**
 * Product object
 */
interface Product {
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
interface Price {
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
interface Checkout {
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
interface Discount {
    type: 'percentage' | 'amount';
    value: number;
}
/**
 * Payment Link object
 */
interface PaymentLink {
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
interface PaymentLinkItem {
    price_id: string;
    quantity: number;
}
/**
 * Paginated response
 */
interface PaginatedResponse<T> {
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
interface WebhookEvent {
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
interface ToolContext {
    config: ChargilyConfig;
    tenantId?: string;
    userId?: string;
    scopes: string[];
    requestId: string;
}
/**
 * MCP Resource URI
 */
type ResourceURI = `chargily://${string}`;
/**
 * Approval tier
 */
type ApprovalTier = 'none' | 'tier1' | 'tier2' | 'tier3';
/**
 * Audit log entry
 */
interface AuditLog {
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
declare enum ErrorCategory {
    AUTHENTICATION_ERROR = "auth_error",
    AUTHORIZATION_ERROR = "permission_denied",
    VALIDATION_ERROR = "invalid_input",
    NOT_FOUND = "not_found",
    CHARGILY_API_ERROR = "upstream_error",
    RATE_LIMIT_ERROR = "rate_limited",
    TIMEOUT_ERROR = "timeout",
    TOOL_NOT_FOUND = "tool_not_found",
    RESOURCE_UNAVAILABLE = "resource_unavailable"
}
/**
 * MCP Error
 */
declare class MCPError extends Error {
    category: ErrorCategory;
    statusCode?: number | undefined;
    retryable: boolean;
    constructor(category: ErrorCategory, message: string, statusCode?: number | undefined, retryable?: boolean);
}

/**
 * Chargily MCP Server
 * Main server implementation using @modelcontextprotocol/sdk
 */

declare class ChargilyMCPServer {
    private server;
    private client;
    constructor(config: ChargilyConfig);
    private setupHandlers;
    start(): Promise<void>;
}

/**
 * Chargily Pay API Client
 * Provides type-safe wrapper around Chargily Pay REST API
 */

declare class ChargilyClient {
    private baseUrl;
    private apiKey;
    private timeout;
    constructor(config: ChargilyConfig);
    /**
     * Make authenticated request to Chargily API
     */
    private request;
    private mapStatusToCategory;
    private isRetryable;
    getBalance(): Promise<Balance>;
    createCustomer(data: {
        name: string;
        email: string;
        phone?: string;
        address?: {
            address?: string;
            state?: string;
            country: string;
        };
        metadata?: Record<string, any>;
    }): Promise<Customer>;
    getCustomer(customerId: string): Promise<Customer>;
    listCustomers(params?: {
        page?: number;
        per_page?: number;
        email?: string;
        phone?: string;
    }): Promise<PaginatedResponse<Customer>>;
    updateCustomer(customerId: string, data: Partial<Omit<Customer, 'id' | 'entity' | 'livemode' | 'created_at' | 'updated_at'>>): Promise<Customer>;
    deleteCustomer(customerId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    createProduct(data: {
        name: string;
        description?: string;
        images?: string[];
        metadata?: Record<string, any>;
    }): Promise<Product>;
    getProduct(productId: string): Promise<Product>;
    listProducts(params?: {
        page?: number;
        per_page?: number;
    }): Promise<PaginatedResponse<Product>>;
    updateProduct(productId: string, data: Partial<Omit<Product, 'id' | 'entity' | 'livemode' | 'created_at' | 'updated_at'>>): Promise<Product>;
    deleteProduct(productId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    createPrice(data: {
        product_id: string;
        amount: number;
        currency: 'dzd';
        metadata?: Record<string, any>;
    }): Promise<Price>;
    getPrice(priceId: string): Promise<Price>;
    listPrices(params?: {
        product_id?: string;
        page?: number;
        per_page?: number;
    }): Promise<PaginatedResponse<Price>>;
    updatePrice(priceId: string, data: {
        metadata?: Record<string, any>;
    }): Promise<Price>;
    createCheckout(data: {
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
    }, idempotencyKey?: string): Promise<Checkout>;
    getCheckout(checkoutId: string): Promise<Checkout>;
    listCheckouts(params?: {
        page?: number;
        per_page?: number;
        status?: 'pending' | 'paid' | 'failed' | 'canceled' | 'expired';
        customer_id?: string;
        payment_method?: 'edahabia' | 'cib' | 'chargily_app';
    }): Promise<PaginatedResponse<Checkout>>;
    expireCheckout(checkoutId: string): Promise<Checkout>;
    createPaymentLink(data: {
        name: string;
        items: Array<{
            price_id: string;
            quantity: number;
        }>;
        collect_shipping_address?: boolean;
        locale?: 'ar' | 'en' | 'fr';
        pass_fees_to_customer?: boolean;
        metadata?: Record<string, any>;
    }): Promise<PaymentLink>;
    getPaymentLink(linkId: string): Promise<PaymentLink>;
    listPaymentLinks(params?: {
        page?: number;
        per_page?: number;
        active?: boolean;
    }): Promise<PaginatedResponse<PaymentLink>>;
    updatePaymentLink(linkId: string, data: {
        name?: string;
        active?: boolean;
        collect_shipping_address?: boolean;
        metadata?: Record<string, any>;
    }): Promise<PaymentLink>;
}

/**
 * MCP Tool definitions and handlers
 */

interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: z.ZodType<any>;
    scopes: string[];
    approvalTier: 'none' | 'tier1' | 'tier2' | 'tier3';
    rateLimit: number;
    handler: (client: ChargilyClient, args: any) => Promise<any>;
}
declare const TOOLS: ToolDefinition[];
/**
 * Get approval tier based on checkout amount
 */
declare function getCheckoutApprovalTier(amount: number): 'none' | 'tier1' | 'tier2' | 'tier3';
/**
 * Find tool by name
 */
declare function getTool(name: string): ToolDefinition | undefined;

/**
 * MCP Resource definitions
 * Resources provide read-only access to data via URI-based addressing
 */
interface ResourceDefinition {
    uriPattern: RegExp;
    description: string;
    scopes: string[];
    freshness: number;
    handler: (uri: string, params: Record<string, string>) => Promise<any>;
}
declare const RESOURCES: ResourceDefinition[];

/**
 * MCP Prompt Library
 * Pre-built prompt templates for common merchant tasks
 */
interface PromptDefinition {
    name: string;
    description: string;
    arguments: Record<string, {
        type: string;
        required: boolean;
        description?: string;
    }>;
    template: string;
}
declare const PROMPTS: PromptDefinition[];

/**
 * Zod schemas for MCP tool input validation
 */

declare const GetBalanceSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
declare const CreateCustomerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodObject<{
        address: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        country: z.ZodEnum<["dz"]>;
    }, "strip", z.ZodTypeAny, {
        country: "dz";
        address?: string | undefined;
        state?: string | undefined;
    }, {
        country: "dz";
        address?: string | undefined;
        state?: string | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    phone?: string | undefined;
    address?: {
        country: "dz";
        address?: string | undefined;
        state?: string | undefined;
    } | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    name: string;
    email: string;
    phone?: string | undefined;
    address?: {
        country: "dz";
        address?: string | undefined;
        state?: string | undefined;
    } | undefined;
    metadata?: Record<string, any> | undefined;
}>;
declare const GetCustomerSchema: z.ZodObject<{
    customer_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    customer_id: string;
}, {
    customer_id: string;
}>;
declare const ListCustomersSchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    per_page: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    phone?: string | undefined;
    page?: number | undefined;
    per_page?: number | undefined;
}, {
    email?: string | undefined;
    phone?: string | undefined;
    page?: number | undefined;
    per_page?: number | undefined;
}>;
declare const UpdateCustomerSchema: z.ZodObject<{
    customer_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodObject<{
        address: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        country: z.ZodEnum<["dz"]>;
    }, "strip", z.ZodTypeAny, {
        country: "dz";
        address?: string | undefined;
        state?: string | undefined;
    }, {
        country: "dz";
        address?: string | undefined;
        state?: string | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    customer_id: string;
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: {
        country: "dz";
        address?: string | undefined;
        state?: string | undefined;
    } | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    customer_id: string;
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: {
        country: "dz";
        address?: string | undefined;
        state?: string | undefined;
    } | undefined;
    metadata?: Record<string, any> | undefined;
}>;
declare const DeleteCustomerSchema: z.ZodObject<{
    customer_id: z.ZodString;
    reason: z.ZodEnum<["user_request", "gdpr_deletion", "duplicate", "fraud"]>;
}, "strip", z.ZodTypeAny, {
    customer_id: string;
    reason: "user_request" | "gdpr_deletion" | "duplicate" | "fraud";
}, {
    customer_id: string;
    reason: "user_request" | "gdpr_deletion" | "duplicate" | "fraud";
}>;
declare const CreateProductSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    metadata?: Record<string, any> | undefined;
    description?: string | undefined;
    images?: string[] | undefined;
}, {
    name: string;
    metadata?: Record<string, any> | undefined;
    description?: string | undefined;
    images?: string[] | undefined;
}>;
declare const GetProductSchema: z.ZodObject<{
    product_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    product_id: string;
}, {
    product_id: string;
}>;
declare const ListProductsSchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    per_page: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    per_page?: number | undefined;
}, {
    page?: number | undefined;
    per_page?: number | undefined;
}>;
declare const UpdateProductSchema: z.ZodObject<{
    product_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    product_id: string;
    name?: string | undefined;
    metadata?: Record<string, any> | undefined;
    description?: string | undefined;
    images?: string[] | undefined;
}, {
    product_id: string;
    name?: string | undefined;
    metadata?: Record<string, any> | undefined;
    description?: string | undefined;
    images?: string[] | undefined;
}>;
declare const DeleteProductSchema: z.ZodObject<{
    product_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    product_id: string;
}, {
    product_id: string;
}>;
declare const CreatePriceSchema: z.ZodObject<{
    product_id: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodEnum<["dzd"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    product_id: string;
    currency: "dzd";
    metadata?: Record<string, any> | undefined;
}, {
    amount: number;
    product_id: string;
    metadata?: Record<string, any> | undefined;
    currency?: "dzd" | undefined;
}>;
declare const GetPriceSchema: z.ZodObject<{
    price_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    price_id: string;
}, {
    price_id: string;
}>;
declare const ListPricesSchema: z.ZodObject<{
    product_id: z.ZodOptional<z.ZodString>;
    page: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    per_page: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    per_page?: number | undefined;
    product_id?: string | undefined;
}, {
    page?: number | undefined;
    per_page?: number | undefined;
    product_id?: string | undefined;
}>;
declare const UpdatePriceSchema: z.ZodObject<{
    price_id: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    price_id: string;
    metadata?: Record<string, any> | undefined;
}, {
    price_id: string;
    metadata?: Record<string, any> | undefined;
}>;
declare const CreateCheckoutSchema: z.ZodObject<{
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodEnum<["dzd"]>>;
    payment_method: z.ZodOptional<z.ZodDefault<z.ZodEnum<["edahabia", "cib", "chargily_app"]>>>;
    success_url: z.ZodString;
    failure_url: z.ZodOptional<z.ZodString>;
    customer_id: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    locale: z.ZodOptional<z.ZodDefault<z.ZodEnum<["ar", "en", "fr"]>>>;
    shipping_address: z.ZodOptional<z.ZodString>;
    collect_shipping_address: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    percentage_discount: z.ZodOptional<z.ZodNumber>;
    amount_discount: z.ZodOptional<z.ZodNumber>;
    chargily_pay_fees_allocation: z.ZodOptional<z.ZodDefault<z.ZodEnum<["customer", "merchant", "split"]>>>;
    webhook_endpoint: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    currency: "dzd";
    success_url: string;
    metadata?: Record<string, any> | undefined;
    description?: string | undefined;
    customer_id?: string | undefined;
    payment_method?: "edahabia" | "cib" | "chargily_app" | undefined;
    failure_url?: string | undefined;
    locale?: "ar" | "en" | "fr" | undefined;
    shipping_address?: string | undefined;
    collect_shipping_address?: boolean | undefined;
    percentage_discount?: number | undefined;
    amount_discount?: number | undefined;
    chargily_pay_fees_allocation?: "customer" | "merchant" | "split" | undefined;
    webhook_endpoint?: string | undefined;
}, {
    amount: number;
    success_url: string;
    metadata?: Record<string, any> | undefined;
    description?: string | undefined;
    customer_id?: string | undefined;
    currency?: "dzd" | undefined;
    payment_method?: "edahabia" | "cib" | "chargily_app" | undefined;
    failure_url?: string | undefined;
    locale?: "ar" | "en" | "fr" | undefined;
    shipping_address?: string | undefined;
    collect_shipping_address?: boolean | undefined;
    percentage_discount?: number | undefined;
    amount_discount?: number | undefined;
    chargily_pay_fees_allocation?: "customer" | "merchant" | "split" | undefined;
    webhook_endpoint?: string | undefined;
}>;
declare const GetCheckoutSchema: z.ZodObject<{
    checkout_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    checkout_id: string;
}, {
    checkout_id: string;
}>;
declare const ListCheckoutsSchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    per_page: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodEnum<["pending", "paid", "failed", "canceled", "expired"]>>;
    customer_id: z.ZodOptional<z.ZodString>;
    payment_method: z.ZodOptional<z.ZodEnum<["edahabia", "cib", "chargily_app"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "paid" | "failed" | "canceled" | "expired" | undefined;
    customer_id?: string | undefined;
    page?: number | undefined;
    per_page?: number | undefined;
    payment_method?: "edahabia" | "cib" | "chargily_app" | undefined;
}, {
    status?: "pending" | "paid" | "failed" | "canceled" | "expired" | undefined;
    customer_id?: string | undefined;
    page?: number | undefined;
    per_page?: number | undefined;
    payment_method?: "edahabia" | "cib" | "chargily_app" | undefined;
}>;
declare const CancelCheckoutSchema: z.ZodObject<{
    checkout_id: z.ZodString;
    reason: z.ZodEnum<["customer_request", "fraud_suspicion", "duplicate", "other"]>;
}, "strip", z.ZodTypeAny, {
    reason: "duplicate" | "customer_request" | "fraud_suspicion" | "other";
    checkout_id: string;
}, {
    reason: "duplicate" | "customer_request" | "fraud_suspicion" | "other";
    checkout_id: string;
}>;
declare const ExpireCheckoutSchema: z.ZodObject<{
    checkout_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    checkout_id: string;
}, {
    checkout_id: string;
}>;
declare const CreatePaymentLinkSchema: z.ZodObject<{
    name: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        price_id: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        price_id: string;
        quantity: number;
    }, {
        price_id: string;
        quantity: number;
    }>, "many">;
    collect_shipping_address: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    locale: z.ZodOptional<z.ZodDefault<z.ZodEnum<["ar", "en", "fr"]>>>;
    pass_fees_to_customer: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    items: {
        price_id: string;
        quantity: number;
    }[];
    metadata?: Record<string, any> | undefined;
    locale?: "ar" | "en" | "fr" | undefined;
    collect_shipping_address?: boolean | undefined;
    pass_fees_to_customer?: boolean | undefined;
}, {
    name: string;
    items: {
        price_id: string;
        quantity: number;
    }[];
    metadata?: Record<string, any> | undefined;
    locale?: "ar" | "en" | "fr" | undefined;
    collect_shipping_address?: boolean | undefined;
    pass_fees_to_customer?: boolean | undefined;
}>;
declare const GetPaymentLinkSchema: z.ZodObject<{
    payment_link_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    payment_link_id: string;
}, {
    payment_link_id: string;
}>;
declare const ListPaymentLinksSchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    per_page: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    per_page?: number | undefined;
    active?: boolean | undefined;
}, {
    page?: number | undefined;
    per_page?: number | undefined;
    active?: boolean | undefined;
}>;
declare const UpdatePaymentLinkSchema: z.ZodObject<{
    payment_link_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    active: z.ZodOptional<z.ZodBoolean>;
    collect_shipping_address: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    payment_link_id: string;
    name?: string | undefined;
    metadata?: Record<string, any> | undefined;
    collect_shipping_address?: boolean | undefined;
    active?: boolean | undefined;
}, {
    payment_link_id: string;
    name?: string | undefined;
    metadata?: Record<string, any> | undefined;
    collect_shipping_address?: boolean | undefined;
    active?: boolean | undefined;
}>;
declare const VerifyWebhookSchema: z.ZodObject<{
    payload: z.ZodString;
    signature: z.ZodString;
    secret: z.ZodString;
}, "strip", z.ZodTypeAny, {
    payload: string;
    signature: string;
    secret: string;
}, {
    payload: string;
    signature: string;
    secret: string;
}>;

export { type ApprovalTier, type AuditLog, type Balance, type BalanceWallet, CancelCheckoutSchema, ChargilyClient, type ChargilyConfig, ChargilyMCPServer, type Checkout, type CheckoutStatus, CreateCheckoutSchema, CreateCustomerSchema, CreatePaymentLinkSchema, CreatePriceSchema, CreateProductSchema, type Currency, type Customer, type CustomerAddress, DeleteCustomerSchema, DeleteProductSchema, type Discount, type Environment, ErrorCategory, ExpireCheckoutSchema, type FeeAllocation, GetBalanceSchema, GetCheckoutSchema, GetCustomerSchema, GetPaymentLinkSchema, GetPriceSchema, GetProductSchema, ListCheckoutsSchema, ListCustomersSchema, ListPaymentLinksSchema, ListPricesSchema, ListProductsSchema, type Locale, MCPError, PROMPTS, type PaginatedResponse, type PaymentLink, type PaymentLinkItem, type PaymentMethod, type Price, type Product, type PromptDefinition, RESOURCES, type ResourceDefinition, type ResourceURI, type RetryConfig, TOOLS, type ToolContext, type ToolDefinition, UpdateCustomerSchema, UpdatePaymentLinkSchema, UpdatePriceSchema, UpdateProductSchema, VerifyWebhookSchema, type WebhookEvent, getCheckoutApprovalTier, getTool };
