/**
 * Options API - US Stock Options data and analysis
 */
export class OptionsAPI {
  constructor(axios) {
    this.axios = axios;
  }

  /**
   * Get options data for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {Object} [options] - Options parameters
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @param {string} [options.expiration] - Expiration date (YYYY-MM-DD)
   * @param {string} [options.strike] - Strike price
   * @param {string} [options.type] - Option type ('call' or 'put')
   * @returns {Promise<Array>} Array of options data
   */
  async getOptionsData(symbol, options = {}) {
    const params = {
      symbol,
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
      ...(options.expiration && { expiration: options.expiration }),
      ...(options.strike && { strike: options.strike }),
      ...(options.type && { type: options.type }),
    };

    const response = await this.axios.get("/options/" + symbol, { params });
    return response.data;
  }

  /**
   * Get options chain for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {string} expiration - Expiration date (YYYY-MM-DD)
   * @returns {Promise<Object>} Options chain data
   */
  async getOptionsChain(symbol, expiration) {
    const params = { symbol, expiration };
    const response = await this.axios.get("/options/" + symbol, { params });
    return response.data;
  }

  /**
   * Get call options for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {Object} [options] - Options parameters
   * @param {string} [options.expiration] - Expiration date (YYYY-MM-DD)
   * @param {string} [options.strike] - Strike price
   * @returns {Promise<Array>} Array of call options
   */
  async getCallOptions(symbol, options = {}) {
    const params = {
      symbol,
      type: "call",
      ...(options.expiration && { expiration: options.expiration }),
      ...(options.strike && { strike: options.strike }),
    };

    const response = await this.axios.get("/options/" + symbol, { params });
    return response.data;
  }

  /**
   * Get put options for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {Object} [options] - Options parameters
   * @param {string} [options.expiration] - Expiration date (YYYY-MM-DD)
   * @param {string} [options.strike] - Strike price
   * @returns {Promise<Array>} Array of put options
   */
  async getPutOptions(symbol, options = {}) {
    const params = {
      symbol,
      type: "put",
      ...(options.expiration && { expiration: options.expiration }),
      ...(options.strike && { strike: options.strike }),
    };

    const response = await this.axios.get("/options/" + symbol, { params });
    return response.data;
  }

  /**
   * Get options by expiration date
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {string} expiration - Expiration date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of options for the expiration date
   */
  async getOptionsByExpiration(symbol, expiration) {
    const params = { symbol, expiration };
    const response = await this.axios.get("/options/" + symbol, { params });
    return response.data;
  }

  /**
   * Get options by strike price
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {number} strike - Strike price
   * @param {Object} [options] - Additional options
   * @param {string} [options.expiration] - Expiration date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of options for the strike price
   */
  async getOptionsByStrike(symbol, strike, options = {}) {
    const params = {
      symbol,
      strike: strike.toString(),
      ...(options.expiration && { expiration: options.expiration }),
    };

    const response = await this.axios.get("/options/" + symbol, { params });
    return response.data;
  }

  /**
   * Get options volume data
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {Object} [options] - Options parameters
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of options volume data
   */
  async getOptionsVolume(symbol, options = {}) {
    const params = {
      symbol,
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
    };

    const response = await this.axios.get("/options-volume/" + symbol, { params });
    return response.data;
  }

  /**
   * Get options open interest data
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {Object} [options] - Options parameters
   * @param {string} [options.from] - Start date (YYYY-MM-DD)
   * @param {string} [options.to] - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of options open interest data
   */
  async getOptionsOpenInterest(symbol, options = {}) {
    const params = {
      symbol,
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
    };

    const response = await this.axios.get("/options-open-interest/" + symbol, { params });
    return response.data;
  }

  /**
   * Get options Greeks data
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {Object} [options] - Options parameters
   * @param {string} [options.expiration] - Expiration date (YYYY-MM-DD)
   * @param {string} [options.strike] - Strike price
   * @returns {Promise<Array>} Array of options Greeks data
   */
  async getOptionsGreeks(symbol, options = {}) {
    const params = {
      symbol,
      ...(options.expiration && { expiration: options.expiration }),
      ...(options.strike && { strike: options.strike }),
    };

    const response = await this.axios.get("/options-greeks/" + symbol, { params });
    return response.data;
  }

  /**
   * Get options implied volatility
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {Object} [options] - Options parameters
   * @param {string} [options.expiration] - Expiration date (YYYY-MM-DD)
   * @param {string} [options.strike] - Strike price
   * @returns {Promise<Array>} Array of implied volatility data
   */
  async getOptionsImpliedVolatility(symbol, options = {}) {
    const params = {
      symbol,
      ...(options.expiration && { expiration: options.expiration }),
      ...(options.strike && { strike: options.strike }),
    };

    const response = await this.axios.get("/options-iv/" + symbol, { params });
    return response.data;
  }

  /**
   * Get options expiration dates for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @returns {Promise<Array>} Array of expiration dates
   */
  async getOptionsExpirationDates(symbol) {
    const response = await this.axios.get("/options-expirations/" + symbol);
    return response.data;
  }

  /**
   * Get options strike prices for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {string} expiration - Expiration date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of strike prices
   */
  async getOptionsStrikePrices(symbol, expiration) {
    const params = { symbol, expiration };
    const response = await this.axios.get("/options-strikes/" + symbol, { params });
    return response.data;
  }

  /**
   * Get options summary for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @returns {Promise<Object>} Options summary data
   */
  async getOptionsSummary(symbol) {
    const response = await this.axios.get("/options-summary/" + symbol);
    return response.data;
  }
}
