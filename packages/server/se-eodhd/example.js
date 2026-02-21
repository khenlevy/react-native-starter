/**
 * Example usage of @buydy/se-eodhd
 * 
 * This file demonstrates how to use the EODHD API client
 * for various financial data operations.
 */

import { EODHDClient } from './src/index.js';

// Initialize the client
const client = new EODHDClient({
  apiKey: process.env.EODHD_API_KEY || 'your-api-key-here',
  baseURL: 'https://eodhistoricaldata.com/api'
});

async function demonstrateUsage() {
  try {
    console.log('🚀 EODHD API Client Demo\n');

    // Test connection
    console.log('1. Testing API connection...');
    const isConnected = await client.testConnection();
    console.log(`   Connection status: ${isConnected ? '✅ Connected' : '❌ Failed'}\n`);

    if (!isConnected) {
      console.log('❌ Please check your API key and try again.');
      return;
    }

    // Get account usage
    console.log('2. Getting account usage...');
    const usage = await client.getAccountUsage();
    console.log(`   Account usage: ${JSON.stringify(usage, null, 2)}\n`);

    // Search for stocks
    console.log('3. Searching for Apple stock...');
    const searchResults = await client.search.searchStocks('Apple', { limit: 5 });
    console.log(`   Found ${searchResults.length} results:`);
    searchResults.forEach((stock, index) => {
      console.log(`   ${index + 1}. ${stock.Name} (${stock.Code}) - ${stock.Exchange}`);
    });
    console.log('');

    // Get stock data
    console.log('4. Getting Apple stock data...');
    const stockData = await client.stocks.getEODData('AAPL.US', '2024-01-01', '2024-01-31');
    console.log(`   Retrieved ${stockData.length} days of data`);
    if (stockData.length > 0) {
      const latest = stockData[stockData.length - 1];
      console.log(`   Latest close: $${latest.close} (${latest.date})`);
    }
    console.log('');

    // Get real-time data
    console.log('5. Getting real-time Apple stock data...');
    const realTimeData = await client.stocks.getRealTimeData('AAPL.US');
    console.log(`   Real-time price: $${realTimeData.close}`);
    console.log(`   Change: ${realTimeData.change} (${realTimeData.change_p}%)`);
    console.log('');

    // Get dividends
    console.log('6. Getting Apple dividends...');
    const dividends = await client.dividends.getDividends('AAPL.US', '2024-01-01', '2024-12-31');
    console.log(`   Found ${dividends.length} dividend payments`);
    if (dividends.length > 0) {
      const latestDividend = dividends[dividends.length - 1];
      console.log(`   Latest dividend: $${latestDividend.value} on ${latestDividend.date}`);
    }
    console.log('');

    // Get forex data
    console.log('7. Getting USD to EUR exchange rate...');
    const forexRate = await client.forex.getRealTimeRate('USD', 'EUR');
    console.log(`   USD/EUR rate: ${forexRate.close}`);
    console.log('');

    // Get news
    console.log('8. Getting Apple news...');
    const news = await client.news.getStockNews('AAPL.US', { limit: 3 });
    console.log(`   Found ${news.length} news articles:`);
    news.forEach((article, index) => {
      console.log(`   ${index + 1}. ${article.title} (${article.date})`);
    });
    console.log('');

    // Get market indices
    console.log('9. Getting S&P 500 data...');
    const sp500Data = await client.indices.getIndexData('GSPC.INDX', '2024-01-01', '2024-01-31');
    console.log(`   Retrieved ${sp500Data.length} days of S&P 500 data`);
    if (sp500Data.length > 0) {
      const latest = sp500Data[sp500Data.length - 1];
      console.log(`   Latest close: ${latest.close} (${latest.date})`);
    }
    console.log('');

    console.log('✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Error during demo:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateUsage();
}

export { demonstrateUsage };
