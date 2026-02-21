import { getHttpClientSingleton, createHttpClient } from "@buydy/iso-http-client";
import { StocksAPI } from "./apis/stocks.js";
import { DividendsAPI } from "./apis/dividends.js";
import { SearchAPI } from "./apis/search.js";
import { OptionsAPI } from "./apis/options.js";
import { NewsAPI } from "./apis/news.js";
import { ForexAPI } from "./apis/forex.js";
import { IndicesAPI } from "./apis/indices.js";
import { TrackedEODHDClient, createTrackedEODHDClient } from "./trackedClient.js";
import { eodhdApiUsageTracker } from "./apiUsageTracker.js";
import logger from "@buydy/se-logger";

/**
 * EODHD API Client - Comprehensive financial data access
 *
 * @example
 * ```javascript
 * import { EODHDClient } from '@buydy/se-eodhd';
 *
 * const client = new EODHDClient({
 *   apiKey: 'your-api-key',
 *   baseURL: 'https://eodhistoricaldata.com/api',
 *   maxCallsPerMin: 1000
 * });
 *
 * // Get stock data
 * const stockData = await client.stocks.getEODData('AAPL.US', '2024-01-01', '2024-01-31');
 *
 * // Search for stocks
 * const searchResults = await client.search.searchStocks('Apple');
 * ```
 */
export class EODHDClient {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - EODHD API key
   * @param {string} [config.baseURL='https://eodhistoricaldata.com/api'] - Base API URL
   * @param {number} [config.timeout=30000] - Request timeout in milliseconds
   * @param {Object} [config.axiosConfig] - Additional axios configuration
   * @param {number} [config.maxCallsPerMin=1000] - Maximum number of requests per minute; requests are spaced evenly
   */
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
      `🛡️  Rate limiter configured: ${effectiveMaxCalls}/${this._maxCallsPerMin} calls/min (${(
        safetyBuffer * 100
      ).toFixed(0)}% with safety buffer)`
    );

    // Add request interceptor for queueing and rate limiting
    this.axios.interceptors.request.use(
      async (config) => {
        // If global queue is available, queue the request
        if (globalQueue) {
          return globalQueue.addTask(async () => {
            await this._applyRateLimit();
            if (process.env.EODHD_VERBOSE_LOGGING === "true") {
              logger.debug(`${config.method?.toUpperCase()} ${config.url}`);
            }
            return config;
          });
        } else {
          // No global queue, just do rate limiting
          await this._applyRateLimit();
          if (process.env.EODHD_VERBOSE_LOGGING === "true") {
            logger.debug(`${config.method?.toUpperCase()} ${config.url}`);
          }
          return config;
        }
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for comprehensive error handling
    this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Extract request details
        const requestUrl = error.config?.url || "unknown";
        const requestMethod = error.config?.method?.toUpperCase() || "UNKNOWN";
        const requestParams = error.config?.params || {};

        // Extract error details
        const statusCode = error.response?.status;
        const statusText = error.response?.statusText;
        const responseData = error.response?.data;
        const errorMessage = error.message;
        const errorCode = error.code;

        // Determine error type
        let errorType = "UNKNOWN";
        if (error.code === "ECONNABORTED") {
          errorType = "TIMEOUT";
        } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
          errorType = "NETWORK";
        } else if (statusCode >= 400 && statusCode < 500) {
          errorType = "CLIENT_ERROR";
        } else if (statusCode >= 500) {
          errorType = "SERVER_ERROR";
        } else if (statusCode) {
          errorType = "HTTP_ERROR";
        }

        // Log comprehensive error information
        logger.business(`❌ API Request Failed`, {
          url: `${requestMethod} ${requestUrl}`,
          params: requestParams,
          errorType,
          status: `${statusCode || "N/A"} ${statusText || ""}`,
          message: errorMessage,
          code: errorCode,
          responseData: responseData,
        });

        // Handle 429 rate limit errors with retry logic
        if (errorType === "CLIENT_ERROR" && statusCode === 429) {
          this._consecutiveRateLimits++;
          const backoffMs = Math.min(1000 * Math.pow(2, this._consecutiveRateLimits), 30000); // Exponential backoff, max 30s

          logger.business(`🚫 Rate limit exceeded (attempt ${this._consecutiveRateLimits})`, {
            backoffMs,
          });

          // Apply backoff to future requests
          this._rateLimitBackoff = Date.now() + backoffMs;

          // If this is a retryable request, retry after backoff
          if (error.config && !error.config._retryCount) {
            error.config._retryCount = 0;
          }

          if (error.config && error.config._retryCount < 3) {
            error.config._retryCount++;
            logger.business(`🔄 Retrying request (${error.config._retryCount}/3)`);

            // Wait for backoff period
            await new Promise((resolve) => setTimeout(resolve, backoffMs));

            // Retry the request
            return this.axios.request(error.config);
          } else {
            logger.business(`❌ Max retries exceeded for rate limit`);
          }
        } else if (statusCode !== 429) {
          // Reset consecutive rate limits on successful requests or other errors
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

// Export individual API classes for direct usage
export { StocksAPI, DividendsAPI, SearchAPI, OptionsAPI, NewsAPI, ForexAPI, IndicesAPI };

// Export tracked client and usage tracker
export { TrackedEODHDClient, createTrackedEODHDClient, eodhdApiUsageTracker };

// Export default as the main client
export default EODHDClient;
