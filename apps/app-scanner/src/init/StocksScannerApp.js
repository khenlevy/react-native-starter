/**
 * Stocks Scanner Application Initializer
 * Orchestrates the initialization of all application components
 */

import logger from "@buydy/se-logger";
import { EODHDLimitManager } from "./EODHDLimitManager.js";
import { APIQueueInitializer } from "./APIQueueInitializer.js";
import { DatabaseInitializer } from "./DatabaseInitializer.js";
import { CycledListInitializer } from "./CycledListInitializer.js";

export class StocksScannerApp {
  constructor() {
    this.limitManager = new EODHDLimitManager();
    this.apiQueueInitializer = new APIQueueInitializer();
    this.databaseInitializer = new DatabaseInitializer();
    this.cycledListInitializer = new CycledListInitializer(this.limitManager);
    this.isShuttingDown = false;
  }

  /**
   * Start the application
   */
  async start() {
    try {
      logger.business("🚀 Starting Stocks Scanner with CycledLinkedList...");

      // Step 1: Initialize API queue
      await this.apiQueueInitializer.initialize();

      // Step 2: Initialize database
      await this.databaseInitializer.initialize();

      // Step 3: Clean up stuck jobs
      await this.databaseInitializer.cleanupStuckJobs();

      // Step 4: Initialize cycled list system
      await this.cycledListInitializer.initialize();

      // Step 5: Start status logging
      this.cycledListInitializer.startStatusLogging();

      logger.business("✅ Application started successfully");
      logger.business("🔄 Stocks Scanner is now running with continuous cycling");
      logger.business("⚡ Cycles run continuously - starting immediately after each completion");
    } catch (error) {
      logger.business("💥 Application startup failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.business("🛑 Shutting down application...");
    this.isShuttingDown = true;

    // Shutdown cycled list
    await this.cycledListInitializer.shutdown();

    logger.debug("✅ Application shutdown complete");
  }

  /**
   * Get the cycled list instance for external access
   */
  getCycledList() {
    return this.cycledListInitializer.cycledList;
  }

  /**
   * Get the API queue instance for external access
   */
  getAPIQueue() {
    return this.apiQueueInitializer.getQueue();
  }

  /**
   * Get the limit manager instance for external access
   */
  getLimitManager() {
    return this.limitManager;
  }
}
