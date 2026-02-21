/**
 * Sync Industry Percentiles Job
 *
 * This job calculates percentile ranks for each company's metrics relative to
 * their industry peers. It replaces the old syncMetricsPerIndustry job which only
 * calculated averages. Percentiles are much more useful for screening decisions.
 *
 * Dependencies: syncSectorPercentiles (for sector percentiles first)
 * Schedule: Daily at 09:00 UTC (30 minutes after sector percentiles)
 */

import { syncGroupPercentiles } from "./syncGroupPercentiles.js";

/**
 * Sync industry percentiles for all companies
 * @param {Object} ctx - Job context with progress and appendLog
 * @returns {Object} Job results summary
 */
export async function syncIndustryPercentiles({ progress, appendLog } = {}) {
  return syncGroupPercentiles({
    groupBy: "industry",
    maxAgeDays: 7,
    batchConcurrency: 20,
    progress,
    appendLog,
  });
}

// Default export for run-job.js compatibility
export default syncIndustryPercentiles;
