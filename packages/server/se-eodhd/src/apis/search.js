/**
 * Search API - Stock search, screener, and market data discovery
 */
export class SearchAPI {
  constructor(axios) {
    this.axios = axios;
    // simple in-memory cache per-process
    this._cache = {
      exchangesList: { ts: 0, data: null },
    };
  }

  /**
   * Search for stocks by name or symbol
   * @param {string} query - Search query (company name or symbol)
   * @param {Object} [options] - Search options
   * @param {string} [options.exchange] - Exchange filter (e.g., 'US', 'NASDAQ')
   * @param {number} [options.limit] - Maximum number of results
   * @returns {Promise<Array>} Array of matching stocks
   */
  async searchStocks(query, options = {}) {
    const params = {
      s: query,
      ...(options.exchange && { exchange: options.exchange }),
      ...(options.limit && { limit: options.limit }),
    };

    const response = await this.axios.get("/search", { params });
    return response.data;
  }

  /**
   * Get stock screener data with filters
   * @param {Object} filters - Screener filters
   * @param {string} [filters.exchange] - Exchange filter
   * @param {string} [filters.sector] - Sector filter
   * @param {string} [filters.industry] - Industry filter
   * @param {number} [filters.market_cap_min] - Minimum market cap
   * @param {number} [filters.market_cap_max] - Maximum market cap
   * @param {number} [filters.price_min] - Minimum price
   * @param {number} [filters.price_max] - Maximum price
   * @param {number} [filters.volume_min] - Minimum volume
   * @param {number} [filters.pe_min] - Minimum P/E ratio
   * @param {number} [filters.pe_max] - Maximum P/E ratio
   * @param {number} [filters.dividend_yield_min] - Minimum dividend yield
   * @param {number} [filters.dividend_yield_max] - Maximum dividend yield
   * @param {string} [filters.sort] - Sort field
   * @param {string} [filters.order] - Sort order ('asc' or 'desc')
   * @param {number} [filters.limit] - Maximum number of results
   * @returns {Promise<Array>} Array of screened stocks
   */
  async screenStocks(filters = {}) {
    const params = {
      ...filters,
      ...(filters.limit && { limit: filters.limit }),
    };

    const response = await this.axios.get("/screener", { params });
    return response.data;
  }

  /**
   * Get trending stocks
   * @param {Object} [options] - Options
   * @param {string} [options.exchange] - Exchange filter
   * @param {number} [options.limit] - Maximum number of results
   * @returns {Promise<Array>} Array of trending stocks
   */
  async getTrendingStocks(options = {}) {
    const params = {
      ...(options.exchange && { exchange: options.exchange }),
      ...(options.limit && { limit: options.limit }),
    };

    const response = await this.axios.get("/trending", { params });
    return response.data;
  }

  /**
   * Get most active stocks
   * @param {Object} [options] - Options
   * @param {string} [options.exchange] - Exchange filter
   * @param {number} [options.limit] - Maximum number of results
   * @returns {Promise<Array>} Array of most active stocks
   */
  async getMostActiveStocks(options = {}) {
    const params = {
      ...(options.exchange && { exchange: options.exchange }),
      ...(options.limit && { limit: options.limit }),
    };

    const response = await this.axios.get("/most-active", { params });
    return response.data;
  }

  /**
   * Get top gainers
   * @param {Object} [options] - Options
   * @param {string} [options.exchange] - Exchange filter
   * @param {number} [options.limit] - Maximum number of results
   * @returns {Promise<Array>} Array of top gainers
   */
  async getTopGainers(options = {}) {
    const params = {
      ...(options.exchange && { exchange: options.exchange }),
      ...(options.limit && { limit: options.limit }),
    };

    const response = await this.axios.get("/top-gainers", { params });
    return response.data;
  }

  /**
   * Get top losers
   * @param {Object} [options] - Options
   * @param {string} [options.exchange] - Exchange filter
   * @param {number} [options.limit] - Maximum number of results
   * @returns {Promise<Array>} Array of top losers
   */
  async getTopLosers(options = {}) {
    const params = {
      ...(options.exchange && { exchange: options.exchange }),
      ...(options.limit && { limit: options.limit }),
    };

    const response = await this.axios.get("/top-losers", { params });
    return response.data;
  }

  /**
   * Get stocks by sector
   * @param {string} sector - Sector name
   * @param {Object} [options] - Options
   * @param {string} [options.exchange] - Exchange filter
   * @param {number} [options.limit] - Maximum number of results
   * @returns {Promise<Array>} Array of stocks in the sector
   */
  async getStocksBySector(sector, options = {}) {
    const params = {
      sector,
      ...(options.exchange && { exchange: options.exchange }),
      ...(options.limit && { limit: options.limit }),
    };

    const response = await this.axios.get("/sector", { params });
    return response.data;
  }

  /**
   * Get stocks by industry
   * @param {string} industry - Industry name
   * @param {Object} [options] - Options
   * @param {string} [options.exchange] - Exchange filter
   * @param {number} [options.limit] - Maximum number of results
   * @returns {Promise<Array>} Array of stocks in the industry
   */
  async getStocksByIndustry(industry, options = {}) {
    const params = {
      industry,
      ...(options.exchange && { exchange: options.exchange }),
      ...(options.limit && { limit: options.limit }),
    };

    const response = await this.axios.get("/industry", { params });
    return response.data;
  }

  /**
   * Get exchange information
   * @param {string} [exchange] - Exchange code (e.g., 'US', 'NASDAQ')
   * @returns {Promise<Object|Array>} Exchange information or list of exchanges
   */
  async getExchangeInfo(exchange, options = {}) {
    const { maxAgeMs } = options || {};
    if (exchange) {
      const response = await this.axios.get("/exchanges/" + exchange);
      return response.data;
    } else {
      // optional cache based on maxAgeMs
      if (maxAgeMs && Number(maxAgeMs) > 0) {
        const now = Date.now();
        const { ts, data } = this._cache.exchangesList || {};
        if (data && ts && now - ts < Number(maxAgeMs)) {
          return data;
        }
      }

      const response = await this.axios.get("/exchanges-list");
      const data = response.data;
      if (maxAgeMs && Number(maxAgeMs) > 0) {
        this._cache.exchangesList = { ts: Date.now(), data };
      }
      return data;
    }
  }

  /**
   * Get available exchanges
   * @returns {Promise<Array>} Array of available exchanges
   */
  async getAvailableExchanges(options = {}) {
    const { maxAgeMs } = options || {};
    // reuse getExchangeInfo without exchange code to utilize cache
    return await this.getExchangeInfo(undefined, { maxAgeMs });
  }

  /**
   * Get market status
   * @param {string} [exchange] - Exchange code
   * @returns {Promise<Object>} Market status information
   */
  async getMarketStatus(exchange) {
    const params = exchange ? { exchange } : {};
    const response = await this.axios.get("/market-status", { params });
    return response.data;
  }

  /**
   * Get stock symbols by exchange
   * @param {string} exchange - Exchange code (e.g., 'US', 'NASDAQ')
   * @param {Object} [options] - Options
   * @param {number} [options.limit] - Maximum number of results
   * @returns {Promise<Array>} Array of stock symbols
   */
  async getSymbolsByExchange(exchange, options = {}) {
    const params = {
      ...(options.limit && { limit: options.limit }),
    };

    // EODHD endpoint: /exchange-symbol-list/{EXCHANGE}
    const response = await this.axios.get("/exchange-symbol-list/" + exchange, { params });
    return response.data;
  }
}
