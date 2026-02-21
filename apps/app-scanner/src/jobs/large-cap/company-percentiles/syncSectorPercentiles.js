/**
 * Sync Sector Percentiles Job
 *
 * This job calculates percentile ranks for each company's metrics relative to
 * their sector peers. It replaces the old syncMetricsPerSector job which only
 * calculated averages. Percentiles are much more useful for screening decisions.
 *
 * Dependencies: syncMetricsLargeCap (for individual company metrics)
 * Schedule: Daily at 08:30 UTC (30 minutes after individual metrics)
 */

import { syncGroupPercentiles } from "./syncGroupPercentiles.js";

/**
 * Sync sector percentiles for all companies
 * @param {Object} ctx - Job context with progress and appendLog
 * @returns {Object} Job results summary
 */
export async function syncSectorPercentiles({ progress, appendLog } = {}) {
  return syncGroupPercentiles({
    groupBy: "sector",
    maxAgeDays: 7,
    batchConcurrency: 15,
    progress,
    appendLog,
  });
}

// Default export for run-job.js compatibility
export default syncSectorPercentiles;
