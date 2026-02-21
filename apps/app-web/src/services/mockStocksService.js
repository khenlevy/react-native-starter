// Mock data service for development when API is not available
const mockStocks = [
  {
    id: '1',
    symbol: 'AAPL.US',
    name: 'Apple Inc.',
    code: 'AAPL',
    exchange: 'NASDAQ',
    country: 'United States',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    currency: 'USD',
    marketCap: 3000000000000,
    peRatio: 28.5,
    pbRatio: 45.2,
    dividendYield: 0.5,
    roe: 147.4,
    debtToEquity: 1.73,
    revenue: 394328000000,
    profitMargin: 25.3,
    eps: 6.13,
    bookValue: 4.26,
    price: 175.43,
    updatedAt: new Date(),
    fetchedAt: new Date(),
  },
  {
    id: '2',
    symbol: 'MSFT.US',
    name: 'Microsoft Corporation',
    code: 'MSFT',
    exchange: 'NASDAQ',
    country: 'United States',
    sector: 'Technology',
    industry: 'Software',
    currency: 'USD',
    marketCap: 2800000000000,
    peRatio: 32.1,
    pbRatio: 12.8,
    dividendYield: 0.7,
    roe: 45.2,
    debtToEquity: 0.31,
    revenue: 211915000000,
    profitMargin: 36.5,
    eps: 9.81,
    bookValue: 19.02,
    price: 314.87,
    updatedAt: new Date(),
    fetchedAt: new Date(),
  },
  {
    id: '3',
    symbol: 'GOOGL.US',
    name: 'Alphabet Inc.',
    code: 'GOOGL',
    exchange: 'NASDAQ',
    country: 'United States',
    sector: 'Technology',
    industry: 'Internet Content & Information',
    currency: 'USD',
    marketCap: 1700000000000,
    peRatio: 25.8,
    pbRatio: 6.2,
    dividendYield: 0,
    roe: 19.2,
    debtToEquity: 0.11,
    revenue: 282836000000,
    profitMargin: 21.0,
    eps: 5.61,
    bookValue: 143.15,
    price: 144.68,
    updatedAt: new Date(),
    fetchedAt: new Date(),
  },
  {
    id: '4',
    symbol: 'AMZN.US',
    name: 'Amazon.com Inc.',
    code: 'AMZN',
    exchange: 'NASDAQ',
    country: 'United States',
    sector: 'Consumer Discretionary',
    industry: 'Internet Retail',
    currency: 'USD',
    marketCap: 1500000000000,
    peRatio: 52.3,
    pbRatio: 8.1,
    dividendYield: 0,
    roe: 15.4,
    debtToEquity: 0.31,
    revenue: 574785000000,
    profitMargin: 2.4,
    eps: 3.24,
    bookValue: 40.18,
    price: 169.51,
    updatedAt: new Date(),
    fetchedAt: new Date(),
  },
  {
    id: '5',
    symbol: 'TSLA.US',
    name: 'Tesla Inc.',
    code: 'TSLA',
    exchange: 'NASDAQ',
    country: 'United States',
    sector: 'Consumer Discretionary',
    industry: 'Auto Manufacturers',
    currency: 'USD',
    marketCap: 800000000000,
    peRatio: 65.2,
    pbRatio: 12.4,
    dividendYield: 0,
    roe: 19.0,
    debtToEquity: 0.17,
    revenue: 96773000000,
    profitMargin: 10.6,
    eps: 3.62,
    bookValue: 20.45,
    price: 236.08,
    updatedAt: new Date(),
    fetchedAt: new Date(),
  },
];

const mockFilterOptions = {
  exchanges: [
    { value: 'NASDAQ', label: 'NASDAQ' },
    { value: 'NYSE', label: 'NYSE' },
    { value: 'LSE', label: 'LSE' },
    { value: 'TSE', label: 'TSE' },
  ],
  sectors: [
    { value: 'Technology', label: 'Technology' },
    { value: 'Consumer Discretionary', label: 'Consumer Discretionary' },
    { value: 'Healthcare', label: 'Healthcare' },
    { value: 'Financial Services', label: 'Financial Services' },
    { value: 'Industrials', label: 'Industrials' },
  ],
  industries: [
    { value: 'Consumer Electronics', label: 'Consumer Electronics' },
    { value: 'Software', label: 'Software' },
    {
      value: 'Internet Content & Information',
      label: 'Internet Content & Information',
    },
    { value: 'Internet Retail', label: 'Internet Retail' },
    { value: 'Auto Manufacturers', label: 'Auto Manufacturers' },
  ],
  countries: [
    { value: 'United States', label: 'United States' },
    { value: 'United Kingdom', label: 'United Kingdom' },
    { value: 'Japan', label: 'Japan' },
    { value: 'Germany', label: 'Germany' },
  ],
  marketCapRange: {
    min: 1000000000, // $1B
    max: 3000000000000, // $3T
  },
};

const mockStats = {
  totalStocks: 1250,
  totalMarketCap: 45000000000000,
  avgMarketCap: 36000000000,
  minMarketCap: 10000000000,
  maxMarketCap: 3000000000000,
  avgPERatio: 28.5,
  avgDividendYield: 2.1,
};

class MockStocksService {
  async getLargeCapStocks(params = {}) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    let filteredStocks = [...mockStocks];

    // Apply filters
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filteredStocks = filteredStocks.filter(
        (stock) =>
          stock.name.toLowerCase().includes(searchLower) ||
          stock.code.toLowerCase().includes(searchLower) ||
          stock.symbol.toLowerCase().includes(searchLower),
      );
    }

    if (params.exchange) {
      filteredStocks = filteredStocks.filter((stock) =>
        stock.exchange.toLowerCase().includes(params.exchange.toLowerCase()),
      );
    }

    if (params.sector) {
      filteredStocks = filteredStocks.filter((stock) =>
        stock.sector.toLowerCase().includes(params.sector.toLowerCase()),
      );
    }

    if (params.industry) {
      filteredStocks = filteredStocks.filter((stock) =>
        stock.industry.toLowerCase().includes(params.industry.toLowerCase()),
      );
    }

    if (params.country) {
      filteredStocks = filteredStocks.filter((stock) =>
        stock.country.toLowerCase().includes(params.country.toLowerCase()),
      );
    }

    if (params.minCap) {
      filteredStocks = filteredStocks.filter(
        (stock) => stock.marketCap >= parseFloat(params.minCap),
      );
    }

    if (params.maxCap) {
      filteredStocks = filteredStocks.filter(
        (stock) => stock.marketCap <= parseFloat(params.maxCap),
      );
    }

    // Apply sorting
    if (params.sortBy && params.sortOrder) {
      filteredStocks.sort((a, b) => {
        let aVal = a[params.sortBy];
        let bVal = b[params.sortBy];

        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (params.sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
    }

    // Apply pagination
    const limit = parseInt(params.limit) || 50;
    const skip = parseInt(params.skip) || 0;
    const paginatedStocks = filteredStocks.slice(skip, skip + limit);

    return {
      success: true,
      data: {
        stocks: paginatedStocks,
        pagination: {
          total: filteredStocks.length,
          limit,
          skip,
          pages: Math.ceil(filteredStocks.length / limit),
          currentPage: Math.floor(skip / limit) + 1,
        },
      },
    };
  }

  async getFilterOptions() {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      success: true,
      data: mockFilterOptions,
    };
  }

  async getAutocompleteSuggestions(query) {
    if (!query || query.length < 2) {
      return { data: { suggestions: [] } };
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    const suggestions = mockStocks
      .filter(
        (stock) =>
          stock.name.toLowerCase().includes(query.toLowerCase()) ||
          stock.code.toLowerCase().includes(query.toLowerCase()) ||
          stock.symbol.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 10)
      .map((stock) => ({
        id: stock.id,
        symbol: stock.symbol,
        name: stock.name,
        code: stock.code,
        exchange: stock.exchange,
        marketCap: stock.marketCap,
        displayText: `${stock.code} - ${stock.name} (${stock.exchange})`,
      }));

    return {
      success: true,
      data: {
        suggestions,
      },
    };
  }

  async getStockStats() {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      success: true,
      data: mockStats,
    };
  }
}

export default new MockStocksService();
