# @buydy/se-eodhd

Comprehensive EODHD API client for financial data access including stocks, options, forex, news, and more.

## Features

- **Stocks Data**: End-of-day, real-time, fundamental, and intraday data
- **Dividends & Corporate Actions**: Dividends, stock splits, earnings, and financial events
- **Search & Screening**: Stock search, market screening, and discovery tools
- **Options Data**: US stock options with Greeks, volatility, and chain data
- **Financial News**: News, sentiment analysis, and market events
- **Forex Data**: Real-time and historical currency exchange rates
- **Indices & ETFs**: Market indices, sector performance, and ETF data
- **Technical Analysis**: Built-in technical indicators and analysis tools

## Installation

```bash
yarn add @buydy/se-eodhd
```

## Quick Start

```javascript
import { EODHDClient } from '@buydy/se-eodhd';

const client = new EODHDClient({
  apiKey: 'your-eodhd-api-key',
  baseURL: 'https://eodhistoricaldata.com/api' // optional
});

// Test connection
const isConnected = await client.testConnection();
console.log('Connected:', isConnected);
```

## API Reference

### Core Client

#### `EODHDClient(config)`

Creates a new EODHD API client instance.

**Parameters:**
- `config.apiKey` (string, required): Your EODHD API key
- `config.baseURL` (string, optional): Base API URL (default: 'https://eodhistoricaldata.com/api')
- `config.timeout` (number, optional): Request timeout in milliseconds (default: 30000)
- `config.axiosConfig` (object, optional): Additional axios configuration

**Methods:**
- `testConnection()`: Test API connection and key validity
- `getAccountUsage()`: Get account usage information

### Stocks API

Access comprehensive stock market data.

```javascript
// Get historical data
const historicalData = await client.stocks.getEODData('AAPL.US', '2024-01-01', '2024-01-31');

// Get real-time data
const realTimeData = await client.stocks.getRealTimeData('AAPL.US');

// Get fundamental data
const fundamentalData = await client.stocks.getFundamentalData('AAPL.US');

// Get intraday data
const intradayData = await client.stocks.getIntradayData('AAPL.US', '1h', '2024-01-15 09:30:00', '2024-01-15 16:00:00');

// Get technical indicators
const rsi = await client.stocks.getTechnicalIndicator('AAPL.US', 'rsi', { period: 14 });

// Get bulk data for multiple stocks
const bulkData = await client.stocks.getBulkEODData(['AAPL.US', 'GOOGL.US', 'MSFT.US'], '2024-01-01', '2024-01-31');
```

### Dividends API

Access dividends, corporate actions, and financial events.

```javascript
// Get dividends data
const dividends = await client.dividends.getDividends('AAPL.US', '2024-01-01', '2024-12-31');

// Get upcoming dividends
const upcomingDividends = await client.dividends.getUpcomingDividends('AAPL.US');

// Get stock splits
const stockSplits = await client.dividends.getStockSplits('AAPL.US', '2024-01-01', '2024-12-31');

// Get earnings calendar
const earnings = await client.dividends.getEarningsCalendar('AAPL.US', '2024-01-01', '2024-12-31');

// Get dividend yield
const dividendYield = await client.dividends.getDividendYield('AAPL.US');
```

### Search API

Search and screen stocks with advanced filters.

```javascript
// Search for stocks
const searchResults = await client.search.searchStocks('Apple');

// Screen stocks with filters
const screenedStocks = await client.search.screenStocks({
  exchange: 'US',
  sector: 'Technology',
  market_cap_min: 1000000000, // $1B
  pe_min: 10,
  pe_max: 30,
  dividend_yield_min: 2,
  limit: 50
});

// Get trending stocks
const trendingStocks = await client.search.getTrendingStocks({ limit: 20 });

// Get most active stocks
const mostActive = await client.search.getMostActiveStocks({ limit: 20 });

// Get stocks by sector
const techStocks = await client.search.getStocksBySector('Technology', { limit: 100 });

// Get market status
const marketStatus = await client.search.getMarketStatus('US');
```

### Options API

Access US stock options data and analysis.

```javascript
// Get options data
const optionsData = await client.options.getOptionsData('AAPL', {
  from: '2024-01-01',
  to: '2024-12-31',
  expiration: '2024-03-15'
});

// Get options chain
const optionsChain = await client.options.getOptionsChain('AAPL', '2024-03-15');

// Get call options
const callOptions = await client.options.getCallOptions('AAPL', {
  expiration: '2024-03-15',
  strike: '150'
});

// Get put options
const putOptions = await client.options.getPutOptions('AAPL', {
  expiration: '2024-03-15',
  strike: '150'
});

// Get options Greeks
const greeks = await client.options.getOptionsGreeks('AAPL', {
  expiration: '2024-03-15'
});

// Get options volume
const volume = await client.options.getOptionsVolume('AAPL', {
  from: '2024-01-01',
  to: '2024-01-31'
});

// Get expiration dates
const expirations = await client.options.getOptionsExpirationDates('AAPL');
```

### News API

Access financial news, sentiment, and market events.

```javascript
// Get stock-specific news
const stockNews = await client.news.getStockNews('AAPL.US', {
  from: '2024-01-01',
  to: '2024-01-31',
  limit: 50
});

// Search news
const searchResults = await client.news.searchNews('Apple earnings', {
  from: '2024-01-01',
  limit: 20
});

// Get news by tags
const techNews = await client.news.getNewsByTags(['technology', 'earnings'], {
  limit: 30
});

// Get trending news
const trendingNews = await client.news.getTrendingNews({ limit: 20 });

// Get news sentiment
const sentiment = await client.news.getNewsSentiment('AAPL.US', {
  from: '2024-01-01',
  to: '2024-01-31'
});

// Get market events
const marketEvents = await client.news.getMarketEvents({
  from: '2024-01-01',
  to: '2024-01-31',
  importance: 'high'
});

// Get earnings announcements
const earningsAnnouncements = await client.news.getEarningsAnnouncements({
  from: '2024-01-01',
  to: '2024-01-31'
});
```

### Forex API

Access foreign exchange rates and currency data.

```javascript
// Get real-time forex rate
const usdToEur = await client.forex.getRealTimeRate('USD', 'EUR');

// Get historical forex data
const historicalForex = await client.forex.getHistoricalData('USD', 'EUR', '2024-01-01', '2024-01-31');

// Get intraday forex data
const intradayForex = await client.forex.getIntradayData('USD', 'EUR', '1h', '2024-01-15 00:00:00', '2024-01-15 23:59:59');

// Get multiple rates
const multipleRates = await client.forex.getMultipleRates('USD', ['EUR', 'GBP', 'JPY', 'CAD']);

// Convert currency
const conversion = await client.forex.convertCurrency(1000, 'USD', 'EUR');

// Get forex volatility
const volatility = await client.forex.getVolatilityData('USD', 'EUR', '2024-01-01', '2024-01-31');
```

### Indices API

Access market indices, ETFs, and sector performance.

```javascript
// Get S&P 500 data
const sp500Data = await client.indices.getIndexData('GSPC.INDX', '2024-01-01', '2024-01-31');

// Get ETF data
const etfData = await client.indices.getETFData('SPY.US', '2024-01-01', '2024-01-31');

// Get ETF holdings
const etfHoldings = await client.indices.getETFHoldings('SPY.US');

// Get major indices data
const majorIndices = await client.indices.getMajorIndicesData('2024-01-01', '2024-01-31');

// Get sector performance
const sectorPerformance = await client.indices.getSectorPerformance('2024-01-01', '2024-01-31');

// Get market breadth
const marketBreadth = await client.indices.getMarketBreadth('2024-01-01', '2024-01-31');

// Get volatility index (VIX)
const vixData = await client.indices.getVolatilityIndexData('2024-01-01', '2024-01-31');

// Get bond indices
const bondData = await client.indices.getBondIndicesData('2024-01-01', '2024-01-31');

// Get commodity indices
const commodityData = await client.indices.getCommodityIndicesData('2024-01-01', '2024-01-31');
```

## Error Handling

The client includes comprehensive error handling with detailed error messages:

```javascript
try {
  const data = await client.stocks.getEODData('INVALID.SYMBOL', '2024-01-01', '2024-01-31');
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error appropriately
}
```

## Rate Limiting

The client respects EODHD API rate limits and includes automatic retry logic. Monitor your usage with:

```javascript
const usage = await client.getAccountUsage();
console.log('API Usage:', usage);
```

## Environment Variables

Set your API key as an environment variable:

```bash
export EODHD_API_KEY="your-api-key-here"
```

Then use it in your code:

```javascript
const client = new EODHDClient({
  apiKey: process.env.EODHD_API_KEY
});
```

## Data Formats

All API responses return data in JSON format with consistent structure:

- **Historical Data**: Array of OHLCV objects with date, open, high, low, close, volume
- **Real-time Data**: Single object with current price and metadata
- **Fundamental Data**: Comprehensive object with financial metrics and company information
- **News Data**: Array of news articles with title, content, date, and metadata

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the [EODHD API Documentation](https://eodhd.com/api-docs)
- Open an issue in this repository
- Contact EODHD support for API-specific questions

## Changelog

### v0.1.0
- Initial release
- Complete EODHD API coverage
- Comprehensive documentation
- Error handling and rate limiting
- TypeScript definitions (coming soon)
