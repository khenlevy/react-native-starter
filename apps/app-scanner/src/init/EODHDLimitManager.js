/**
 * EODHD Limit Detection and Cancellation System
 * Handles API limit detection, daily reset logic, and external operations cancellation
 */

import logger from "@buydy/se-logger";

export class EODHDLimitManager {
  constructor() {
    this.isLimitReached = false;
    this.lastLimitCheck = null;
    this.dailyResetTime = null;
  }

  /**
   * Check if EODHD daily limit is reached
   */
  async checkEODHDLimit(error = null) {
    try {
      // First, check if the error parameter indicates a limit reached
      if (error) {
        const errorMessage = error.message || error.toString();
        logger.business("🔍 Checking error for EODHD limit", { errorMessage });

        if (
          errorMessage.includes("402") ||
          errorMessage.includes("Payment Required") ||
          errorMessage.includes("exceeded your daily API requests limit") ||
          errorMessage.includes("You exceeded your daily API requests limit") ||
          errorMessage.includes("Cannot convert circular structure to BSON")
        ) {
          this.isLimitReached = true;
          this.dailyResetTime = this.calculateNextDayReset();
          logger.business(
            "🚨 EODHD daily limit reached (from error) - scheduling pause until tomorrow"
          );
          return true;
        }
      }

      // Check if we have a global API queue to inspect
      const apiQueue = globalThis.__BUYDY_API_PRIORITY_QUEUE__;
      if (!apiQueue) {
        logger.business("⚠️ No global API queue found for EODHD limit check");
        return false;
      }

      // Check for 429/402 errors in recent requests
      const queueResults = apiQueue.getResults ? apiQueue.getResults() : { errors: [] };
      const recentErrors = queueResults.errors || [];
      logger.business("🔍 Checking EODHD limit", {
        recentErrorsCount: recentErrors.length,
        errors: recentErrors.map((e) => ({ status: e.status, message: e.message })),
      });

      const hasLimitErrors = recentErrors.some(
        (error) =>
          error.status === 429 ||
          error.status === 402 ||
          error.message?.includes("daily limit") ||
          error.message?.includes("exceeded your daily API requests limit") ||
          error.message?.includes("You exceeded your daily API requests limit") ||
          error.message?.includes("Payment Required")
      );

      if (hasLimitErrors) {
        this.isLimitReached = true;
        this.dailyResetTime = this.calculateNextDayReset();
        logger.business("🚨 EODHD daily limit reached - scheduling pause until tomorrow");
        return true;
      }

      return false;
    } catch (error) {
      logger.business("❌ Error checking EODHD limit", { error: error.message });
      return false;
    }
  }

  /**
   * Check if it's a new day and limits should be reset
   */
  async checkDailyReset() {
    if (!this.isLimitReached) {
      return true; // No limit, continue
    }

    const now = new Date();
    const isNewDay = this.dailyResetTime && now >= this.dailyResetTime;

    if (isNewDay) {
      this.isLimitReached = false;
      this.dailyResetTime = null;
      logger.business("✅ New day detected - EODHD limits reset, resuming operations");
      return true;
    }

    return false;
  }

  /**
   * Calculate when the next day starts (UTC midnight)
   */
  calculateNextDayReset() {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Check if an EODHD error should cause a job to fail (throw error)
   * This is used by job functions to determine if they should throw on EODHD errors
   */
  shouldThrowOnEODHDError(error) {
    if (!error) return false;

    const errorMessage = error.message || error.toString();
    const statusCode = error.response?.status || error.status;

    // Check for EODHD daily limit errors
    if (
      statusCode === 402 ||
      errorMessage.includes("402") ||
      errorMessage.includes("Payment Required") ||
      errorMessage.includes("exceeded your daily API requests limit") ||
      errorMessage.includes("You exceeded your daily API requests limit") ||
      errorMessage.includes("Cannot convert circular structure to BSON")
    ) {
      logger.business("🚨 EODHD daily limit detected - job should fail to trigger pause", {
        statusCode,
        errorMessage: errorMessage.substring(0, 100),
      });
      return true;
    }

    return false;
  }

  /**
   * Cancel external operations (HTTP requests, DB connections, etc.)
   */
  async cancelExternalOperations() {
    logger.business("🛑 Cancelling external operations...");

    try {
      // Cancel API queue operations
      const apiQueue = globalThis.__BUYDY_API_PRIORITY_QUEUE__;
      if (apiQueue && apiQueue.cancelAll) {
        await apiQueue.cancelAll();
        logger.business("🛑 API queue operations cancelled");
      }

      // Cancel any ongoing database operations
      // Note: MongoDB operations are generally not cancellable, but we can log this
      logger.business("🛑 External operations cancellation completed");
    } catch (error) {
      logger.business("❌ Error during external operations cancellation", { error: error.message });
    }
  }
}
