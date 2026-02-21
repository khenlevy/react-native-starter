/**
 * API Queue Initialization
 * Sets up the global API priority queue for EODHD requests
 */

import { AsyncQueueManager } from "@buydy/dv-async-priority-queue";
import logger from "@buydy/se-logger";
import { getMaxConcurrentRequests } from "../config/concurrency.js";

export class APIQueueInitializer {
  constructor() {
    this.globalApiQueue = null;
  }

  /**
   * Initialize global API queue for EODHD requests
   */
  async initialize() {
    logger.business("🚀 Setting up global API priority queue...");

    const maxConcurrency = getMaxConcurrentRequests();
    this.globalApiQueue = new AsyncQueueManager({
      maxConcurrency,
      name: "GlobalAPIQueue",
      verbose: process.env.QUEUE_VERBOSE_LOGGING === "true",
      onProgress: (completed, total) => {
        logger.debug(
          `📊 API Queue Progress: ${completed}/${total} (${((completed / total) * 100).toFixed(
            1
          )}%)`
        );
      },
    });

    // Make the queue available globally for EODHD client
    globalThis.__BUYDY_API_PRIORITY_QUEUE__ = this.globalApiQueue;
    logger.debug(`✅ Global API queue initialized (maxConcurrency=${maxConcurrency})`);

    return this.globalApiQueue;
  }

  /**
   * Get the initialized API queue
   */
  getQueue() {
    return this.globalApiQueue;
  }
}
