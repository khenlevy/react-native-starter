# @buydy/cl-http-priority-queue-client

Advanced HTTP client for browser applications with **multi-layer caching** (memory + localStorage), priority queue, request deduplication, and automatic retry logic. **Specifically designed to reduce EODHD API calls** by caching responses for 1 hour in persistent storage.

## 🎯 Key Features

- ✅ **Multi-Layer Caching**: Memory (5min) + LocalStorage (1hour default)
- ✅ **Persistent Cache**: Survives page reloads, reduces API calls dramatically
- ✅ **Fast Key Generation**: FNV-1a hash algorithm for efficient cache lookups
- ✅ **Priority Queue**: Execute critical requests first
- ✅ **Request Deduplication**: Merge identical pending requests
- ✅ **Automatic Retry**: Exponential backoff for failed requests
- ✅ **Smart Eviction**: LRU and size-based cache management
- ✅ **Version Migration**: Automatic cache version upgrades

## 🚀 Performance Benefits

### Reduces EODHD API Calls by ~60-70%

```
Traditional approach (no caching):
  User opens app → 10 API calls
  User refreshes → 10 API calls  
  User closes/reopens → 10 API calls
  Total: 30 API calls to EODHD

With cl-http-priority-queue-client:
  User opens app → 10 API calls (cached for 1 hour)
  User refreshes → 0 API calls (served from cache)
  User closes/reopens → 0 API calls (localStorage persists)
  Total: 10 API calls to EODHD
  
Savings: 66% reduction in API calls! 🎉
```

## 📦 Installation

```bash
yarn add @buydy/cl-http-priority-queue-client
```

## 🎬 Quick Start

```javascript
import { QueuedHttpClient } from '@buydy/cl-http-priority-queue-client';

// Create client with localStorage caching (1 hour default)
const api = new QueuedHttpClient({
  baseURL: 'http://localhost:3001/api/v1',
  maxConcurrency: 6,
  
  // LocalStorage caching (persistent, reduces EODHD calls)
  enableLocalStorageCache: true,
  defaultLocalStorageCacheTTL: 60 * 60 * 1000, // 1 hour
  
  // Memory caching (fast, short-lived)
  enableMemoryCache: true,
  defaultMemoryCacheTTL: 5 * 60 * 1000, // 5 minutes
});

// Make request - automatically cached
const data = await api.get('/stocks/heatmap');
```

## 🏗️ Architecture

### Multi-Layer Cache System

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Component                            │
│                  api.get('/stocks/heatmap')                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Memory Cache (⚡ Instant - 5 min TTL)              │
│  • Fastest access                                            │
│  • Lost on page reload                                       │
│  • Perfect for rapid repeated requests                       │
└────────────────────────────┬────────────────────────────────┘
                             │ Cache miss
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: LocalStorage Cache (💾 Fast - 1 hour TTL)         │
│  • Persistent across page reloads                            │
│  • Survives browser close/reopen                             │
│  • Reduces EODHD API calls dramatically                      │
└────────────────────────────┬────────────────────────────────┘
                             │ Cache miss
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Priority Queue + Network Request                   │
│  • Deduplication check                                       │
│  • Priority-based execution                                  │
│  • Automatic retry on failure                                │
│  • Stores in both caches on success                          │
└─────────────────────────────────────────────────────────────┘
```

### Cache Key Generation

Fast and efficient cache key generation using **FNV-1a hash algorithm**:

```javascript
// Example cache keys:
"GET-stocks-heatmap"                           // Simple GET
"GET-jobs-1k8x7f2"                            // GET with params (hash)
"POST-jobs-run-9z4m3p1"                       // POST with data (hash)

// Key format: METHOD-ENDPOINT[-HASH]
// Hash only when params/data present
// Base36 encoding for shorter keys
```

## 📖 Configuration

### Full Configuration Options

```javascript
const api = new QueuedHttpClient({
  // HTTP Configuration
  baseURL: 'https://api.example.com',
  timeout: 30000,
  headers: { 'Authorization': 'Bearer token' },
  
  // Queue Configuration
  maxConcurrency: 6,              // Max simultaneous requests
  name: 'API Client',             // Name for logging
  
  // Memory Cache (fast, short-lived)
  enableMemoryCache: true,
  defaultMemoryCacheTTL: 5 * 60 * 1000,  // 5 minutes
  
  // LocalStorage Cache (persistent, long-lived)
  enableLocalStorageCache: true,
  defaultLocalStorageCacheTTL: 60 * 60 * 1000,  // 1 hour
  localStorageCacheMaxSizeMB: 5,                 // 5MB limit
  localStorageCacheMaxEntries: 500,              // Max entries
  
  // Deduplication
  enableDeduplication: true,
  
  // Retry Logic
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,               // Exponential backoff starting at 1s
  
  // Callbacks
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  },
  onRequestComplete: (result, index) => {
    console.log(`Request ${index} completed`);
  },
  onRequestError: (error, index) => {
    console.error(`Request ${index} failed`, error);
  },
  onCacheFull: () => {
    console.warn('LocalStorage cache full, evicting old entries');
  },
});
```

## 💡 Usage Examples

### Basic GET Request with Caching

```javascript
// First request: hits network, caches for 1 hour
const data = await api.get('/stocks/heatmap');

// Subsequent requests within 1 hour: served from cache
const cachedData = await api.get('/stocks/heatmap'); // ⚡ Instant
```

### Custom Cache TTL per Request

```javascript
// Static data: cache for 6 hours
await api.get('/stocks/list', {
  localStorageCacheTTL: 6 * 60 * 60 * 1000,
});

// Real-time data: cache for 30 seconds only
await api.get('/jobs/running', {
  localStorageCacheTTL: 30 * 1000,
});

// Critical data: skip localStorage cache
await api.get('/jobs/critical', {
  localStorageCache: false,  // Skip localStorage
  memoryCache: true,         // Still use memory cache
});
```

### Priority-Based Requests

```javascript
// Critical user action - highest priority
await api.post('/jobs/run', data, {
  priority: 1,
  localStorageCache: false,  // Don't cache POST requests
});

// Main feature - high priority, long cache
await api.get('/stocks/heatmap', {
  priority: 5,
  localStorageCacheTTL: 60 * 60 * 1000,  // 1 hour
});

// Background data - low priority
await api.get('/jobs/history', {
  priority: 100,
});
```

### Cache Management

```javascript
// Clear memory cache only
api.clearMemoryCache();

// Clear localStorage cache only
api.clearLocalStorageCache();

// Clear all caches
api.clearAllCaches();

// Clear specific endpoint cache
api.clearLocalStorageCache('GET-stocks');

// Get cache statistics
const stats = api.getStats();
console.log(`
  Memory Cache: ${stats.memoryCache.size} entries
  LocalStorage: ${stats.localStorage.entries}/${stats.localStorage.maxEntries} entries
  Cache Hit Rate: ${stats.cacheHitRate}
  LocalStorage Usage: ${stats.localStorage.usage}%
`);
```

## 📊 Statistics and Monitoring

```javascript
const stats = api.getStats();

{
  // Request stats
  totalRequests: 150,
  successfulRequests: 145,
  failedRequests: 5,
  
  // Cache stats
  memoryCacheHits: 45,              // Memory cache hits
  localStorageCacheHits: 60,        // LocalStorage cache hits
  totalCacheHits: 105,
  cacheHitRate: "70.0%",            // Overall cache hit rate
  
  // Optimization stats
  deduplicatedRequests: 15,
  retriedRequests: 8,
  
  // Queue stats
  queue: {
    running: 6,
    queued: 2,
    completed: 142,
    failed: 5,
    totalTasks: 150
  },
  
  // Cache details
  memoryCache: {
    size: 25,
    enabled: true
  },
  localStorage: {
    available: true,
    version: "1",
    entries: 45,
    maxEntries: 500,
    size: 2621440,                  // bytes
    sizeMB: "2.50",
    maxSizeMB: "5.00",
    usage: "50.0"                   // percentage
  },
  
  pendingRequests: 6
}
```

## 🎯 Real-World Example

```javascript
import { QueuedHttpClient } from '@buydy/cl-http-priority-queue-client';

// Create optimized client for stock data
const stockApi = new QueuedHttpClient({
  baseURL: 'http://localhost:3001/api/v1',
  maxConcurrency: 6,
  name: 'Stock API',
  
  // Aggressive caching to reduce EODHD calls
  enableLocalStorageCache: true,
  defaultLocalStorageCacheTTL: 60 * 60 * 1000, // 1 hour
  localStorageCacheMaxSizeMB: 10,  // Larger cache for stock data
});

// Heatmap data (rarely changes, cache aggressively)
const heatmap = await stockApi.get('/stocks/heatmap', {
  priority: 1,
  localStorageCacheTTL: 2 * 60 * 60 * 1000,  // 2 hours
});

// Job status (changes frequently, short cache)
const jobs = await stockApi.get('/jobs/running', {
  priority: 10,
  localStorageCacheTTL: 30 * 1000,  // 30 seconds
});

// Historical data (never changes, cache for days)
const history = await stockApi.get('/stocks/history/AAPL', {
  priority: 50,
  localStorageCacheTTL: 24 * 60 * 60 * 1000,  // 24 hours
});

// Monitor cache efficiency
setInterval(() => {
  const stats = stockApi.getStats();
  console.log(`
    Total Requests: ${stats.totalRequests}
    Cache Hit Rate: ${stats.cacheHitRate}
    EODHD Calls Saved: ${stats.totalCacheHits}
    LocalStorage: ${stats.localStorage.sizeMB}MB used
  `);
}, 10000);
```

## ⚡ Performance Comparison

### Scenario: User browsing stock dashboard

**Without cl-http-priority-queue-client:**
```
Initial load:  10 API calls → 10 network requests
Refresh:       10 API calls → 10 network requests
Navigate away: 10 API calls → 10 network requests
Total:         30 API calls → 30 network requests
```

**With cl-http-priority-queue-client:**
```
Initial load:  10 API calls → 10 network requests (cached)
Refresh:       10 API calls → 0 network requests (memory cache)
Navigate away: 10 API calls → 0 network requests (localStorage cache)
Total:         30 API calls → 10 network requests

Savings: 66% fewer network requests
Result: Faster UI + Lower EODHD API usage
```

## 🧠 Cache Intelligence

### Automatic Cache Management

- **Smart Eviction**: LRU (Least Recently Used) algorithm
- **Size Management**: Automatic cleanup when reaching size limits
- **Entry Limits**: Maximum number of cached entries enforced
- **Version Migration**: Automatic cache clear on version updates

### Cache Versioning

```javascript
// Cache version is managed automatically
// When version changes, old cache is cleared
// No manual intervention needed

localStorage:
  buydy_api_cache_metadata: {
    version: "1",
    createdAt: 1704067200000,
    entries: {...},
    totalSize: 2621440
  }
```

## 🔧 Advanced Features

### Request Deduplication

```javascript
// Multiple components request same data simultaneously
const promise1 = api.get('/stocks/heatmap');
const promise2 = api.get('/stocks/heatmap');
const promise3 = api.get('/stocks/heatmap');

// Only 1 actual network request is made
// All 3 promises resolve with the same response
await Promise.all([promise1, promise2, promise3]);
```

### Automatic Retry with Exponential Backoff

```javascript
// Request automatically retries on failure
await api.get('/unstable-endpoint', {
  retry: true,
  maxRetries: 3,
  retryDelay: 1000,
});

// Timeline:
// 0ms:    Attempt 1 → fails
// 1000ms: Attempt 2 → fails  
// 3000ms: Attempt 3 → fails
// 7000ms: Attempt 4 → success!
```

## 📱 Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Requirements**: localStorage support (available in all modern browsers)

## 🐛 Troubleshooting

### LocalStorage Not Available

```javascript
const stats = api.getStats();
if (!stats.localStorage.available) {
  console.warn('LocalStorage not available, falling back to memory cache only');
}
```

### Cache Full Errors

```javascript
const api = new QueuedHttpClient({
  // ...config
  onCacheFull: () => {
    // Handle cache full event
    console.warn('Cache full, consider increasing size limit');
    api.clearLocalStorageCache(); // Manual clear
  },
});
```

### Debugging Cache Behavior

```javascript
// Enable detailed logging (automatically enabled)
// Check browser console for cache activity:
// [10:30:45] [Stocks API] ⚡ Memory Cache HIT: GET-stocks-heatmap
// [10:30:46] [Stocks API] 💾 LocalStorage Cache HIT: GET-jobs
// [10:30:47] [Stocks API] 📡 GET /stocks/new-data
// [10:30:48] [Stocks API] 💾 LocalStorage cached: GET-stocks-new-data (TTL: 1h)
```

## 🔐 Security Considerations

- **No Sensitive Data**: Don't cache authentication tokens or personal data
- **Cache Isolation**: Each baseURL gets its own cache namespace
- **Automatic Cleanup**: Old cache entries are automatically evicted
- **Version Control**: Cache is cleared on version updates

## 📚 API Reference

### Methods

- `get(url, config)` - GET request
- `post(url, data, config)` - POST request
- `put(url, data, config)` - PUT request
- `patch(url, data, config)` - PATCH request
- `delete(url, config)` - DELETE request
- `getStats()` - Get statistics
- `clearMemoryCache(pattern?)` - Clear memory cache
- `clearLocalStorageCache(pattern?)` - Clear localStorage cache
- `clearAllCaches(pattern?)` - Clear all caches
- `waitForCompletion()` - Wait for all requests
- `cancel()` - Cancel pending requests

### Request Config Options

```typescript
{
  priority?: number,                      // 1-100 (1=highest)
  memoryCache?: boolean,                  // Enable memory cache
  memoryCacheTTL?: number,                // Memory cache TTL (ms)
  localStorageCache?: boolean,            // Enable localStorage cache
  localStorageCacheTTL?: number,          // localStorage cache TTL (ms)
  deduplicate?: boolean,                  // Enable deduplication
  retry?: boolean,                        // Enable retry
  maxRetries?: number,                    // Max retry attempts
  retryDelay?: number,                    // Initial retry delay (ms)
  ...axiosConfig                          // All axios config options
}
```

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! This package is specifically designed for browser-based applications with localStorage support.

---

**Perfect for**: Stock dashboards, data-heavy SPAs, API-backed applications where reducing network requests is critical for performance and API quota management.

