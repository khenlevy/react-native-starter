import logger from "@buydy/se-logger";

/**
 * Indices API - Stock indices, ETFs, and market benchmarks
 */
export class IndicesAPI {
  constructor(axios) {
    this.axios = axios;
  }

  /**
   * Get index data
   * @param {string} symbol - Index symbol (e.g., 'GSPC.INDX' for S&P 500)
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {Object} [options] - Additional options
   * @param {string} [options.period] - Period: 'd' (daily), 'w' (weekly), 'm' (monthly)
   * @returns {Promise<Array>} Array of index data
   */
  async getIndexData(symbol, startDate, endDate, options = {}) {
    const params = {
      symbol,
      from: startDate,
      to: endDate,
      period: options.period || "d",
    };

    const response = await this.axios.get("/eod", { params });
    return response.data;
  }

  /**
   * Get real-time index data
   * @param {string} symbol - Index symbol (e.g., 'GSPC.INDX')
   * @returns {Promise<Object>} Real-time index data
   */
  async getRealTimeIndexData(symbol) {
    const response = await this.axios.get("/real-time/" + symbol);
    return response.data;
  }

  /**
   * Get live index data
   * @param {string} symbol - Index symbol (e.g., 'GSPC.INDX')
   * @returns {Promise<Object>} Live index data
   */
  async getLiveIndexData(symbol) {
    const response = await this.axios.get("/live/" + symbol);
    return response.data;
  }

  /**
   * Get ETF data
   * @param {string} symbol - ETF symbol (e.g., 'SPY.US')
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {Object} [options] - Additional options
   * @param {string} [options.period] - Period: 'd' (daily), 'w' (weekly), 'm' (monthly)
   * @returns {Promise<Array>} Array of ETF data
   */
  async getETFData(symbol, startDate, endDate, options = {}) {
    const params = {
      symbol,
      from: startDate,
      to: endDate,
      period: options.period || "d",
    };

    const response = await this.axios.get("/eod", { params });
    return response.data;
  }

  /**
   * Get ETF holdings
   * @param {string} symbol - ETF symbol (e.g., 'SPY.US')
   * @returns {Promise<Array>} Array of ETF holdings
   */
  async getETFHoldings(symbol) {
    const response = await this.axios.get("/fundamentals/" + symbol);
    const fundamentalData = response.data;

    if (fundamentalData && fundamentalData.Holdings) {
      return fundamentalData.Holdings;
    }

    return [];
  }

  /**
   * Get index constituents
   * @param {string} symbol - Index symbol (e.g., 'GSPC.INDX')
   * @returns {Promise<Array>} Array of index constituents
   */
  async getIndexConstituents(symbol) {
    const response = await this.axios.get("/fundamentals/" + symbol);
    const fundamentalData = response.data;

    if (fundamentalData && fundamentalData.Constituents) {
      return fundamentalData.Constituents;
    }

    return [];
  }

  /**
   * Get major indices data
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Object with major indices data
   */
  async getMajorIndicesData(startDate, endDate) {
    const majorIndices = [
      { symbol: "GSPC.INDX", name: "S&P 500" },
      { symbol: "DJI.INDX", name: "Dow Jones Industrial Average" },
      { symbol: "IXIC.INDX", name: "NASDAQ Composite" },
      { symbol: "RUT.INDX", name: "Russell 2000" },
      { symbol: "VIX.INDX", name: "VIX Volatility Index" },
    ];

    const indicesData = {};

    for (const index of majorIndices) {
      try {
        const data = await this.getIndexData(index.symbol, startDate, endDate);
        indicesData[index.name] = {
          symbol: index.symbol,
          data: data,
        };
      } catch (error) {
        logger.business(`Failed to get data for ${index.name}`, { error: error.message });
        indicesData[index.name] = {
          symbol: index.symbol,
          data: [],
          error: error.message,
        };
      }
    }

    return indicesData;
  }

  /**
   * Get sector performance
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Object with sector performance data
   */
  async getSectorPerformance(startDate, endDate) {
    const sectorETFs = [
      { symbol: "XLK.US", name: "Technology Select Sector SPDR Fund" },
      { symbol: "XLF.US", name: "Financial Select Sector SPDR Fund" },
      { symbol: "XLE.US", name: "Energy Select Sector SPDR Fund" },
      { symbol: "XLV.US", name: "Health Care Select Sector SPDR Fund" },
      { symbol: "XLI.US", name: "Industrial Select Sector SPDR Fund" },
      { symbol: "XLY.US", name: "Consumer Discretionary Select Sector SPDR Fund" },
      { symbol: "XLP.US", name: "Consumer Staples Select Sector SPDR Fund" },
      { symbol: "XLU.US", name: "Utilities Select Sector SPDR Fund" },
      { symbol: "XLB.US", name: "Materials Select Sector SPDR Fund" },
      { symbol: "XLRE.US", name: "Real Estate Select Sector SPDR Fund" },
      { symbol: "XLC.US", name: "Communication Services Select Sector SPDR Fund" },
    ];

    const sectorData = {};

    for (const sector of sectorETFs) {
      try {
        const data = await this.getETFData(sector.symbol, startDate, endDate);
        if (data && data.length > 0) {
          const startPrice = data[0].close;
          const endPrice = data[data.length - 1].close;
          const performance = ((endPrice - startPrice) / startPrice) * 100;

          sectorData[sector.name] = {
            symbol: sector.symbol,
            performance: performance,
            startPrice: startPrice,
            endPrice: endPrice,
            data: data,
          };
        }
      } catch (error) {
        logger.business(`Failed to get data for ${sector.name}`, { error: error.message });
        sectorData[sector.name] = {
          symbol: sector.symbol,
          performance: null,
          error: error.message,
        };
      }
    }

    return sectorData;
  }

  /**
   * Get market breadth data
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Market breadth data
   */
  async getMarketBreadth(startDate, endDate) {
    try {
      // Get S&P 500 data for market breadth analysis
      const sp500Data = await this.getIndexData("GSPC.INDX", startDate, endDate);

      if (!sp500Data || sp500Data.length === 0) {
        throw new Error("No S&P 500 data available");
      }

      // Calculate market breadth metrics
      const totalDays = sp500Data.length;
      const upDays = sp500Data.filter((day) => day.close > day.open).length;
      const downDays = sp500Data.filter((day) => day.close < day.open).length;
      const flatDays = totalDays - upDays - downDays;

      const averageVolume = sp500Data.reduce((sum, day) => sum + (day.volume || 0), 0) / totalDays;
      const highVolumeDays = sp500Data.filter(
        (day) => (day.volume || 0) > averageVolume * 1.5
      ).length;

      return {
        period: `${startDate} to ${endDate}`,
        totalDays: totalDays,
        upDays: upDays,
        downDays: downDays,
        flatDays: flatDays,
        upDaysPercentage: (upDays / totalDays) * 100,
        downDaysPercentage: (downDays / totalDays) * 100,
        averageVolume: averageVolume,
        highVolumeDays: highVolumeDays,
        data: sp500Data,
      };
    } catch (error) {
      throw new Error(`Failed to get market breadth data: ${error.message}`);
    }
  }

  /**
   * Get volatility index data
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of VIX data
   */
  async getVolatilityIndexData(startDate, endDate) {
    return this.getIndexData("VIX.INDX", startDate, endDate);
  }

  /**
   * Get bond indices data
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Object with bond indices data
   */
  async getBondIndicesData(startDate, endDate) {
    const bondIndices = [
      { symbol: "TLT.US", name: "iShares 20+ Year Treasury Bond ETF" },
      { symbol: "IEF.US", name: "iShares 7-10 Year Treasury Bond ETF" },
      { symbol: "SHY.US", name: "iShares 1-3 Year Treasury Bond ETF" },
      { symbol: "LQD.US", name: "iShares iBoxx $ Investment Grade Corporate Bond ETF" },
      { symbol: "HYG.US", name: "iShares iBoxx $ High Yield Corporate Bond ETF" },
    ];

    const bondData = {};

    for (const bond of bondIndices) {
      try {
        const data = await this.getETFData(bond.symbol, startDate, endDate);
        bondData[bond.name] = {
          symbol: bond.symbol,
          data: data,
        };
      } catch (error) {
        logger.business(`Failed to get data for ${bond.name}`, { error: error.message });
        bondData[bond.name] = {
          symbol: bond.symbol,
          data: [],
          error: error.message,
        };
      }
    }

    return bondData;
  }

  /**
   * Get commodity indices data
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Object with commodity indices data
   */
  async getCommodityIndicesData(startDate, endDate) {
    const commodityETFs = [
      { symbol: "GLD.US", name: "SPDR Gold Trust" },
      { symbol: "SLV.US", name: "iShares Silver Trust" },
      { symbol: "USO.US", name: "United States Oil Fund" },
      { symbol: "UNG.US", name: "United States Natural Gas Fund" },
      { symbol: "DBA.US", name: "Invesco DB Agriculture Fund" },
    ];

    const commodityData = {};

    for (const commodity of commodityETFs) {
      try {
        const data = await this.getETFData(commodity.symbol, startDate, endDate);
        commodityData[commodity.name] = {
          symbol: commodity.symbol,
          data: data,
        };
      } catch (error) {
        logger.business(`Failed to get data for ${commodity.name}`, { error: error.message });
        commodityData[commodity.name] = {
          symbol: commodity.symbol,
          data: [],
          error: error.message,
        };
      }
    }

    return commodityData;
  }
}
