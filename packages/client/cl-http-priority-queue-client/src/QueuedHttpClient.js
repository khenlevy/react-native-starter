import { createHttpClient } from '@buydy/iso-http-client';
import { AsyncQueueManager } from '@buydy/dv-async-priority-queue';
import { generateCacheKeyForRequest } from './generateCacheKeyForRequest.js';
import { LocalStorageCacheManager } from './LocalStorageCacheManager.js';

/**
 * Advanced HTTP client with priority queue, multi-layer caching (memory + localStorage),
 * request deduplication, and automatic retry logic
 */
export class QueuedHttpClient {
  constructor({
    baseURL,
    timeout = 30000,
    maxConcurrency = 6,
    headers = {},
    axiosConfig = {},
    name = 'HTTP Queue',
    // Memory cache configuration
    enableMemoryCache = true,
    defaultMemoryCacheTTL = 5 * 60 * 1000, // 5 minutes
    // LocalStorage cache configuration
    enableLocalStorageCache = true,
    defaultLocalStorageCacheTTL = 60 * 60 * 1000, // 1 hour (default for EODHD data)
    localStorageCacheMaxSizeMB = 5,
    localStorageCacheMaxEntries = 500,
    // Other features
    enableDeduplication = true,
    enableRetry = true,
    maxRetries = 3,
    retryDelay = 1000,
    onProgress,
    onRequestComplete,
    onRequestError,
    onCacheFull,
  } = {}) {
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.maxConcurrency = maxConcurrency;
    this.name = name;

    // Memory cache configuration
    this.enableMemoryCache = enableMemoryCache;
    this.defaultMemoryCacheTTL = defaultMemoryCacheTTL;
    this.memoryCache = new Map(); // { cacheKey -> { data, timestamp, ttl } }

    // LocalStorage cache configuration
    this.enableLocalStorageCache = enableLocalStorageCache;
    this.defaultLocalStorageCacheTTL = defaultLocalStorageCacheTTL;
    this.localStorageCache = new LocalStorageCacheManager({
      maxSizeMB: localStorageCacheMaxSizeMB,
      maxEntries: localStorageCacheMaxEntries,
      onCacheFull: () => {
        this._log('⚠️  LocalStorage cache full, evicting old entries');
        if (onCacheFull) onCacheFull();
      },
      onEviction: (key, reason) => {
        this._log(`🗑️  Evicted cache entry: ${key} (${reason})`);
      },
    });

    // Deduplication configuration
    this.enableDeduplication = enableDeduplication;
    this.pendingRequests = new Map(); // { requestKey -> Promise }

    // Retry configuration
    this.enableRetry = enableRetry;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;

    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      memoryCacheHits: 0,
      localStorageCacheHits: 0,
      deduplicatedRequests: 0,
      retriedRequests: 0,
    };

    // Create axios instance
    this.axios = createHttpClient({
      baseURL,
      timeout,
      headers,
      axiosConfig,
    });

    // Create priority queue
    this.queue = new AsyncQueueManager({
      maxConcurrency,
      name: `${name} Queue`,
      onProgress,
      onTaskComplete: (result, index) => {
        this.stats.successfulRequests++;
        if (onRequestComplete) onRequestComplete(result, index);
      },
      onTaskError: (error, index) => {
        this.stats.failedRequests++;
        if (onRequestError) onRequestError(error, index);
      },
    });

    this._log(
      `🚀 Initialized (maxConcurrency=${maxConcurrency}, memCache=${enableMemoryCache}, lsCache=${enableLocalStorageCache}, dedup=${enableDeduplication})`,
    );
  }

  /**
   * Make a GET request with priority queue
   */
  async get(url, config = {}) {
    return this.request({ ...config, method: 'GET', url });
  }

  /**
   * Make a POST request with priority queue
   */
  async post(url, data, config = {}) {
    return this.request({ ...config, method: 'POST', url, data });
  }

  /**
   * Make a PUT request with priority queue
   */
  async put(url, data, config = {}) {
    return this.request({ ...config, method: 'PUT', url, data });
  }

  /**
   * Make a PATCH request with priority queue
   */
  async patch(url, data, config = {}) {
    return this.request({ ...config, method: 'PATCH', url, data });
  }

  /**
   * Make a DELETE request with priority queue
   */
  async delete(url, config = {}) {
    return this.request({ ...config, method: 'DELETE', url });
  }

  /**
   * Core request method - routes all requests through the priority queue
   */
  async request(config = {}) {
    this.stats.totalRequests++;

    const {
      priority = 50, // Default medium priority
      // Memory cache options
      memoryCache = this.enableMemoryCache,
      memoryCacheTTL = this.defaultMemoryCacheTTL,
      // LocalStorage cache options
      localStorageCache = this.enableLocalStorageCache,
      localStorageCacheTTL = this.defaultLocalStorageCacheTTL,
      // Other options
      deduplicate = this.enableDeduplication,
      retry = this.enableRetry,
      maxRetries = this.maxRetries,
      retryDelay = this.retryDelay,
      ...axiosConfig
    } = config;

    // Generate cache key
    const cacheKey = generateCacheKeyForRequest({
      ...axiosConfig,
      baseURL: this.baseURL,
    });

    // Only cache GET requests
    const shouldCache = axiosConfig.method === 'GET' || !axiosConfig.method;

    // Check memory cache first (fastest)
    if (shouldCache && memoryCache) {
      const memoryCachedData = this._getMemoryCachedData(cacheKey);
      if (memoryCachedData) {
        this.stats.memoryCacheHits++;
        this._log(`⚡ Memory Cache HIT: ${cacheKey}`);
        return memoryCachedData;
      }
    }

    // Check localStorage cache second (fast but slower than memory)
    if (shouldCache && localStorageCache) {
      const localStorageCachedData = this.localStorageCache.get(cacheKey);
      if (localStorageCachedData) {
        this.stats.localStorageCacheHits++;
        this._log(`💾 LocalStorage Cache HIT: ${cacheKey}`);

        // Promote to memory cache for faster subsequent access
        if (memoryCache) {
          this._setMemoryCachedData(
            cacheKey,
            localStorageCachedData,
            memoryCacheTTL,
          );
        }

        return localStorageCachedData;
      }
    }

    // Check for pending duplicate requests
    if (deduplicate && this.pendingRequests.has(cacheKey)) {
      this.stats.deduplicatedRequests++;
      this._log(`🔄 Deduplication: ${cacheKey}`);
      return this.pendingRequests.get(cacheKey);
    }

    // Create request task
    const requestTask = async () => {
      return this._executeRequestWithRetry(axiosConfig, {
        retry,
        maxRetries,
        retryDelay,
        cacheKey,
        shouldCache,
        memoryCache,
        memoryCacheTTL,
        localStorageCache,
        localStorageCacheTTL,
      });
    };

    // Add to queue with priority
    const requestPromise = this.queue.addTask(requestTask, priority);

    // Store pending request for deduplication
    if (deduplicate) {
      this.pendingRequests.set(cacheKey, requestPromise);
      requestPromise.finally(() => {
        this.pendingRequests.delete(cacheKey);
      });
    }

    return requestPromise;
  }

  /**
   * Execute request with retry logic
   * @private
   */
  async _executeRequestWithRetry(axiosConfig, options) {
    const {
      retry,
      maxRetries,
      retryDelay,
      cacheKey,
      shouldCache,
      memoryCache,
      memoryCacheTTL,
      localStorageCache,
      localStorageCacheTTL,
    } = options;

    let lastError;
    let attempt = 0;

    while (attempt <= (retry ? maxRetries : 0)) {
      try {
        this._log(
          `📡 ${axiosConfig.method || 'GET'} ${axiosConfig.url}${
            attempt > 0 ? ` (retry ${attempt}/${maxRetries})` : ''
          }`,
        );

        const response = await this.axios.request(axiosConfig);

        // Cache successful GET responses
        if (shouldCache) {
          // Store in localStorage (persistent, 1 hour default)
          if (localStorageCache) {
            this.localStorageCache.set(
              cacheKey,
              response.data,
              localStorageCacheTTL,
            );
            this._log(
              `💾 LocalStorage cached: ${cacheKey} (TTL: ${this._formatTTL(
                localStorageCacheTTL,
              )})`,
            );
          }

          // Store in memory cache (fast access, shorter TTL)
          if (memoryCache) {
            this._setMemoryCachedData(cacheKey, response.data, memoryCacheTTL);
            this._log(
              `⚡ Memory cached: ${cacheKey} (TTL: ${this._formatTTL(
                memoryCacheTTL,
              )})`,
            );
          }
        }

        return response.data;
      } catch (error) {
        lastError = error;
        attempt++;

        // Check if we should retry
        const shouldRetry =
          retry && attempt <= maxRetries && this._isRetryableError(error);

        if (shouldRetry) {
          this.stats.retriedRequests++;
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this._log(
            `⚠️  Retry ${attempt}/${maxRetries} after ${delay}ms: ${error.message}`,
          );
          await this._sleep(delay);
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   * @private
   */
  _isRetryableError(error) {
    // Retry on network errors or 5xx server errors
    if (!error.response) return true; // Network error
    const status = error.response.status;
    return status >= 500 && status < 600;
  }

  /**
   * Get cached data from memory if valid
   * @private
   */
  _getMemoryCachedData(cacheKey) {
    if (!cacheKey || !this.memoryCache.has(cacheKey)) return null;

    const cached = this.memoryCache.get(cacheKey);
    const now = Date.now();

    if (now - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    // Cache expired
    this.memoryCache.delete(cacheKey);
    return null;
  }

  /**
   * Set cached data in memory
   * @private
   */
  _setMemoryCachedData(cacheKey, data, ttl) {
    if (!cacheKey) return;

    this.memoryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear memory cache
   */
  clearMemoryCache(pattern) {
    if (!pattern) {
      this.memoryCache.clear();
      this._log('🗑️  Memory cache cleared');
      return;
    }

    // Clear cache entries matching pattern
    const regex = new RegExp(pattern);
    for (const [key] of this.memoryCache) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }
    this._log(`🗑️  Memory cache cleared (pattern: ${pattern})`);
  }

  /**
   * Clear localStorage cache
   */
  clearLocalStorageCache(pattern) {
    if (!pattern) {
      this.localStorageCache.clearAll();
      this._log('🗑️  LocalStorage cache cleared');
      return;
    }

    this.localStorageCache.clear(pattern);
    this._log(`🗑️  LocalStorage cache cleared (pattern: ${pattern})`);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(pattern) {
    this.clearMemoryCache(pattern);
    this.clearLocalStorageCache(pattern);
    this._log('🗑️  All caches cleared');
  }

  /**
   * Get queue and cache statistics
   */
  getStats() {
    const localStorageStats = this.localStorageCache.getStats();
    const totalCacheHits =
      this.stats.memoryCacheHits + this.stats.localStorageCacheHits;
    const cacheHitRate =
      this.stats.totalRequests > 0
        ? ((totalCacheHits / this.stats.totalRequests) * 100).toFixed(1)
        : 0;

    return {
      ...this.stats,
      totalCacheHits,
      cacheHitRate: `${cacheHitRate}%`,
      queue: this.queue.getStats(),
      memoryCache: {
        size: this.memoryCache.size,
        enabled: this.enableMemoryCache,
      },
      localStorage: localStorageStats,
      pendingRequests: this.pendingRequests.size,
    };
  }

  /**
   * Wait for all pending requests to complete
   */
  async waitForCompletion() {
    return this.queue.waitForCompletion();
  }

  /**
   * Cancel all pending requests
   */
  cancel() {
    this.queue.cancel();
    this.pendingRequests.clear();
    this._log('🛑 All pending requests cancelled');
  }

  /**
   * Format TTL for display
   * @private
   */
  _formatTTL(ttl) {
    if (ttl < 60000) return `${(ttl / 1000).toFixed(0)}s`;
    if (ttl < 3600000) return `${(ttl / 60000).toFixed(0)}m`;
    return `${(ttl / 3600000).toFixed(0)}h`;
  }

  /**
   * Sleep utility
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Logging utility
   * @private
   */
  _log(message) {
    const ts = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${ts}] [${this.name}] ${message}`);
  }
}
