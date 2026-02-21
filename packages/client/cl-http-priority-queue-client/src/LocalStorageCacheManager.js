/**
 * LocalStorage Cache Manager
 * Handles persistent caching of HTTP responses in browser localStorage
 * with automatic expiration, size management, and versioning
 */

const CACHE_VERSION = '1';
const CACHE_PREFIX = 'buydy_api_cache_';
const CACHE_METADATA_KEY = `${CACHE_PREFIX}metadata`;
const DEFAULT_MAX_CACHE_SIZE_MB = 5; // 5MB default limit
const DEFAULT_MAX_CACHE_ENTRIES = 500; // Max number of cached entries

export class LocalStorageCacheManager {
  constructor({
    version = CACHE_VERSION,
    prefix = CACHE_PREFIX,
    maxSizeMB = DEFAULT_MAX_CACHE_SIZE_MB,
    maxEntries = DEFAULT_MAX_CACHE_ENTRIES,
    onCacheFull,
    onEviction,
  } = {}) {
    this.version = version;
    this.prefix = prefix;
    this.maxSizeBytes = maxSizeMB * 1024 * 1024;
    this.maxEntries = maxEntries;
    this.onCacheFull = onCacheFull;
    this.onEviction = onEviction;

    // Check localStorage availability
    this.isAvailable = this._checkLocalStorageAvailability();

    if (this.isAvailable) {
      this._initializeMetadata();
      this._migrateIfNeeded();
    }
  }

  /**
   * Check if localStorage is available
   * @private
   */
  _checkLocalStorageAvailability() {
    try {
      const test = '__buydy_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn(
        '[LocalStorageCache] localStorage not available:',
        e.message,
      );
      return false;
    }
  }

  /**
   * Initialize metadata
   * @private
   */
  _initializeMetadata() {
    try {
      const metadata = this._getMetadata();
      if (!metadata || metadata.version !== this.version) {
        this._setMetadata({
          version: this.version,
          createdAt: Date.now(),
          entries: {},
          totalSize: 0,
        });
      }
    } catch (e) {
      console.error('[LocalStorageCache] Failed to initialize metadata:', e);
    }
  }

  /**
   * Get cache metadata
   * @private
   */
  _getMetadata() {
    try {
      const data = localStorage.getItem(CACHE_METADATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Set cache metadata
   * @private
   */
  _setMetadata(metadata) {
    try {
      localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (e) {
      console.error('[LocalStorageCache] Failed to set metadata:', e);
    }
  }

  /**
   * Migrate cache if version changed
   * @private
   */
  _migrateIfNeeded() {
    const metadata = this._getMetadata();
    if (metadata && metadata.version !== this.version) {
      console.log(
        `[LocalStorageCache] Migrating from v${metadata.version} to v${this.version}`,
      );
      this.clearAll();
      this._initializeMetadata();
    }
  }

  /**
   * Generate full cache key
   * @private
   */
  _getFullKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * Estimate size of data in bytes
   * @private
   */
  _estimateSize(data) {
    try {
      const str = JSON.stringify(data);
      // Rough estimate: 2 bytes per character (UTF-16)
      return str.length * 2;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Get cached data if valid
   * @param {string} key - Cache key
   * @returns {any|null} - Cached data or null
   */
  get(key) {
    if (!this.isAvailable) return null;

    try {
      const fullKey = this._getFullKey(key);
      const cached = localStorage.getItem(fullKey);

      if (!cached) return null;

      const { data, timestamp, ttl } = JSON.parse(cached);
      const now = Date.now();

      // Check if expired
      if (ttl && now - timestamp > ttl) {
        this.delete(key);
        return null;
      }

      return data;
    } catch (e) {
      console.error('[LocalStorageCache] Failed to get cache:', e);
      return null;
    }
  }

  /**
   * Set cached data
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   * @returns {boolean} - Success status
   */
  set(key, data, ttl) {
    if (!this.isAvailable) return false;

    try {
      const fullKey = this._getFullKey(key);
      const cacheEntry = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      const entrySize = this._estimateSize(cacheEntry);

      // Check if we need to make space
      const metadata = this._getMetadata();
      if (metadata) {
        // Evict if at max entries
        if (Object.keys(metadata.entries).length >= this.maxEntries) {
          this._evictOldest();
        }

        // Evict if cache is too large
        if (metadata.totalSize + entrySize > this.maxSizeBytes) {
          this._evictLRU(entrySize);
        }
      }

      // Store the entry
      localStorage.setItem(fullKey, JSON.stringify(cacheEntry));

      // Update metadata
      const newMetadata = this._getMetadata();
      if (newMetadata) {
        newMetadata.entries[key] = {
          size: entrySize,
          timestamp: Date.now(),
          accessCount: 0,
        };
        newMetadata.totalSize = (newMetadata.totalSize || 0) + entrySize;
        this._setMetadata(newMetadata);
      }

      return true;
    } catch (e) {
      console.error('[LocalStorageCache] Failed to set cache:', e);

      // If quota exceeded, try to make space
      if (e.name === 'QuotaExceededError') {
        if (this.onCacheFull) this.onCacheFull();
        this._evictHalf();
        // Try again after eviction
        return this.set(key, data, ttl);
      }

      return false;
    }
  }

  /**
   * Delete cached entry
   * @param {string} key - Cache key
   */
  delete(key) {
    if (!this.isAvailable) return;

    try {
      const fullKey = this._getFullKey(key);
      localStorage.removeItem(fullKey);

      // Update metadata
      const metadata = this._getMetadata();
      if (metadata && metadata.entries[key]) {
        metadata.totalSize -= metadata.entries[key].size || 0;
        delete metadata.entries[key];
        this._setMetadata(metadata);
      }
    } catch (e) {
      console.error('[LocalStorageCache] Failed to delete cache:', e);
    }
  }

  /**
   * Clear cache entries matching pattern
   * @param {string|RegExp} pattern - Pattern to match keys
   */
  clear(pattern) {
    if (!this.isAvailable) return;

    try {
      const metadata = this._getMetadata();
      if (!metadata) return;

      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      const keysToDelete = Object.keys(metadata.entries).filter((key) =>
        regex.test(key),
      );

      keysToDelete.forEach((key) => this.delete(key));
    } catch (e) {
      console.error('[LocalStorageCache] Failed to clear cache:', e);
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll() {
    if (!this.isAvailable) return;

    try {
      const metadata = this._getMetadata();
      if (!metadata) return;

      Object.keys(metadata.entries).forEach((key) => {
        const fullKey = this._getFullKey(key);
        localStorage.removeItem(fullKey);
      });

      this._setMetadata({
        version: this.version,
        createdAt: Date.now(),
        entries: {},
        totalSize: 0,
      });
    } catch (e) {
      console.error('[LocalStorageCache] Failed to clear all cache:', e);
    }
  }

  /**
   * Evict oldest entries
   * @private
   */
  _evictOldest() {
    const metadata = this._getMetadata();
    if (!metadata) return;

    const entries = Object.entries(metadata.entries);
    if (entries.length === 0) return;

    // Sort by timestamp
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Evict oldest 10%
    const countToEvict = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < countToEvict; i++) {
      const [key] = entries[i];
      this.delete(key);
      if (this.onEviction) this.onEviction(key, 'oldest');
    }
  }

  /**
   * Evict least recently used entries to make space
   * @private
   */
  _evictLRU(neededSpace) {
    const metadata = this._getMetadata();
    if (!metadata) return;

    const entries = Object.entries(metadata.entries);
    if (entries.length === 0) return;

    // Sort by access count (LRU)
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount);

    // Evict until we have enough space
    let freedSpace = 0;
    let evictedCount = 0;

    for (const [key, entry] of entries) {
      if (freedSpace >= neededSpace) break;

      freedSpace += entry.size || 0;
      this.delete(key);
      evictedCount++;

      if (this.onEviction) this.onEviction(key, 'lru');
    }

    console.log(
      `[LocalStorageCache] Evicted ${evictedCount} entries (${(
        freedSpace / 1024
      ).toFixed(2)}KB)`,
    );
  }

  /**
   * Evict half of the cache
   * @private
   */
  _evictHalf() {
    const metadata = this._getMetadata();
    if (!metadata) return;

    const entries = Object.entries(metadata.entries);
    const countToEvict = Math.ceil(entries.length / 2);

    // Sort by timestamp
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (let i = 0; i < countToEvict; i++) {
      const [key] = entries[i];
      this.delete(key);
    }

    console.log(
      `[LocalStorageCache] Evicted ${countToEvict} entries (cache full)`,
    );
  }

  /**
   * Get cache statistics
   */
  getStats() {
    if (!this.isAvailable) {
      return {
        available: false,
        entries: 0,
        size: 0,
        sizeMB: 0,
      };
    }

    try {
      const metadata = this._getMetadata();
      if (!metadata) {
        return {
          available: true,
          entries: 0,
          size: 0,
          sizeMB: 0,
        };
      }

      return {
        available: true,
        version: metadata.version,
        entries: Object.keys(metadata.entries).length,
        maxEntries: this.maxEntries,
        size: metadata.totalSize,
        sizeMB: (metadata.totalSize / (1024 * 1024)).toFixed(2),
        maxSizeMB: (this.maxSizeBytes / (1024 * 1024)).toFixed(2),
        usage: ((metadata.totalSize / this.maxSizeBytes) * 100).toFixed(1),
      };
    } catch (e) {
      console.error('[LocalStorageCache] Failed to get stats:', e);
      return {
        available: true,
        entries: 0,
        size: 0,
        sizeMB: 0,
      };
    }
  }
}
