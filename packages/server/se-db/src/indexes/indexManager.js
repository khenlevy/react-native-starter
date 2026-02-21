/**
 * Resilient Index Manager
 *
 * Creates MongoDB indexes with resilience features:
 * - Priority-based creation (critical indexes first)
 * - Retry logic with exponential backoff
 * - Parallel processing with concurrency limits
 * - Timeout handling
 * - Index validation after creation
 * - Progress tracking
 * - Health checks
 *
 * SAFETY GUARANTEES:
 * - Never modifies or deletes documents
 * - Never modifies or deletes existing indexes
 * - Only creates new indexes that don't exist
 * - Non-blocking (background index creation)
 * - Errors don't break database connection
 * - Fully idempotent - safe to run multiple times
 */

import logger from "@buydy/se-logger";
import { indexRules } from "./indexRules.js";

// Configuration constants
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 10000; // 10 seconds
const INDEX_CREATION_TIMEOUT_MS = 300000; // 5 minutes per index
const MAX_PARALLEL_INDEXES = 3; // Create max 3 indexes in parallel
const VALIDATION_RETRY_DELAY_MS = 2000; // Wait 2s before validating new index

// Fast-path check: Sample a critical collection to see if indexes are already complete
// If this collection has all its indexes, assume others do too (optimistic check)
const FAST_PATH_CHECK_COLLECTION = "fundamentals"; // Most critical collection with most indexes

/**
 * Normalize index key for comparison
 * MongoDB indexes can have the same keys but different orders, so we sort the keys
 * @param {Object} key - Index key object
 * @returns {string} Normalized key string
 */
function normalizeIndexKey(key) {
  // Sort keys to ensure consistent comparison
  const sortedEntries = Object.entries(key).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(sortedEntries));
}

/**
 * Sleep utility for retries
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempt) {
  const delay = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Check if error is retryable
 * @param {Error} error - Error object
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error) {
  // Retry on network errors, timeouts, and temporary MongoDB errors
  const retryableCodes = [
    6, // HostUnreachable
    7, // HostNotFound
    50, // MaxTimeMSExpired
    89, // NetworkTimeout
    91, // ShutdownInProgress
    11600, // InterruptedAtShutdown
    11602, // InterruptedDueToReplStateChange
  ];

  const retryableMessages = [
    "connection",
    "timeout",
    "network",
    "temporary",
    "transient",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
  ];

  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }

  const errorMessage = error.message?.toLowerCase() || "";
  return retryableMessages.some((msg) => errorMessage.includes(msg));
}

/**
 * Check if error indicates index already exists (harmless)
 * @param {Error} error - Error object
 * @returns {boolean} True if index already exists
 */
function isIndexExistsError(error) {
  return (
    error.message?.includes("already exists") ||
    error.code === 85 || // IndexAlreadyExists
    error.code === 86 // IndexOptionsConflict
  );
}

/**
 * Create a single index with retry logic
 * @param {Object} collection - MongoDB collection
 * @param {Object} rule - Index rule
 * @param {string} collectionName - Collection name
 * @returns {Promise<Object>} Result object
 */
async function createIndexWithRetry(collection, rule, collectionName) {
  const normalizedKey = normalizeIndexKey(rule.fields);
  const indexName =
    rule.options?.name ||
    Object.keys(rule.fields).join("_") + "_" + Object.values(rule.fields).join("_");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const indexOptions = {
        background: true, // Non-blocking
        ...(rule.options || {}),
      };

      // Create index with timeout
      const createPromise = collection.createIndex(rule.fields, indexOptions);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Index creation timeout")), INDEX_CREATION_TIMEOUT_MS)
      );

      await Promise.race([createPromise, timeoutPromise]);

      // Wait a bit before validating to ensure index is ready
      await sleep(VALIDATION_RETRY_DELAY_MS);

      // Validate index was created successfully
      const indexes = await collection.indexes();
      const indexExists = indexes.some((idx) => normalizeIndexKey(idx.key) === normalizedKey);

      if (!indexExists) {
        throw new Error("Index creation succeeded but index not found during validation");
      }

      return {
        success: true,
        collection: collectionName,
        fields: rule.fields,
        indexName,
        attempt: attempt + 1,
      };
    } catch (error) {
      // Check if index already exists (harmless, can happen due to race conditions)
      if (isIndexExistsError(error)) {
        return {
          success: true,
          collection: collectionName,
          fields: rule.fields,
          indexName,
          skipped: true,
          reason: "already exists",
        };
      }

      // If not retryable or last attempt, fail
      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        return {
          success: false,
          collection: collectionName,
          fields: rule.fields,
          indexName,
          error: error.message,
          code: error.code,
          attempts: attempt + 1,
        };
      }

      // Retry with exponential backoff
      const delay = calculateBackoffDelay(attempt);
      logger.debug(
        `⏳ Retrying index creation (attempt ${
          attempt + 1
        }/${MAX_RETRIES}) for ${collectionName}: ${indexName} after ${delay}ms`
      );
      await sleep(delay);
    }
  }
}

/**
 * Process indexes in parallel batches with concurrency limit
 * @param {Array} tasks - Array of index creation tasks
 * @param {number} concurrency - Maximum parallel operations
 * @returns {Promise<Array>} Results array
 */
async function processInBatches(tasks, concurrency = MAX_PARALLEL_INDEXES) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const promise = task().then((result) => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });

    executing.push(promise);
    results.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

/**
 * Sort indexes by priority (critical first)
 * Uses priority field from index rules, or falls back to heuristics
 * @param {Array} rules - Index rules
 * @returns {Array} Sorted rules
 */
function prioritizeIndexes(rules) {
  return [...rules].sort((a, b) => {
    // Use explicit priority if available (1 = critical, 4 = low)
    const priorityA = a.priority ?? (a.options?.unique ? 1 : 4);
    const priorityB = b.priority ?? (b.options?.unique ? 1 : 4);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // If priorities are equal, use heuristics as tiebreaker
    // Unique indexes first
    const aIsUnique = a.options?.unique === true;
    const bIsUnique = b.options?.unique === true;
    if (aIsUnique && !bIsUnique) return -1;
    if (!aIsUnique && bIsUnique) return 1;

    // Compound indexes before single-field (more specific queries)
    const aIsCompound = Object.keys(a.fields).length > 1;
    const bIsCompound = Object.keys(b.fields).length > 1;
    if (aIsCompound && !bIsCompound) return -1;
    if (!aIsCompound && bIsCompound) return 1;

    return 0;
  });
}

/**
 * Quick check to see if indexes are already complete (fast-path optimization)
 * Checks a critical collection - if it has all indexes, assume others do too
 * @param {Object} db - MongoDB database instance
 * @returns {Promise<boolean>} True if indexes appear complete, false if check needed
 */
async function quickIndexCheck(db) {
  try {
    const sampleRules = indexRules[FAST_PATH_CHECK_COLLECTION];
    if (!sampleRules || sampleRules.length === 0) {
      return false; // No rules to check, proceed with full check
    }

    const collection = db.collection(FAST_PATH_CHECK_COLLECTION);

    // Check if collection exists
    const collections = await db.listCollections({ name: FAST_PATH_CHECK_COLLECTION }).toArray();
    if (collections.length === 0) {
      return false; // Collection doesn't exist, proceed with full check
    }

    // Get existing indexes
    const existing = await collection.indexes();
    const existingKeys = new Set(existing.map((idx) => normalizeIndexKey(idx.key)));

    // Check if all sample rules exist
    const allExist = sampleRules.every((rule) => {
      const normalizedKey = normalizeIndexKey(rule.fields);
      return existingKeys.has(normalizedKey);
    });

    return allExist;
  } catch (error) {
    // If quick check fails, proceed with full check (safe fallback)
    logger.debug(`Quick index check failed, proceeding with full check: ${error.message}`);
    return false;
  }
}

/**
 * Ensure all indexes exist based on index rules
 * Compares existing indexes with rules and creates missing ones
 *
 * @param {Object} db - MongoDB database instance
 * @param {Object} options - Configuration options
 * @param {boolean} options.parallel - Enable parallel index creation (default: true)
 * @param {number} options.maxParallel - Max parallel indexes (default: 3)
 * @param {boolean} options.prioritize - Prioritize critical indexes (default: true)
 * @param {boolean} options.skipQuickCheck - Skip fast-path optimization (default: false)
 * @returns {Promise<Object>} Report of created indexes
 */
export async function ensureIndexes(db, options = {}) {
  const {
    parallel = true,
    maxParallel = MAX_PARALLEL_INDEXES,
    prioritize = true,
    skipQuickCheck = false,
  } = options;

  const report = {
    created: [],
    skipped: [],
    errors: [],
    total: 0,
    startTime: Date.now(),
    quickCheckSkipped: false,
  };

  // Fast-path: Quick check if indexes are already complete
  if (!skipQuickCheck) {
    const indexesComplete = await quickIndexCheck(db);
    if (indexesComplete) {
      logger.debug("✅ Quick check: All indexes appear complete, skipping full index check");
      report.quickCheckSkipped = true;
      report.duration = Date.now() - report.startTime;
      return report;
    }
  }

  logger.business("🔍 Starting resilient index optimization process...");
  logger.business(`📋 Index rules defined for ${Object.keys(indexRules).length} collections`);
  logger.business(
    `⚙️  Configuration: parallel=${parallel}, maxParallel=${maxParallel}, prioritize=${prioritize}`
  );

  // Process collections sequentially to avoid overwhelming the database
  for (const [collectionName, rules] of Object.entries(indexRules)) {
    try {
      const collection = db.collection(collectionName);

      // Safely check if collection exists
      let collectionExists = false;
      try {
        const collections = await db.listCollections({ name: collectionName }).toArray();
        collectionExists = collections.length > 0;
      } catch (err) {
        logger.debug(`⏭️  Cannot verify collection ${collectionName}, skipping`);
        continue;
      }

      if (!collectionExists) {
        logger.debug(`⏭️  Collection ${collectionName} doesn't exist, skipping`);
        continue;
      }

      // Get existing indexes
      const existing = await collection.indexes();
      const existingKeys = new Set(existing.map((idx) => normalizeIndexKey(idx.key)));

      logger.business(
        `📊 Collection ${collectionName}: ${existing.length} existing indexes, ${rules.length} rules`
      );

      // Filter out indexes that already exist
      const missingRules = rules.filter((rule) => {
        const normalizedKey = normalizeIndexKey(rule.fields);
        return !existingKeys.has(normalizedKey);
      });

      if (missingRules.length === 0) {
        logger.debug(`  ✓ All indexes exist for ${collectionName}`);
        report.skipped.push(
          ...rules.map((rule) => ({
            collection: collectionName,
            fields: rule.fields,
          }))
        );
        continue;
      }

      // Prioritize indexes if enabled
      const rulesToCreate = prioritize ? prioritizeIndexes(missingRules) : missingRules;

      logger.business(
        `  📝 Creating ${rulesToCreate.length} missing index(es) for ${collectionName}...`
      );

      // Create indexes
      if (parallel && rulesToCreate.length > 1) {
        // Parallel creation with concurrency limit
        const tasks = rulesToCreate.map(
          (rule) => () => createIndexWithRetry(collection, rule, collectionName)
        );

        const results = await processInBatches(tasks, maxParallel);

        for (const result of results) {
          if (result.success) {
            if (result.skipped) {
              report.skipped.push({
                collection: result.collection,
                fields: result.fields,
                reason: result.reason,
              });
              logger.debug(`  ✓ Index already exists: ${JSON.stringify(result.fields)}`);
            } else {
              report.created.push({
                collection: result.collection,
                fields: result.fields,
                indexName: result.indexName,
                attempts: result.attempt,
              });
              report.total++;
              logger.business(
                `  ✅ Created index on ${result.collection}: ${JSON.stringify(
                  result.fields
                )} (attempt ${result.attempt})`
              );
            }
          } else {
            report.errors.push({
              collection: result.collection,
              fields: result.fields,
              indexName: result.indexName,
              error: result.error,
              code: result.code,
              attempts: result.attempts,
            });
            logger.business(
              `  ❌ Failed to create index on ${result.collection}: ${JSON.stringify(
                result.fields
              )}`,
              { error: result.error, code: result.code, attempts: result.attempts }
            );
          }
        }
      } else {
        // Sequential creation
        for (const rule of rulesToCreate) {
          const result = await createIndexWithRetry(collection, rule, collectionName);

          if (result.success) {
            if (result.skipped) {
              report.skipped.push({
                collection: result.collection,
                fields: result.fields,
                reason: result.reason,
              });
              logger.debug(`  ✓ Index already exists: ${JSON.stringify(result.fields)}`);
            } else {
              report.created.push({
                collection: result.collection,
                fields: result.fields,
                indexName: result.indexName,
                attempts: result.attempt,
              });
              report.total++;
              logger.business(
                `  ✅ Created index on ${result.collection}: ${JSON.stringify(
                  result.fields
                )} (attempt ${result.attempt})`
              );
            }
          } else {
            report.errors.push({
              collection: result.collection,
              fields: result.fields,
              indexName: result.indexName,
              error: result.error,
              code: result.code,
              attempts: result.attempts,
            });
            logger.business(
              `  ❌ Failed to create index on ${result.collection}: ${JSON.stringify(
                result.fields
              )}`,
              { error: result.error, code: result.code, attempts: result.attempts }
            );
          }
        }
      }
    } catch (error) {
      // Collection access failed - safe, just skip this collection
      logger.business(`⚠️  Error accessing collection ${collectionName}`, { error: error.message });
      report.errors.push({
        collection: collectionName,
        error: error.message,
      });
    }
  }

  // Calculate duration
  const duration = Date.now() - report.startTime;
  report.duration = duration;

  // Log detailed summary
  logger.business("═".repeat(60));
  logger.business("📊 Resilient Index Optimization Summary:");
  logger.business(`   ✅ Created: ${report.total} new index(es)`);
  logger.business(`   ⏭️  Skipped: ${report.skipped.length} already exist`);
  logger.business(`   ❌ Errors: ${report.errors.length}`);
  logger.business(`   ⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);

  if (report.total > 0) {
    logger.business(`\n✅ Index optimization complete: ${report.total} new index(es) created`);
    logger.business("   This will improve query performance, especially for heatmap queries");
  } else if (report.skipped.length > 0) {
    logger.business(`\n✅ Index optimization complete: All indexes already exist`);
    logger.business(`   ${report.skipped.length} indexes verified and ready`);
  }

  if (report.errors.length > 0) {
    logger.business(`\n⚠️  ${report.errors.length} error(s) occurred during index creation`);
    logger.business("   Check logs above for details (non-fatal, app continues normally)");
  }

  logger.business("═".repeat(60));

  return report;
}
