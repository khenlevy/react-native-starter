/**
 * EODHD Error Handler Utility
 * Provides robust error handling for EODHD API calls across all job functions
 */

import { EODHDLimitManager } from "../init/EODHDLimitManager.js";
import logger from "@buydy/se-logger";

/**
 * Wraps an async function to automatically detect and throw EODHD limit errors
 * This ensures consistent error handling across all job functions
 *
 * @param {Function} fn - The async function to wrap
 * @param {string} jobName - Name of the job for logging purposes
 * @returns {Function} - Wrapped function that throws EODHD errors
 */
export function withEODHDErrorHandling(fn, jobName = "unknown") {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      // Check if this is an EODHD limit error
      const limitManager = new EODHDLimitManager();
      if (limitManager.shouldThrowOnEODHDError(error)) {
        logger.business(`🚨 [${jobName}] EODHD limit reached - throwing to trigger pause`, {
          errorMessage: error.message?.substring(0, 100),
        });
        throw error; // Re-throw immediately to trigger CycledLinkedList pause
      }

      // For non-EODHD errors, re-throw as-is
      throw error;
    }
  };
}

/**
 * Wraps EODHD API client methods to automatically detect and throw limit errors
 * This is useful for wrapping individual API calls within job functions
 *
 * @param {Object} client - EODHD client instance
 * @param {string} methodName - Name of the API method
 * @param {string} jobName - Name of the job for logging purposes
 * @returns {Function} - Wrapped API method
 */
export function wrapEODHDMethod(client, methodName, jobName = "unknown") {
  const originalMethod = client[methodName];
  if (!originalMethod || typeof originalMethod !== "function") {
    throw new Error(`Method ${methodName} not found on client`);
  }

  return withEODHDErrorHandling(originalMethod.bind(client), `${jobName}.${methodName}`);
}

/**
 * Creates a safe EODHD API call wrapper that handles errors consistently
 *
 * @param {Function} apiCall - The API call function
 * @param {string} jobName - Name of the job for logging purposes
 * @returns {Promise} - Promise that throws EODHD errors appropriately
 */
export async function safeEODHDCall(apiCall, jobName = "unknown") {
  try {
    return await apiCall();
  } catch (error) {
    const limitManager = new EODHDLimitManager();
    if (limitManager.shouldThrowOnEODHDError(error)) {
      logger.business(
        `🚨 [${jobName}] EODHD limit reached in API call - throwing to trigger pause`,
        {
          errorMessage: error.message?.substring(0, 100),
        }
      );
      throw error;
    }
    throw error;
  }
}

/**
 * Higher-order function that wraps entire job functions with EODHD error handling
 * This is the recommended approach for new job functions
 *
 * @param {Function} jobFunction - The job function to wrap
 * @param {string} jobName - Name of the job for logging purposes
 * @returns {Function} - Wrapped job function
 */
export function createEODHDSafeJob(jobFunction, jobName) {
  return withEODHDErrorHandling(jobFunction, jobName);
}
