/**
 * Example: How to use EODHD Error Handling in Job Functions
 *
 * This file demonstrates the different ways to use the EODHD error handling utilities
 * to ensure consistent error handling across all job functions.
 */

import {
  withEODHDErrorHandling,
  safeEODHDCall,
  wrapEODHDMethod,
  createEODHDSafeJob,
} from "../utils/eodhdErrorHandler.js";
import { EODHDCacheClient } from "@buydy/se-eodhd-cache";
import logger from "@buydy/se-logger";

// ============================================================================
// METHOD 1: Wrap entire job function (RECOMMENDED for new jobs)
// ============================================================================

async function _myJobFunction({ appendLog } = {}) {
  // eslint-disable-next-line no-unused-vars
  const log = appendLog || ((msg) => logger.debug(msg));

  // Your job logic here
  const client = new EODHDCacheClient({
    apiKey: process.env.API_EODHD_API_TOKEN,
  });

  // Make EODHD API calls - errors will be automatically handled
  const data = await client.stocks.getEODData("AAPL.US", "2024-01-01", "2024-01-31");

  return { success: true, data };
}

// Export with automatic EODHD error handling
export const myJobFunction = withEODHDErrorHandling(_myJobFunction, "myJobFunction");

// ============================================================================
// METHOD 2: Wrap individual API calls (for existing jobs)
// ============================================================================

export async function existingJobWithIndividualWrapping({ appendLog } = {}) {
  const log = appendLog || ((msg) => logger.debug(msg));

  const client = new EODHDCacheClient({
    apiKey: process.env.API_EODHD_API_TOKEN,
  });

  try {
    // Wrap individual API calls
    const exchanges = await safeEODHDCall(
      () => client.search.getAvailableExchanges(),
      "existingJob.getAvailableExchanges"
    );

    const symbols = await safeEODHDCall(
      () => client.search.getSymbolsByExchange("NASDAQ"),
      "existingJob.getSymbolsByExchange"
    );

    return { exchanges, symbols };
  } catch (error) {
    // Non-EODHD errors are re-thrown as-is
    log(`Job failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// METHOD 3: Wrap specific client methods (for reusable client wrappers)
// ============================================================================

export function createSafeEODHDClient(apiKey) {
  const client = new EODHDCacheClient({ apiKey });

  // Wrap specific methods
  const safeClient = {
    ...client,
    getAvailableExchanges: wrapEODHDMethod(client, "getAvailableExchanges", "safeClient"),
    getSymbolsByExchange: wrapEODHDMethod(client, "getSymbolsByExchange", "safeClient"),
    getEODData: wrapEODHDMethod(client, "getEODData", "safeClient"),
  };

  return safeClient;
}

// ============================================================================
// METHOD 4: Use the higher-order function (alternative to METHOD 1)
// ============================================================================

const anotherJobFunction = createEODHDSafeJob(async ({ appendLog } = {}) => {
  // eslint-disable-next-line no-unused-vars
  const log = appendLog || ((msg) => logger.debug(msg));

  // Your job logic here
  const client = new EODHDCacheClient({
    apiKey: process.env.API_EODHD_API_TOKEN,
  });

  const data = await client.stocks.getEODData("AAPL.US", "2024-01-01", "2024-01-31");

  return { success: true, data };
}, "anotherJobFunction");

export { anotherJobFunction };

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// In your CycledListInitializer.js or wherever you define jobs:

import { myJobFunction, existingJobWithIndividualWrapping, anotherJobFunction } from "./jobs/examples/eodhdErrorHandlingExamples.js";

// All of these will automatically handle EODHD errors:
const workflow = [
  { name: "My Job", functionName: "myJobFunction" },
  { name: "Existing Job", functionName: "existingJobWithIndividualWrapping" },
  { name: "Another Job", functionName: "anotherJobFunction" },
];
*/

// ============================================================================
// BENEFITS OF THIS APPROACH
// ============================================================================

/*
✅ CONSISTENT ERROR HANDLING: All jobs automatically handle EODHD errors the same way
✅ NO CODE DUPLICATION: No need to manually check for EODHD errors in each job
✅ EASY TO USE: Just wrap your function or API calls
✅ BACKWARDS COMPATIBLE: Can be applied to existing jobs without major changes
✅ CENTRALIZED LOGIC: All EODHD error detection logic is in one place
✅ AUTOMATIC PAUSE: CycledLinkedList will automatically pause when EODHD limit is reached
✅ DETAILED LOGGING: Consistent logging format across all jobs
*/
