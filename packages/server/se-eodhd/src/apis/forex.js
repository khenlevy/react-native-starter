import logger from "@buydy/se-logger";

/**
 * Forex API - Foreign exchange rates and currency data
 */
export class ForexAPI {
  constructor(axios) {
    this.axios = axios;
  }

  /**
   * Get real-time forex rates
   * @param {string} from - Base currency (e.g., 'USD')
   * @param {string} to - Target currency (e.g., 'EUR')
   * @returns {Promise<Object>} Real-time forex rate
   */
  async getRealTimeRate(from, to) {
    const symbol = `${from}${to}`;
    const response = await this.axios.get("/real-time/" + symbol + ".FOREX");
    return response.data;
  }

  /**
   * Get live forex rates
   * @param {string} from - Base currency (e.g., 'USD')
   * @param {string} to - Target currency (e.g., 'EUR')
   * @returns {Promise<Object>} Live forex rate
   */
  async getLiveRate(from, to) {
    const symbol = `${from}${to}`;
    const response = await this.axios.get("/live/" + symbol + ".FOREX");
    return response.data;
  }

  /**
   * Get historical forex data
   * @param {string} from - Base currency (e.g., 'USD')
   * @param {string} to - Target currency (e.g., 'EUR')
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {Object} [options] - Additional options
   * @param {string} [options.period] - Period: 'd' (daily), 'w' (weekly), 'm' (monthly)
   * @returns {Promise<Array>} Array of historical forex data
   */
  async getHistoricalData(from, to, startDate, endDate, options = {}) {
    const symbol = `${from}${to}`;
    const params = {
      symbol: symbol + ".FOREX",
      from: startDate,
      to: endDate,
      period: options.period || "d",
    };

    const response = await this.axios.get("/eod", { params });
    return response.data;
  }

  /**
   * Get intraday forex data
   * @param {string} from - Base currency (e.g., 'USD')
   * @param {string} to - Target currency (e.g., 'EUR')
   * @param {string} interval - Interval: '1m', '5m', '1h', '1d'
   * @param {string} [fromTime] - Start datetime (YYYY-MM-DD HH:MM:SS)
   * @param {string} [toTime] - End datetime (YYYY-MM-DD HH:MM:SS)
   * @returns {Promise<Array>} Array of intraday forex data
   */
  async getIntradayData(from, to, interval, fromTime, toTime) {
    const symbol = `${from}${to}`;
    const params = {
      symbol: symbol + ".FOREX",
      interval,
      ...(fromTime && { from: fromTime }),
      ...(toTime && { to: toTime }),
    };

    const response = await this.axios.get("/intraday/" + symbol + ".FOREX", { params });
    return response.data;
  }

  /**
   * Get multiple forex rates at once
   * @param {string} baseCurrency - Base currency (e.g., 'USD')
   * @param {Array<string>} targetCurrencies - Array of target currencies
   * @returns {Promise<Object>} Object with multiple forex rates
   */
  async getMultipleRates(baseCurrency, targetCurrencies) {
    const rates = {};

    for (const targetCurrency of targetCurrencies) {
      try {
        const rate = await this.getRealTimeRate(baseCurrency, targetCurrency);
        rates[targetCurrency] = rate;
      } catch (error) {
        logger.business(`Failed to get rate for ${baseCurrency}${targetCurrency}`, {
          error: error.message,
        });
        rates[targetCurrency] = null;
      }
    }

    return rates;
  }

  /**
   * Get forex rates for a specific date
   * @param {string} from - Base currency (e.g., 'USD')
   * @param {string} to - Target currency (e.g., 'EUR')
   * @param {string} date - Date (YYYY-MM-DD)
   * @returns {Promise<Object>} Forex rate for the specific date
   */
  async getRateForDate(from, to, date) {
    const symbol = `${from}${to}`;
    const params = {
      symbol: symbol + ".FOREX",
      from: date,
      to: date,
    };

    const response = await this.axios.get("/eod", { params });
    return response.data[0] || null;
  }

  /**
   * Get available forex pairs
   * @returns {Promise<Array>} Array of available forex pairs
   */
  async getAvailablePairs() {
    const response = await this.axios.get("/exchanges-list");
    const forexExchanges = response.data.filter(
      (exchange) => exchange.Name && exchange.Name.toLowerCase().includes("forex")
    );

    // Extract forex pairs from exchange data
    const pairs = [];
    forexExchanges.forEach((exchange) => {
      if (exchange.Code) {
        pairs.push(exchange.Code);
      }
    });

    return pairs;
  }

  /**
   * Get forex market status
   * @returns {Promise<Object>} Forex market status information
   */
  async getMarketStatus() {
    const response = await this.axios.get("/market-status", {
      params: { exchange: "FOREX" },
    });
    return response.data;
  }

  /**
   * Convert currency amount
   * @param {number} amount - Amount to convert
   * @param {string} from - Base currency (e.g., 'USD')
   * @param {string} to - Target currency (e.g., 'EUR')
   * @returns {Promise<Object>} Conversion result
   */
  async convertCurrency(amount, from, to) {
    const rate = await this.getRealTimeRate(from, to);

    if (!rate || !rate.close) {
      throw new Error(`Unable to get exchange rate for ${from} to ${to}`);
    }

    const convertedAmount = amount * rate.close;

    return {
      originalAmount: amount,
      fromCurrency: from,
      toCurrency: to,
      exchangeRate: rate.close,
      convertedAmount: convertedAmount,
      timestamp: rate.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Get forex technical indicators
   * @param {string} from - Base currency (e.g., 'USD')
   * @param {string} to - Target currency (e.g., 'EUR')
   * @param {string} function_name - Technical indicator function
   * @param {Object} [params] - Parameters for the technical indicator
   * @returns {Promise<Object>} Technical indicator data
   */
  async getTechnicalIndicator(from, to, function_name, params = {}) {
    const symbol = `${from}${to}`;
    const requestParams = {
      symbol: symbol + ".FOREX",
      function: function_name,
      ...params,
    };

    const response = await this.axios.get("/technical/" + symbol + ".FOREX", {
      params: requestParams,
    });
    return response.data;
  }

  /**
   * Get forex volatility data
   * @param {string} from - Base currency (e.g., 'USD')
   * @param {string} to - Target currency (e.g., 'EUR')
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of volatility data
   */
  async getVolatilityData(from, to, startDate, endDate) {
    const symbol = `${from}${to}`;
    const params = {
      symbol: symbol + ".FOREX",
      from: startDate,
      to: endDate,
    };

    const response = await this.axios.get("/eod", { params });

    // Calculate volatility from price data
    const prices = response.data.map((day) => day.close);
    const volatility = this.calculateVolatility(prices);

    return {
      symbol: symbol,
      period: `${startDate} to ${endDate}`,
      volatility: volatility,
      data: response.data,
    };
  }

  /**
   * Calculate volatility from price array
   * @private
   * @param {Array<number>} prices - Array of prices
   * @returns {number} Volatility percentage
   */
  calculateVolatility(prices) {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

    return Math.sqrt(variance) * 100; // Return as percentage
  }
}
