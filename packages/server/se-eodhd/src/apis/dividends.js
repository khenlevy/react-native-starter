/**
 * Dividends API - Dividends, corporate actions, and financial events
 */
export class DividendsAPI {
  constructor(axios) {
    this.axios = axios;
  }

  /**
   * Get dividends data for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of dividends data
   */
  async getDividends(symbol, from, to) {
    const params = { symbol, from, to };
    const response = await this.axios.get("/div/" + symbol, { params });
    return response.data;
  }

  /**
   * Get upcoming dividends for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @returns {Promise<Array>} Array of upcoming dividends
   */
  async getUpcomingDividends(symbol) {
    const response = await this.axios.get(
      "/div/" + symbol + "?from=" + new Date().toISOString().split("T")[0]
    );
    return response.data;
  }

  /**
   * Get dividend history for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of dividend history
   */
  async getDividendHistory(symbol, from, to) {
    const params = { symbol, from, to };
    const response = await this.axios.get("/div/" + symbol, { params });
    return response.data;
  }

  /**
   * Get corporate actions for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of corporate actions
   */
  async getCorporateActions(symbol, from, to) {
    const params = { symbol, from, to };
    const response = await this.axios.get("/splits/" + symbol, { params });
    return response.data;
  }

  /**
   * Get stock splits for a stock
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
   * Get earnings calendar for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of earnings calendar events
   */
  async getEarningsCalendar(symbol, from, to) {
    const params = { symbol, from, to };
    const response = await this.axios.get("/earnings/" + symbol, { params });
    return response.data;
  }

  /**
   * Get upcoming earnings for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @returns {Promise<Array>} Array of upcoming earnings
   */
  async getUpcomingEarnings(symbol) {
    const from = new Date().toISOString().split("T")[0];
    const to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return this.getEarningsCalendar(symbol, from, to);
  }

  /**
   * Get financial events for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of financial events
   */
  async getFinancialEvents(symbol, from, to) {
    const params = { symbol, from, to };
    const response = await this.axios.get("/events/" + symbol, { params });
    return response.data;
  }

  /**
   * Get dividend yield for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @returns {Promise<Object>} Dividend yield data
   */
  async getDividendYield(symbol) {
    const response = await this.axios.get("/fundamentals/" + symbol);
    const fundamentalData = response.data;

    if (fundamentalData && fundamentalData.General && fundamentalData.General.DividendYield) {
      return {
        symbol,
        dividendYield: fundamentalData.General.DividendYield,
        currency: fundamentalData.General.CurrencyCode,
        lastUpdated: fundamentalData.General.LastUpdate,
      };
    }

    throw new Error(`Dividend yield data not available for ${symbol}`);
  }

  /**
   * Get ex-dividend dates for a stock
   * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
   * @param {string} from - Start date (YYYY-MM-DD)
   * @param {string} to - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of ex-dividend dates
   */
  async getExDividendDates(symbol, from, to) {
    const dividends = await this.getDividends(symbol, from, to);
    return dividends.map((dividend) => ({
      symbol,
      exDate: dividend.date,
      paymentDate: dividend.paymentDate,
      recordDate: dividend.recordDate,
      amount: dividend.value,
      currency: dividend.currency,
    }));
  }
}
