import { getHttpClientSingleton, createHttpClient } from "@buydy/iso-http-client";
import { StocksAPI } from "./apis/stocks.js";
import { DividendsAPI } from "./apis/dividends.js";
import { SearchAPI } from "./apis/search.js";
import { OptionsAPI } from "./apis/options.js";
import { NewsAPI } from "./apis/news.js";
import { ForexAPI } from "./apis/forex.js";
import { IndicesAPI } from "./apis/indices.js";
import { eodhdApiUsageTracker } from "./apiUsageTracker.js";
import logger from "@buydy/se-logger";

/**
 * Base EODHD Client (copied to avoid circular imports)
 */
class EODHDClient {
  constructor({
    apiKey,
    baseURL = "https://eodhistoricaldata.com/api",
    timeout = 30000,
    axiosConfig = {},
    maxCallsPerMin = 1000,
    httpClient,
    useSingletonClient = true,
  }) {
    if (!apiKey) {
      throw new Error("EODHDClient requires an API key");
    }

    this.apiKey = apiKey;
    this.baseURL = baseURL;

    // Create or inject axios instance with default configuration
    if (httpClient) {
      this.axios = httpClient;
    } else if (useSingletonClient) {
      this.axios = getHttpClientSingleton({
        baseURL,
        timeout,
        defaultParams: { api_token: apiKey, fmt: "json" },
        axiosConfig,
      });
    } else {
      this.axios = createHttpClient({
        baseURL,
        timeout,
        defaultParams: { api_token: apiKey, fmt: "json" },
        axiosConfig,
      });
    }

    // Global concurrency control via AsyncPriorityQueue singleton (if available in host app)
    let globalQueue = null;
    try {
      // Dynamic import to avoid hard dependency for library consumers
      const maybeQueue = globalThis.__BUYDY_API_PRIORITY_QUEUE__;
      if (maybeQueue && typeof maybeQueue.addTask === "function") {
        globalQueue = maybeQueue;
        logger.business(`🚀 Global API queue detected, enabling queueing for all requests`);
      }
    } catch (error) {
      logger.business(`⚠️  Failed to setup global queue integration`, { error: error.message });
    }

    // Enhanced rate limiter with 429 handling and safety buffer
    this._maxCallsPerMin = Number(maxCallsPerMin) > 0 ? Number(maxCallsPerMin) : 0;

    // Apply 50% safety buffer to prevent hitting rate limits (more conservative)
    const safetyBuffer = 0.5; // Use only 50% of the allowed rate
    const effectiveMaxCalls = Math.floor(this._maxCallsPerMin * safetyBuffer);

    this._minIntervalMs = effectiveMaxCalls > 0 ? Math.ceil(60000 / effectiveMaxCalls) : 0;
    // Add minimum delay of 200ms between requests to be extra conservative
    this._minIntervalMs = Math.max(this._minIntervalMs, 200);
    this._nextAllowedAt = 0;
    this._rateLimitBackoff = 0; // Track rate limit backoff
    this._consecutiveRateLimits = 0; // Track consecutive 429 errors

    logger.business(
      `Initialized with rate limit: ${this._maxCallsPerMin} calls/min (effective: ${effectiveMaxCalls}, interval: ${this._minIntervalMs}ms)`
    );

    // Setup axios interceptors for error handling and rate limiting
    this.axios.interceptors.request.use(
      async (config) => {
        // Apply rate limiting
        await this._applyRateLimit();
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.axios.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const statusCode = error.response?.status;
        const errorType = error.code || "UNKNOWN";

        // Handle rate limiting (429)
        if (statusCode === 429) {
          this._consecutiveRateLimits++;
          const backoffMs = Math.min(60000 * this._consecutiveRateLimits, 300000); // Max 5 minutes
          this._rateLimitBackoff = Date.now() + backoffMs;

          logger.business(`🚫 Rate limited (429) - backing off for ${backoffMs}ms`, {
            consecutiveRateLimits: this._consecutiveRateLimits,
            nextRequestAllowedIn: Math.ceil(backoffMs / 1000),
          });

          // If we have a global queue, let it handle the retry
          if (globalQueue) {
            logger.business(`🔄 Queuing request for retry after backoff`);
            return Promise.reject(error);
          }
        } else {
          // Reset consecutive rate limits on successful requests
          if (this._consecutiveRateLimits > 0) {
            logger.business(`✅ Rate limiting reset after successful request`);
            this._consecutiveRateLimits = 0;
          }
        }

        // Add context for other common error types
        if (errorType === "TIMEOUT") {
          logger.business(`⏰ Timeout after ${error.config?.timeout || "default"}ms`);
        } else if (errorType === "CLIENT_ERROR" && statusCode === 401) {
          logger.business(`🔑 Authentication failed - check API key`);
        } else if (errorType === "CLIENT_ERROR" && statusCode === 404) {
          logger.business(`🔍 Resource not found - check symbol/exchange format`);
        }

        return Promise.reject(error);
      }
    );

    // Initialize API modules
    this.stocks = new StocksAPI(this.axios);
    this.dividends = new DividendsAPI(this.axios);
    this.search = new SearchAPI(this.axios);
    this.options = new OptionsAPI(this.axios);
    this.news = new NewsAPI(this.axios);
    this.forex = new ForexAPI(this.axios);
    this.indices = new IndicesAPI(this.axios);
  }

  /**
   * Apply rate limiting with backoff support and dynamic adjustment
   * @private
   */
  async _applyRateLimit() {
    const now = Date.now();

    // Check if we're in a rate limit backoff period
    if (this._rateLimitBackoff > now) {
      const backoffMs = this._rateLimitBackoff - now;
      logger.debug(`⏳ Rate limit backoff: waiting ${backoffMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    // Apply dynamic rate limiting based on consecutive rate limits
    let intervalMs = this._minIntervalMs;

    // If we've hit rate limits recently, be more conservative
    if (this._consecutiveRateLimits > 0) {
      const conservativeMultiplier = Math.min(2 + this._consecutiveRateLimits * 0.5, 5); // Max 5x slower
      intervalMs = Math.ceil(this._minIntervalMs * conservativeMultiplier);

      if (this._consecutiveRateLimits === 1) {
        logger.business(
          `🛡️  Applying conservative rate limiting (${conservativeMultiplier.toFixed(
            1
          )}x slower) after rate limit`
        );
      }
    }

    // Apply rate limiting
    if (intervalMs > 0) {
      const waitMs = Math.max(0, this._nextAllowedAt - now);
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
      this._nextAllowedAt = Date.now() + intervalMs;
    }
  }

  /**
   * Test API connection and key validity
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      const response = await this.axios.get("/exchanges-list", {
        params: { api_token: this.apiKey },
      });
      return response.status === 200;
    } catch (error) {
      logger.business("EODHD connection test failed", { error: error.message });
      return false;
    }
  }

  /**
   * Get account usage information
   * @returns {Promise<Object>} Account usage data
   */
  async getAccountUsage() {
    try {
      const response = await this.axios.get("/user", {
        params: { api_token: this.apiKey },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get account usage: ${error.message}`);
    }
  }
}

/**
 * EODHD Client with API Usage Tracking
 * Wraps the original EODHD client to track all API requests
 */
export class TrackedEODHDClient extends EODHDClient {
  constructor(config) {
    super(config);
    this.usageTracker = eodhdApiUsageTracker;
    this.jobName = config.jobName || null;
    this.clientId = config.clientId || "eodhd-tracked-client";

    // Override the axios instance to intercept requests
    this.setupRequestInterceptors();
  }

  /**
   * Setup request and response interceptors to track API usage
   */
  setupRequestInterceptors() {
    // Request interceptor to capture request start time
    this.axios.interceptors.request.use(
      (config) => {
        config.metadata = {
          startTime: Date.now(),
          requestId: Math.random().toString(36).substring(7),
        };
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to track successful responses
    this.axios.interceptors.response.use(
      (response) => {
        this.trackResponse(response, null);
        return response;
      },
      (error) => {
        this.trackResponse(null, error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Track API response
   * @param {Object} response - Axios response object
   * @param {Object} error - Axios error object
   */
  async trackResponse(response, error) {
    try {
      const config = response?.config || error?.config;
      if (!config || !config.metadata) return;

      const { startTime } = config.metadata;
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Extract request information
      const requestData = {
        method: config.method?.toUpperCase() || "GET",
        url: config.url || "",
        params: config.params || {},
        jobName: this.jobName,
        clientId: this.clientId,
        cacheKey: config.cacheKey || null,
        cacheTtl: config.cacheTtl || null,
        isCached: config.isCached || false,
      };

      // Extract response information
      const responseData = {
        statusCode: response?.status || error?.response?.status || 0,
        responseTime,
        responseSize: this.calculateResponseSize(response),
        error: error?.message || null,
        errorDetails: error?.response?.data || null,
        rateLimit: this.extractRateLimit(response),
      };

      // Track the request
      await this.usageTracker.trackRequest(requestData, responseData);
    } catch (trackingError) {
      logger.business("Failed to track response", { error: trackingError.message });
    }
  }

  /**
   * Calculate response size in bytes
   * @param {Object} response - Axios response object
   * @returns {number} Response size in bytes
   */
  calculateResponseSize(response) {
    if (!response) return 0;

    try {
      // Try to get content-length header
      const contentLength = response.headers?.["content-length"];
      if (contentLength) {
        return parseInt(contentLength, 10);
      }

      // Fallback: estimate size from response data
      if (response.data) {
        const dataString = JSON.stringify(response.data);
        return new Blob([dataString]).size;
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Extract rate limit information from response headers
   * @param {Object} response - Axios response object
   * @returns {Object|null} Rate limit information
   */
  extractRateLimit(response) {
    if (!response?.headers) return null;

    try {
      const headers = response.headers;
      const rateLimit = {};

      // Common rate limit headers
      if (headers["x-ratelimit-remaining"]) {
        rateLimit.remaining = parseInt(headers["x-ratelimit-remaining"], 10);
      }
      if (headers["x-ratelimit-reset"]) {
        rateLimit.reset = new Date(parseInt(headers["x-ratelimit-reset"], 10) * 1000);
      }
      if (headers["x-ratelimit-limit"]) {
        rateLimit.limit = parseInt(headers["x-ratelimit-limit"], 10);
      }

      return Object.keys(rateLimit).length > 0 ? rateLimit : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get usage statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStats(filters = {}) {
    return await this.usageTracker.getUsageStats(filters);
  }

  /**
   * Get endpoint-specific statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Endpoint statistics
   */
  async getEndpointStats(filters = {}) {
    return await this.usageTracker.getEndpointStats(filters);
  }

  /**
   * Get recent usage records
   * @param {number} limit - Number of records to return
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Recent usage records
   */
  async getRecentUsage(limit = 100, filters = {}) {
    return await this.usageTracker.getRecentUsage(limit, filters);
  }
}

/**
 * Create a tracked EODHD client instance
 * @param {Object} config - Client configuration
 * @returns {TrackedEODHDClient} Tracked client instance
 */
export function createTrackedEODHDClient(config) {
  return new TrackedEODHDClient(config);
}

export default TrackedEODHDClient;
