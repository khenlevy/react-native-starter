/**
 * News API - Financial news, events, and market sentiment
 */
export class NewsAPI {
  constructor(axios) {
    this.axios = axios;
  }

  /**
   * Get financial news for a specific stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {Object} [options] - News options
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @param {number} [options.limit] - Maximum number of articles
   * @param {string} [options.s] - Search query
   * @returns {Promise<Array>} Array of news articles
   */
  async getStockNews(symbol, options = {}) {
    const params = {
      symbol,
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
      ...(options.limit && { limit: options.limit }),
      ...(options.s && { s: options.s }),
    };

    const response = await this.axios.get("/news", { params });
    return response.data;
  }

  /**
   * Get general financial news
   * @param {Object} [options] - News options
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @param {number} [options.limit] - Maximum number of articles
   * @param {string} [options.s] - Search query
   * @param {string} [options.tags] - News tags filter
   * @returns {Promise<Array>} Array of news articles
   */
  async getGeneralNews(options = {}) {
    const params = {
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
      ...(options.limit && { limit: options.limit }),
      ...(options.s && { s: options.s }),
      ...(options.tags && { tags: options.tags }),
    };

    const response = await this.axios.get("/news", { params });
    return response.data;
  }

  /**
   * Search news by query
   * @param {string} query - Search query
   * @param {Object} [options] - Search options
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @param {number} [options.limit] - Maximum number of articles
   * @param {string} [options.tags] - News tags filter
   * @returns {Promise<Array>} Array of matching news articles
   */
  async searchNews(query, options = {}) {
    const params = {
      s: query,
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
      ...(options.limit && { limit: options.limit }),
      ...(options.tags && { tags: options.tags }),
    };

    const response = await this.axios.get("/news", { params });
    return response.data;
  }

  /**
   * Get news by tags
   * @param {string|Array<string>} tags - News tags
   * @param {Object} [options] - News options
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @param {number} [options.limit] - Maximum number of articles
   * @returns {Promise<Array>} Array of news articles with specified tags
   */
  async getNewsByTags(tags, options = {}) {
    const tagString = Array.isArray(tags) ? tags.join(",") : tags;
    const params = {
      tags: tagString,
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
      ...(options.limit && { limit: options.limit }),
    };

    const response = await this.axios.get("/news", { params });
    return response.data;
  }

  /**
   * Get latest financial news
   * @param {Object} [options] - News options
   * @param {number} [options.limit] - Maximum number of articles
   * @param {string} [options.tags] - News tags filter
   * @returns {Promise<Array>} Array of latest news articles
   */
  async getLatestNews(options = {}) {
    const params = {
      ...(options.limit && { limit: options.limit }),
      ...(options.tags && { tags: options.tags }),
    };

    const response = await this.axios.get("/news", { params });
    return response.data;
  }

  /**
   * Get trending financial news
   * @param {Object} [options] - News options
   * @param {number} [options.limit] - Maximum number of articles
   * @returns {Promise<Array>} Array of trending news articles
   */
  async getTrendingNews(options = {}) {
    const params = {
      trending: true,
      ...(options.limit && { limit: options.limit }),
    };

    const response = await this.axios.get("/news", { params });
    return response.data;
  }

  /**
   * Get news sentiment analysis
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {Object} [options] - Options
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Sentiment analysis data
   */
  async getNewsSentiment(symbol, options = {}) {
    const params = {
      symbol,
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
    };

    const response = await this.axios.get("/news-sentiment/" + symbol, { params });
    return response.data;
  }

  /**
   * Get market events calendar
   * @param {Object} [options] - Options
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @param {string} [options.country] - Country filter
   * @param {string} [options.importance] - Importance filter (high, medium, low)
   * @returns {Promise<Array>} Array of market events
   */
  async getMarketEvents(options = {}) {
    const params = {
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
      ...(options.country && { country: options.country }),
      ...(options.importance && { importance: options.importance }),
    };

    const response = await this.axios.get("/economic-events", { params });
    return response.data;
  }

  /**
   * Get earnings announcements
   * @param {Object} [options] - Options
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @param {string} [options.symbol] - Stock symbol filter
   * @returns {Promise<Array>} Array of earnings announcements
   */
  async getEarningsAnnouncements(options = {}) {
    const params = {
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
      ...(options.symbol && { symbol: options.symbol }),
    };

    const response = await this.axios.get("/earnings", { params });
    return response.data;
  }

  /**
   * Get dividend announcements
   * @param {Object} [options] - Options
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @param {string} [options.symbol] - Stock symbol filter
   * @returns {Promise<Array>} Array of dividend announcements
   */
  async getDividendAnnouncements(options = {}) {
    const params = {
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
      ...(options.symbol && { symbol: options.symbol }),
    };

    const response = await this.axios.get("/dividends", { params });
    return response.data;
  }

  /**
   * Get IPO announcements
   * @param {Object} [options] - Options
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of IPO announcements
   */
  async getIPOAnnouncements(options = {}) {
    const params = {
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
    };

    const response = await this.axios.get("/ipos", { params });
    return response.data;
  }

  /**
   * Get stock splits announcements
   * @param {Object} [options] - Options
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @param {string} [options.symbol] - Stock symbol filter
   * @returns {Promise<Array>} Array of stock splits announcements
   */
  async getStockSplitsAnnouncements(options = {}) {
    const params = {
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
      ...(options.symbol && { symbol: options.symbol }),
    };

    const response = await this.axios.get("/splits", { params });
    return response.data;
  }
}
