import { getEndpointTypeByPath } from "@buydy/iso-business-types";
import logger from "@buydy/se-logger";

/**
 * EODHD API Usage Tracker
 * Tracks all API requests for monitoring and analytics
 */
export class EodhdApiUsageTracker {
  constructor() {
    this.model = null;
    this.initializeModel();
  }

  async initializeModel() {
    // API usage tracking is now handled via cached_response_eodhistoricaldata collection
    // This tracker is deprecated and disabled
    this.model = null;
    logger.business(
      "API usage tracking via EodhdApiUsageTracker is disabled. Use cached_response_eodhistoricaldata collection instead."
    );
  }

  /**
   * Track an API request
   * @param {Object} requestData - Request information
   * @param {Object} responseData - Response information
   * @param {Object} options - Additional options
   */
  async trackRequest(requestData, responseData) {
    // Try to initialize model if not available
    if (!this.model) {
      await this.initializeModel();
      if (!this.model) {
        // Silently skip tracking if model is not available
        return;
      }
    }

    // Use setImmediate to make tracking non-blocking
    setImmediate(async () => {
      try {
        const {
          method = "GET",
          url,
          params = {},
          jobName = null,
          clientId = "eodhd-client",
          cacheKey = null,
          cacheTtl = null,
          isCached = false,
        } = requestData;

        const {
          statusCode,
          responseTime,
          responseSize = 0,
          error = null,
          errorDetails = null,
          rateLimit = null,
        } = responseData;

        // Extract endpoint from URL
        const endpoint = this.extractEndpoint(url);

        // Determine if request was successful
        const isSuccess = statusCode >= 200 && statusCode < 300;

        // Create usage record
        const usageRecord = {
          endpoint,
          method,
          url,
          params,
          statusCode,
          isSuccess,
          isCached,
          responseTime,
          responseSize,
          error,
          errorDetails,
          jobName,
          clientId,
          requestedAt: new Date(),
          respondedAt: new Date(),
          cacheKey,
          cacheTtl,
          rateLimit,
        };

        // Save to database
        await this.model.create(usageRecord);

        // Log for debugging (optional)
        if (process.env.NODE_ENV === "development") {
          logger.debug(
            `${method} ${endpoint} - ${statusCode} (${responseTime}ms) ${
              isCached ? "[CACHED]" : ""
            } [URL: ${url}]`
          );
        }
      } catch (error) {
        logger.business("Failed to track request", { error: error.message });
      }
    });
  }

  /**
   * Extract endpoint name from URL using the endpoint types enum
   * @param {string} url - Full URL or relative path
   * @returns {string} Endpoint display name
   */
  extractEndpoint(url) {
    if (!url) return "unknown";

    try {
      let path = url;

      // Handle both full URLs and relative paths
      if (url.startsWith("http")) {
        const urlObj = new URL(url);
        path = urlObj.pathname;
      } else if (url.startsWith("/")) {
        path = url.substring(1); // Remove leading slash
      }

      // Extract the main endpoint (first part of path)
      const parts = path.split("/");
      const endpointPath = parts[0] || "unknown";

      // Look up endpoint type from enum
      const endpointType = getEndpointTypeByPath(endpointPath);

      if (endpointType) {
        return endpointType.displayName;
      }

      // Fallback to the path if not found in enum
      return endpointPath;
    } catch (error) {
      logger.business("Failed to extract endpoint from URL", { url });
      return "unknown";
    }
  }

  /**
   * Get usage statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStats(filters = {}) {
    if (!this.model) {
      await this.initializeModel();
      if (!this.model) {
        throw new Error("EODHD API Usage model not available");
      }
    }

    const results = await this.model.getUsageStats(filters);
    return (
      results[0] || {
        totalRequests: 0,
        cachedRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        cacheHitRate: 0,
        successRate: 0,
        avgResponseTime: 0,
        totalResponseSize: 0,
        uniqueEndpoints: 0,
      }
    );
  }

  /**
   * Get endpoint-specific statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Endpoint statistics
   */
  async getEndpointStats(filters = {}) {
    if (!this.model) {
      await this.initializeModel();
      if (!this.model) {
        throw new Error("EODHD API Usage model not available");
      }
    }

    return await this.model.getEndpointStats(filters);
  }

  /**
   * Get recent usage records
   * @param {number} limit - Number of records to return
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Recent usage records
   */
  async getRecentUsage(limit = 100, filters = {}) {
    if (!this.model) {
      await this.initializeModel();
      if (!this.model) {
        throw new Error("EODHD API Usage model not available");
      }
    }

    return await this.model.getRecentUsage(limit, filters);
  }
}

// Create singleton instance
export const eodhdApiUsageTracker = new EodhdApiUsageTracker();
