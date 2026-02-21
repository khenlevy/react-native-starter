import { EODHDClient } from "@buydy/se-eodhd";
import { getDatabase } from "@buydy/se-db";
import crypto from "crypto";
import logger from "@buydy/se-logger";

class EODHDCacheClient {
  constructor({ apiKey, baseURL, timeout, axiosConfig, cacheExpirationHours = 24 }) {
    if (!apiKey) {
      throw new Error("EODHDCacheClient requires an API key");
    }

    this.apiKey = apiKey;
    this.cacheExpirationHours = cacheExpirationHours;
    this.cacheExpirationMs = cacheExpirationHours * 60 * 60 * 1000;

    // Initialize the underlying EODHD client
    this.eodhdClient = new EODHDClient({
      apiKey,
      baseURL,
      timeout,
      axiosConfig,
    });

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      saves: 0,
    };

    // Initialize database connection
    this.db = null;
    this.collection = null;
    this.initDatabase();
  }

  async initDatabase() {
    try {
      this.db = await getDatabase();
      this.collection = this.db.collection("cached_response_eodhistoricaldata");

      // Create indexes for better performance
      await this.collection.createIndex({ cacheKey: 1 }, { unique: true });
      await this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await this.collection.createIndex({ apiEndpoint: 1, params: 1 });

      logger.business("✅ EODHD Cache database initialized");
    } catch (error) {
      logger.business("❌ Failed to initialize cache database", { error });
      logger.business("⚠️ Continuing without cache - API calls will be made directly");
      this.db = null;
      this.collection = null;
    }
  }

  generateCacheKey(apiEndpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {});

    const keyString = `${apiEndpoint}:${JSON.stringify(sortedParams)}`;
    return crypto.createHash("md5").update(keyString).digest("hex");
  }

  async getCachedResponse(cacheKey) {
    if (!this.collection) {
      return null;
    }

    try {
      const cached = await this.collection.findOne({
        cacheKey,
        expiresAt: { $gt: new Date() },
      });

      if (cached) {
        this.stats.hits++;
        return cached.data;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      logger.business("Error retrieving cached response", { error });
      return null;
    }
  }

  async setCachedResponse(cacheKey, apiEndpoint, params, data) {
    if (!this.collection) {
      return;
    }

    try {
      const expiresAt = new Date(Date.now() + this.cacheExpirationMs);

      await this.collection.replaceOne(
        { cacheKey },
        {
          cacheKey,
          apiEndpoint,
          params,
          data,
          expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { upsert: true }
      );

      this.stats.saves++;
    } catch (error) {
      logger.business("Error caching response", { error });
      // Don't throw - caching failure shouldn't break the API
    }
  }

  async makeCachedRequest(apiEndpoint, params, apiCall) {
    const cacheKey = this.generateCacheKey(apiEndpoint, params);

    // Try to get from cache first
    let data = await this.getCachedResponse(cacheKey);

    if (data === null) {
      // Cache miss - make API call
      try {
        data = await apiCall();
        await this.setCachedResponse(cacheKey, apiEndpoint, params, data);
      } catch (error) {
        logger.business(`API call failed for ${apiEndpoint}`, { error });
        throw error;
      }
    }

    return data;
  }

  // Wrapped API methods with caching
  async getEODData(symbol, from, to, options = {}) {
    const params = { symbol, from, to, ...options };
    return this.makeCachedRequest("eod", params, () =>
      this.eodhdClient.stocks.getEODData(symbol, from, to, options)
    );
  }

  async getRealTimeData(symbol) {
    const params = { symbol };
    return this.makeCachedRequest("real-time", params, () =>
      this.eodhdClient.stocks.getRealTimeData(symbol)
    );
  }

  async getFundamentalData(symbol) {
    const params = { symbol };
    return this.makeCachedRequest("fundamental", params, () =>
      this.eodhdClient.stocks.getFundamentalData(symbol)
    );
  }

  async searchStocks(query, options = {}) {
    const params = { query, ...options };
    return this.makeCachedRequest("search", params, () =>
      this.eodhdClient.search.searchStocks(query, options)
    );
  }

  async getTopGainers(options = {}) {
    const params = { ...options };
    return this.makeCachedRequest("top-gainers", params, () =>
      this.eodhdClient.search.getTopGainers(options)
    );
  }

  async getTopLosers(options = {}) {
    const params = { ...options };
    return this.makeCachedRequest("top-losers", params, () =>
      this.eodhdClient.search.getTopLosers(options)
    );
  }

  async getMostActiveStocks(options = {}) {
    const params = { ...options };
    return this.makeCachedRequest("most-active", params, () =>
      this.eodhdClient.search.getMostActiveStocks(options)
    );
  }

  async getMarketStatus(exchange) {
    const params = { exchange };
    return this.makeCachedRequest("market-status", params, () =>
      this.eodhdClient.search.getMarketStatus(exchange)
    );
  }

  async getDividends(symbol, from, to, options = {}) {
    const params = { symbol, from, to, ...options };
    return this.makeCachedRequest("dividends", params, () =>
      this.eodhdClient.dividends.getDividends(symbol, from, to, options)
    );
  }

  async getUpcomingDividends(symbol) {
    const params = { symbol };
    return this.makeCachedRequest("upcoming-dividends", params, () =>
      this.eodhdClient.dividends.getUpcomingDividends(symbol)
    );
  }

  async getDividendYield(symbol) {
    const params = { symbol };
    return this.makeCachedRequest("dividend-yield", params, () =>
      this.eodhdClient.dividends.getDividendYield(symbol)
    );
  }

  async getTechnicalIndicator(symbol, function_name, params = {}) {
    const cacheParams = { symbol, function: function_name, ...params };
    return this.makeCachedRequest("technical", cacheParams, () =>
      this.eodhdClient.stocks.getTechnicalIndicator(symbol, function_name, params)
    );
  }

  async getAvailableExchanges(options = {}) {
    const params = { ...options };
    return this.makeCachedRequest("exchanges-list", params, () =>
      this.eodhdClient.search.getAvailableExchanges(options)
    );
  }

  async getSymbolsByExchange(exchange, options = {}) {
    const params = { exchange, ...options };
    return this.makeCachedRequest("exchange-symbols", params, () =>
      this.eodhdClient.search.getSymbolsByExchange(exchange, options)
    );
  }

  // Expose API objects for compatibility with EODHDClient interface
  get stocks() {
    return {
      getFundamentalData: this.getFundamentalData.bind(this),
      getEODData: this.getEODData.bind(this),
      getRealTimeData: this.getRealTimeData.bind(this),
      getTechnicalIndicator: this.getTechnicalIndicator.bind(this),
    };
  }

  get search() {
    return {
      searchStocks: this.searchStocks.bind(this),
      getTopGainers: this.getTopGainers.bind(this),
      getTopLosers: this.getTopLosers.bind(this),
      getMostActiveStocks: this.getMostActiveStocks.bind(this),
      getMarketStatus: this.getMarketStatus.bind(this),
      getAvailableExchanges: this.getAvailableExchanges.bind(this),
      getSymbolsByExchange: this.getSymbolsByExchange.bind(this),
    };
  }

  get dividends() {
    return {
      getDividends: this.getDividends.bind(this),
      getUpcomingDividends: this.getUpcomingDividends.bind(this),
      getDividendYield: this.getDividendYield.bind(this),
    };
  }

  // Get cache statistics
  getCacheStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : 0;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      saves: this.stats.saves,
      total,
      hitRate: `${hitRate}%`,
    };
  }

  // Log cache summary
  logCacheSummary() {
    const stats = this.getCacheStats();
    logger.business(
      `💾 Cache: ${stats.hits} hits, ${stats.misses} misses (${stats.hitRate} hit rate) | Saved: ${stats.saves} | Total: ${stats.total}`
    );
  }

  // Cache management methods
  async clearCache() {
    try {
      const result = await this.collection.deleteMany({});
      logger.business(`🗑️ Cleared ${result.deletedCount} cached responses`);
      return result.deletedCount;
    } catch (error) {
      logger.business("Error clearing cache", { error });
      throw error;
    }
  }

  async getDetailedCacheStats() {
    if (!this.collection) {
      return {
        total: 0,
        active: 0,
        expired: 0,
        expirationHours: this.cacheExpirationHours,
        status: "Database not available",
      };
    }

    try {
      const total = await this.collection.countDocuments();
      const expired = await this.collection.countDocuments({
        expiresAt: { $lte: new Date() },
      });
      const active = total - expired;

      return {
        total,
        active,
        expired,
        expirationHours: this.cacheExpirationHours,
        status: "Connected",
      };
    } catch (error) {
      logger.business("Error getting cache stats", { error });
      return {
        total: 0,
        active: 0,
        expired: 0,
        expirationHours: this.cacheExpirationHours,
        status: "Error: " + error.message,
      };
    }
  }

  async cleanupExpired() {
    try {
      const result = await this.collection.deleteMany({
        expiresAt: { $lte: new Date() },
      });
      logger.business(`🧹 Cleaned up ${result.deletedCount} expired cache entries`);
      return result.deletedCount;
    } catch (error) {
      logger.business("Error cleaning up expired cache", { error });
      throw error;
    }
  }
}

export { EODHDCacheClient };
export default EODHDCacheClient;
