/**
 * Stocks API - End-of-day, real-time, and fundamental data for stocks
 */
export class StocksAPI {
  constructor(axios) {
    this.axios = axios;
  }

  /**
   * Get end-of-day historical data for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @param {Object} [options] - Additional options
   * @param {string} [options.period='d'] - Period: 'd' (daily), 'w' (weekly), 'm' (monthly)
   * @param {string} [options.order='a'] - Order: 'a' (ascending), 'd' (descending)
   * @returns {Promise<Array>} Array of OHLCV data
   */
  async getEODData(symbol, from, to, options = {}) {
    const params = {
      from,
      to,
      period: options.period || "d",
      order: options.order || "a",
    };

    const response = await this.axios.get(`/eod/${symbol}`, { params });
    return response.data;
  }

  /**
   * Get real-time stock data
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @returns {Promise<Object>} Real-time stock data
   */
  async getRealTimeData(symbol) {
    const response = await this.axios.get("/real-time/" + symbol);
    return response.data;
  }

  /**
   * Get live (delayed) stock data
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @returns {Promise<Object>} Live stock data
   */
  async getLiveData(symbol) {
    const response = await this.axios.get("/live/" + symbol);
    return response.data;
  }

  /**
   * Get fundamental data for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @returns {Promise<Object>} Fundamental data
   */
  async getFundamentalData(symbol) {
    const response = await this.axios.get("/fundamentals/" + symbol);
    return response.data;
  }

  /**
   * Get intraday data for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} interval - Interval: '1m', '5m', '1h', '1d'
   * @param {string} [from] - Start datetime (YYYY-MM-DD HH:MM:SS)
   * @param {string} [to] - End datetime (YYYY-MM-DD HH:MM:SS)
   * @returns {Promise<Array>} Array of intraday data
   */
  async getIntradayData(symbol, interval, from, to) {
    const params = {
      symbol,
      interval,
      ...(from && { from }),
      ...(to && { to }),
    };

    const response = await this.axios.get("/intraday/" + symbol, { params });
    return response.data;
  }

  /**
   * Get technical indicators for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} function_name - Technical indicator function
   * @param {Object} [params] - Parameters for the technical indicator
   * @returns {Promise<Object>} Technical indicator data
   */
  async getTechnicalIndicator(symbol, function_name, params = {}) {
    const requestParams = {
      symbol,
      function: function_name,
      ...params,
    };

    const response = await this.axios.get("/technical/" + symbol, { params: requestParams });
    return response.data;
  }

  /**
   * Get bulk EOD data for multiple symbols
   * @param {Array<string>} symbols - Array of stock symbols
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Bulk EOD data
   */
  async getBulkEODData(symbols, from, to, options = {}) {
    const params = {
      symbols: symbols.join(","),
      from,
      to,
      period: options.period || "d",
      order: options.order || "a",
    };

    const response = await this.axios.get("/eod-bulk-last-day", { params });
    return response.data;
  }

  /**
   * Get stock splits data
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of stock splits
   */
  async getStockSplits(symbol, from, to) {
    const params = { symbol, from, to };
    const response = await this.axios.get("/splits/" + symbol, { params });
    return response.data;
  }

  /**
   * Get earnings data for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of earnings data
   */
  async getEarnings(symbol, from, to) {
    const params = { symbol, from, to };
    const response = await this.axios.get("/earnings/" + symbol, { params });
    return response.data;
  }

  /**
   * Get bulk end-of-day data for all symbols in an exchange (last trading day)
   * @param {string} exchangeCode - Exchange code (e.g., 'US', 'LSE', 'TO')
   * @returns {Promise<Array>} Array of EOD data for all symbols in the exchange
   */
  async getEndOfDayBulkLastDay(exchangeCode) {
    const response = await this.axios.get("/eod-bulk-last-day/" + exchangeCode);
    return response.data;
  }

  /**
   * Get real-time quote for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @returns {Promise<Object>} Real-time quote data
   */
  async getRealTimeQuote(symbol) {
    const response = await this.axios.get("/real-time/" + symbol);
    return response.data;
  }
}
