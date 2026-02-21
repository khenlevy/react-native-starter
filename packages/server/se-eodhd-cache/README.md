# EODHD Cache Package

A MongoDB-based caching layer for EODHD API responses to reduce costs and improve performance.

## Features

- **Automatic Caching**: All API responses are automatically cached
- **Configurable Expiration**: Default 24-hour cache expiration (configurable)
- **MongoDB Integration**: Uses the existing `@buydy/se-db` package
- **Performance Optimized**: Includes database indexes for fast lookups
- **Cache Management**: Built-in methods for cache cleanup and statistics
- **Error Resilient**: Caching failures don't break API calls

## Installation

```bash
yarn add @buydy/se-eodhd-cache
```

## Usage

```javascript
import { EODHDCacheClient } from "@buydy/se-eodhd-cache";

const cacheClient = new EODHDCacheClient({
  apiKey: "your_eodhd_api_token",
  cacheExpirationHours: 24 // Optional, defaults to 24 hours
});

// All methods are the same as EODHDClient but with automatic caching
const stockData = await cacheClient.getRealTimeData("AAPL.US");
const searchResults = await cacheClient.searchStocks("Apple");
```

## Cache Management

```javascript
// Get cache statistics
const stats = await cacheClient.getCacheStats();
console.log(stats);
// { total: 150, active: 120, expired: 30, expirationHours: 24 }

// Clean up expired entries
const cleaned = await cacheClient.cleanupExpired();
console.log(`Cleaned up ${cleaned} expired entries`);

// Clear all cache
const cleared = await cacheClient.clearCache();
console.log(`Cleared ${cleared} cached responses`);
```

## Database Schema

The package uses the `cached_response_eodhistoricaldata` collection with the following schema:

```javascript
{
  cacheKey: String,        // MD5 hash of endpoint + params
  apiEndpoint: String,     // API endpoint name
  params: Object,          // Request parameters
  data: Mixed,            // Cached response data
  expiresAt: Date,        // Expiration timestamp
  createdAt: Date,        // Creation timestamp
  updatedAt: Date         // Last update timestamp
}
```

## Indexes

- `cacheKey` (unique) - For fast cache lookups
- `expiresAt` (TTL) - For automatic expiration cleanup
- `apiEndpoint` + `params` - For query optimization

## Configuration

- `apiKey`: EODHD API token (required)
- `baseURL`: EODHD API base URL (optional)
- `timeout`: Request timeout in ms (optional)
- `axiosConfig`: Additional Axios configuration (optional)
- `cacheExpirationHours`: Cache expiration in hours (default: 24)
