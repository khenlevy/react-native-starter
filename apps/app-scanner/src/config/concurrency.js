/**
 * Concurrency configuration for API requests
 *
 * This configuration is used across all jobs to control the number of
 * parallel API requests made to external services (e.g., EODHD API).
 */

/**
 * Maximum number of concurrent API requests allowed
 * Can be overridden via MAX_CONCURRENT_API_REQUESTS environment variable
 * Reduced from 15 to 8 to prevent OOM crashes with parallel execution
 */
export const DEFAULT_MAX_CONCURRENT_REQUESTS = 8;

/**
 * Get the configured max concurrent requests value
 * @returns {number} Maximum number of concurrent requests
 */
export function getMaxConcurrentRequests() {
  const envValue = parseInt(process.env.MAX_CONCURRENT_API_REQUESTS);
  return envValue > 0 ? envValue : DEFAULT_MAX_CONCURRENT_REQUESTS;
}

// Global shared AsyncPriorityQueue instance for all API work across jobs
// Lazy-initialized to avoid circular imports
let __globalQueue = null;

export function getGlobalApiQueue() {
  if (!__globalQueue) {
    // Import lazily to avoid top-level import cycles
    const { AsyncQueueManager } = require("@buydy/dv-async-priority-queue");
    __globalQueue = new AsyncQueueManager({
      maxConcurrency: getMaxConcurrentRequests(),
      name: "GlobalAPIQueue",
      verbose: process.env.QUEUE_VERBOSE_LOGGING === "true",
    });
  }
  return __globalQueue;
}
