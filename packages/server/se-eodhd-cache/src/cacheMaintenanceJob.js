/**
 * Cache Maintenance Job
 *
 * Ensures the cache doesn't store data forever by:
 * 1. Running scheduled cleanup of expired entries
 * 2. Enforcing maximum cache size limits
 * 3. Providing cache health monitoring
 */

import { getDatabase } from "@buydy/se-db";
import logger from "@buydy/se-logger";

export class CacheMaintenanceJob {
  constructor(options = {}) {
    this.collectionName = options.collectionName || "cached_response_eodhistoricaldata";
    this.maxCacheSizeMB = options.maxCacheSizeMB || 500; // 500 MB default
    this.maxDocuments = options.maxDocuments || 100000; // 100k documents
    this.cleanupIntervalMs = options.cleanupIntervalMs || 60 * 60 * 1000; // 1 hour
    this.intervalId = null;
    this.db = null;
    this.collection = null;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    try {
      this.db = await getDatabase();
      this.collection = this.db.collection(this.collectionName);
      logger.debug("✅ Cache maintenance job initialized");
    } catch (error) {
      logger.business("❌ Failed to initialize cache maintenance:", error);
      throw error;
    }
  }

  /**
   * Start scheduled maintenance
   */
  start() {
    if (this.intervalId) {
      logger.debug("⚠️  Cache maintenance already running");
      return;
    }

    logger.business(
      `🔧 Starting cache maintenance job (every ${this.cleanupIntervalMs / 1000 / 60} minutes)`
    );

    // Run immediately
    this.runMaintenance();

    // Schedule recurring maintenance
    this.intervalId = setInterval(() => {
      this.runMaintenance();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop scheduled maintenance
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.business("🛑 Cache maintenance job stopped");
    }
  }

  /**
   * Run all maintenance tasks
   */
  async runMaintenance() {
    try {
      logger.debug("🧹 Running cache maintenance...");

      const stats = await this.getCacheStats();
      logger.debug(`📊 Cache stats: ${JSON.stringify(stats)}`);

      // Task 1: Clean up expired entries (backup for TTL index)
      const expiredCount = await this.cleanupExpired();

      // Task 2: Enforce size limits
      const sizeCleanupCount = await this.enforceSizeLimits(stats);

      // Task 3: Clean up orphaned entries (optional)
      const orphanedCount = await this.cleanupOrphaned();

      const totalCleaned = expiredCount + sizeCleanupCount + orphanedCount;

      if (totalCleaned > 0) {
        logger.business(`✅ Cache maintenance completed: ${totalCleaned} entries removed`);
        logger.debug(
          `   - Expired: ${expiredCount}, Size limit: ${sizeCleanupCount}, Orphaned: ${orphanedCount}`
        );
      } else {
        logger.debug("✅ Cache maintenance completed: no cleanup needed");
      }
    } catch (error) {
      logger.business("❌ Cache maintenance failed:", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    const stats = await this.collection
      .aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            expired: [{ $match: { expiresAt: { $lte: new Date() } } }, { $count: "count" }],
            sizeStats: [
              {
                $group: {
                  _id: null,
                  totalSize: { $sum: { $bsonSize: "$$ROOT" } },
                  avgSize: { $avg: { $bsonSize: "$$ROOT" } },
                  maxSize: { $max: { $bsonSize: "$$ROOT" } },
                },
              },
            ],
            byEndpoint: [
              {
                $group: {
                  _id: "$apiEndpoint",
                  count: { $sum: 1 },
                  totalSize: { $sum: { $bsonSize: "$$ROOT" } },
                },
              },
              { $sort: { count: -1 } },
              { $limit: 10 },
            ],
          },
        },
      ])
      .toArray();

    const result = stats[0];

    return {
      total: result.total[0]?.count || 0,
      expired: result.expired[0]?.count || 0,
      active: (result.total[0]?.count || 0) - (result.expired[0]?.count || 0),
      totalSizeMB: ((result.sizeStats[0]?.totalSize || 0) / 1024 / 1024).toFixed(2),
      avgSizeKB: ((result.sizeStats[0]?.avgSize || 0) / 1024).toFixed(2),
      maxSizeKB: ((result.sizeStats[0]?.maxSize || 0) / 1024).toFixed(2),
      byEndpoint: result.byEndpoint,
    };
  }

  /**
   * Clean up expired entries (backup for TTL index)
   * TTL index runs every 60 seconds, this ensures immediate cleanup
   */
  async cleanupExpired() {
    try {
      const result = await this.collection.deleteMany({
        expiresAt: { $lte: new Date() },
      });

      if (result.deletedCount > 0) {
        logger.debug(`🗑️  Removed ${result.deletedCount} expired cache entries`);
      }

      return result.deletedCount;
    } catch (error) {
      logger.business("Error cleaning expired cache entries:", error);
      return 0;
    }
  }

  /**
   * Enforce cache size limits
   * If cache exceeds limits, remove oldest entries first
   */
  async enforceSizeLimits(stats) {
    let removedCount = 0;

    try {
      // Check document count limit
      if (stats.total > this.maxDocuments) {
        const excessCount = stats.total - this.maxDocuments;
        logger.business(`⚠️  Cache exceeds document limit (${stats.total} > ${this.maxDocuments})`);

        // Get oldest entries to remove
        const oldestEntries = await this.collection
          .find()
          .sort({ createdAt: 1 })
          .limit(excessCount)
          .project({ _id: 1 })
          .toArray();

        const idsToRemove = oldestEntries.map((doc) => doc._id);

        const result = await this.collection.deleteMany({
          _id: { $in: idsToRemove },
        });

        removedCount += result.deletedCount;
        logger.business(`🗑️  Removed ${result.deletedCount} oldest cache entries`);
      }

      // Check size limit
      const sizeMB = parseFloat(stats.totalSizeMB);
      if (sizeMB > this.maxCacheSizeMB) {
        logger.business(`⚠️  Cache exceeds size limit (${sizeMB} MB > ${this.maxCacheSizeMB} MB)`);

        // Remove oldest 10% of entries
        const removeCount = Math.floor(stats.total * 0.1);

        const oldestEntries = await this.collection
          .find()
          .sort({ createdAt: 1 })
          .limit(removeCount)
          .project({ _id: 1 })
          .toArray();

        const idsToRemove = oldestEntries.map((doc) => doc._id);

        const result = await this.collection.deleteMany({
          _id: { $in: idsToRemove },
        });

        removedCount += result.deletedCount;
        logger.business(`🗑️  Removed ${result.deletedCount} entries to reduce cache size`);
      }

      return removedCount;
    } catch (error) {
      logger.business("Error enforcing cache size limits:", error);
      return removedCount;
    }
  }

  /**
   * Clean up orphaned entries (entries with missing required fields)
   */
  async cleanupOrphaned() {
    try {
      const result = await this.collection.deleteMany({
        $or: [
          { cacheKey: { $exists: false } },
          { cacheKey: null },
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { data: { $exists: false } },
        ],
      });

      if (result.deletedCount > 0) {
        logger.business(`🗑️  Removed ${result.deletedCount} orphaned cache entries`);
      }

      return result.deletedCount;
    } catch (error) {
      logger.business("Error cleaning orphaned cache entries:", error);
      return 0;
    }
  }

  /**
   * Get cache health report
   */
  async getHealthReport() {
    const stats = await this.getCacheStats();

    const health = {
      status: "healthy",
      warnings: [],
      stats,
      timestamp: new Date(),
    };

    // Check for issues
    if (stats.total > this.maxDocuments * 0.9) {
      health.warnings.push(`Approaching document limit: ${stats.total}/${this.maxDocuments}`);
      health.status = "warning";
    }

    if (parseFloat(stats.totalSizeMB) > this.maxCacheSizeMB * 0.9) {
      health.warnings.push(
        `Approaching size limit: ${stats.totalSizeMB} MB / ${this.maxCacheSizeMB} MB`
      );
      health.status = "warning";
    }

    if (stats.expired > stats.total * 0.1) {
      health.warnings.push(
        `High expired entry count: ${stats.expired} (${(
          (stats.expired / stats.total) *
          100
        ).toFixed(1)}%)`
      );
    }

    return health;
  }

  /**
   * Emergency cache flush (use with caution)
   */
  async emergencyFlush() {
    logger.business("🚨 EMERGENCY CACHE FLUSH - Clearing all cache entries");

    const result = await this.collection.deleteMany({});

    logger.business(`🗑️  Emergency flush completed: ${result.deletedCount} entries removed`);

    return result.deletedCount;
  }
}

export default CacheMaintenanceJob;
