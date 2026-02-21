/**
 * Database Initialization
 * Handles database connection and cleanup operations
 */

import { getDatabase } from "@buydy/se-db";
import logger from "@buydy/se-logger";
import { cleanupStuckJobs } from "../cleanup-stuck-jobs.js";

export class DatabaseInitializer {
  /**
   * Initialize database connection
   */
  async initialize() {
    logger.business("🔗 Bootstrapping database connection...");

    try {
      await getDatabase();
      logger.debug("✅ Database connection established");
    } catch (error) {
      logger.business("❌ Failed to connect to database", { error: error.message });
      throw error;
    }
  }

  /**
   * Clean up stuck jobs from previous runs
   */
  async cleanupStuckJobs() {
    logger.business("🧹 Cleaning up stuck jobs from previous runs...");

    try {
      await cleanupStuckJobs();
      logger.debug("✅ Stuck jobs cleanup completed");
    } catch (error) {
      logger.business("⚠️  Stuck jobs cleanup failed", { error: error.message });
      // Don't exit - continue with startup
    }
  }
}
