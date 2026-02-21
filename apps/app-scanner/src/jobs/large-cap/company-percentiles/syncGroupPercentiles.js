/**
 * Shared Percentile Sync Job
 *
 * This module provides a shared function for calculating percentile ranks
 * for companies relative to their sector or industry peers.
 *
 * Used by both syncSectorPercentiles and syncIndustryPercentiles jobs.
 */

import { getModel } from "@buydy/se-db";
import { getDefaultMetricsForAPI } from "@buydy/iso-business-types";
import {
  getAllGroups,
  getCompaniesInGroup,
  computePercentilesForGroup,
  updateCompanyPercentilesBulk,
  processGroupsInBatches,
} from "../metrics-base/percentileUtils.js";
import { parseDevModeCompany } from "../../../utils/devModeFilter.js";
import logger from "@buydy/se-logger";

const DEFAULT_MAX_AGE_DAYS = 7;
const DEFAULT_BATCH_CONCURRENCY = {
  sector: 15,
  industry: 20,
};

/**
 * Sync percentiles for a specific group type (sector or industry)
 * @param {Object} options - Configuration options
 * @param {string} options.groupBy - 'sector' or 'industry'
 * @param {number} options.maxAgeDays - Maximum age in days for data freshness (default: 7)
 * @param {number} options.batchConcurrency - Number of concurrent groups to process (default: based on groupBy)
 * @param {Function} options.progress - Progress callback function
 * @param {Function} options.appendLog - Logging function
 * @returns {Object} Job results summary
 */
export async function syncGroupPercentiles({
  groupBy,
  maxAgeDays = DEFAULT_MAX_AGE_DAYS, // eslint-disable-line no-unused-vars -- Kept for API compatibility, but not used (always recalculate)
  batchConcurrency = null,
  progress,
  appendLog,
} = {}) {
  if (!groupBy || !["sector", "industry"].includes(groupBy)) {
    throw new Error(`Invalid groupBy: ${groupBy}. Must be 'sector' or 'industry'`);
  }

  const log = (msg, level = "info") => {
    if (appendLog) {
      return appendLog(msg, level);
    }

    if (level === "error") {
      logger.business(`[${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}Percentiles] ${msg}`, {
        level: "error",
      });
    } else {
      logger.business(`[${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}Percentiles] ${msg}`);
    }
  };

  // Get Mongoose models
  const Fundamentals = getModel("fundamentals");
  const Metrics = getModel("metrics");

  const results = [];

  // Get metrics from enum - single source of truth
  const metricsList = getDefaultMetricsForAPI();

  // Set default concurrency based on group type
  const concurrency = batchConcurrency || DEFAULT_BATCH_CONCURRENCY[groupBy];

  // 🚀 DEV MODE: Parse dev mode settings
  const DEV_MODE_LIMIT = process.env.DEV_MODE_LIMIT
    ? parseInt(process.env.DEV_MODE_LIMIT, 10)
    : null;
  const rawDevModeCompanies = parseDevModeCompany();
  const DEV_MODE_COMPANIES = rawDevModeCompanies
    ? rawDevModeCompanies.map((symbol) => symbol.toUpperCase())
    : null;

  log(`🔄 Starting ${groupBy} percentile calculation for all companies`);

  try {
    // Get all unique groups
    let groups = await getAllGroups(Fundamentals, groupBy, log);

    if (groups.length === 0) {
      log(`⚠️  No ${groupBy}s found`);
      return { success: true, message: `No ${groupBy}s to process` };
    }

    // 🚀 DEV MODE: Filter groups if DEV_MODE_COMPANY is specified
    let groupsToProcess = groups;
    if (DEV_MODE_COMPANIES && DEV_MODE_COMPANIES.length > 0) {
      log(
        `🔧 DEV MODE: Filtering ${groupBy}s to include companies: ${
          rawDevModeCompanies ? rawDevModeCompanies.join(", ") : DEV_MODE_COMPANIES.join(", ")
        }`
      );

      const field =
        groupBy === "industry" ? "fundamentals.General.Industry" : "fundamentals.General.Sector";

      const fundamentalsDocs = await Fundamentals.find(
        { symbol: { $in: DEV_MODE_COMPANIES } },
        { symbol: 1, [field]: 1 }
      )
        .lean()
        .exec();

      const foundSymbols = new Set(
        fundamentalsDocs
          .map((doc) => doc.symbol)
          .filter((symbol) => typeof symbol === "string")
          .map((symbol) => symbol.toUpperCase())
      );

      const missingSymbols = DEV_MODE_COMPANIES.filter((symbol) => !foundSymbols.has(symbol));
      if (missingSymbols.length > 0) {
        log(
          `🔧 DEV MODE: WARNING - Fundamentals not found for symbols: ${missingSymbols.join(", ")}`
        );
      }

      const companyGroups = new Set(
        fundamentalsDocs
          .map(
            (doc) => doc?.fundamentals?.General?.[groupBy === "industry" ? "Industry" : "Sector"]
          )
          .filter((group) => typeof group === "string" && group.length > 0)
      );

      if (companyGroups.size > 0) {
        groupsToProcess = groups.filter((group) => companyGroups.has(group));
        log(
          `🔧 DEV MODE: Processing ${
            groupsToProcess.length
          } ${groupBy}s containing specified companies: ${Array.from(companyGroups).join(", ")}`
        );
      } else {
        log(
          `🔧 DEV MODE: WARNING - Could not resolve ${groupBy}s for specified companies, processing all ${groupBy}s`
        );
      }
    } else if (DEV_MODE_LIMIT && DEV_MODE_LIMIT < 50) {
      // Only apply DEV_MODE_LIMIT if it's a very small number (< 50) for quick testing
      groupsToProcess = groups.slice(0, DEV_MODE_LIMIT);
      log(`🔧 DEV MODE: Processing only ${DEV_MODE_LIMIT} ${groupBy}s for quick testing`);
    } else {
      // Process all groups for production runs
      log(`📊 Processing all ${groups.length} ${groupBy}s for complete percentile coverage`);
    }

    log(
      `📊 Processing ${groupsToProcess.length} ${groupBy}s with ${concurrency} concurrent batches`
    );

    // Report initial progress when starting work
    if (progress && groupsToProcess.length > 0) {
      await progress(0.01); // Report 1% immediately to show job is working
    }

    let totalCompaniesUpdated = 0;

    // Process groups in batches for better performance
    const processGroup = async (groupKey) => {
      try {
        // Get all companies in this group
        const companies = await getCompaniesInGroup(Fundamentals, Metrics, groupBy, groupKey, log);

        if (companies.length === 0) {
          log(`   ⚠️  No companies with metrics found in ${groupBy}: ${groupKey}`);
          return {
            [groupBy]: groupKey,
            ok: true,
            skipped: true,
            reason: "No companies with metrics",
          };
        }

        // ACCURACY: Always recalculate percentiles to ensure accuracy
        // Reasons:
        // 1. Bug fixes need to propagate to existing data
        // 2. Calculation improvements should apply immediately
        // 3. Percentile calculations are fast (pure math operations)
        // 4. No API calls - all data from our own DB
        // Removed freshness check - always recalculate for accuracy

        // Compute percentiles for this group
        const percentileResults = computePercentilesForGroup(groupKey, companies, metricsList, log);

        if (Object.keys(percentileResults).length === 0) {
          log(`   ⚠️  No percentiles computed for ${groupBy}: ${groupKey}`);
          return {
            [groupBy]: groupKey,
            ok: true,
            skipped: true,
            reason: "No percentiles computed",
          };
        }

        // Update companies using bulk write (more efficient)
        const bulkResult = await updateCompanyPercentilesBulk(
          Metrics,
          groupBy,
          percentileResults,
          log,
          500
        );

        totalCompaniesUpdated += bulkResult.updated;

        log(
          `   ✅ ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)} ${groupKey}: ${
            bulkResult.updated
          }/${companies.length} companies updated`
        );

        return {
          [groupBy]: groupKey,
          ok: true,
          companiesProcessed: companies.length,
          companiesUpdated: bulkResult.updated,
          skipped: false,
        };
      } catch (error) {
        log(`   ❌ Failed to process ${groupBy} ${groupKey}: ${error.message}`, "error");
        return {
          [groupBy]: groupKey,
          ok: false,
          error: error.message,
        };
      }
    };

    // Process groups in batches
    const batchResults = await processGroupsInBatches(
      groupsToProcess,
      processGroup,
      concurrency,
      log
    );

    results.push(...batchResults);

    // Simple progress: processed / total
    const processedGroups = results.filter((r) => r.ok && !r.skipped).length;
    const currentProgress = processedGroups / groupsToProcess.length;

    if (progress) {
      await progress(currentProgress);
    }

    // Print summary
    const successCount = results.filter((r) => r.ok && !r.skipped).length;
    const skippedCount = results.filter((r) => r.ok && r.skipped).length;
    const failedCount = results.filter((r) => !r.ok).length;

    log(`\n🎉 ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)} Percentiles Summary:`);
    log(`   Total ${groupBy}s: ${groupsToProcess.length}`);
    log(`   Successfully processed: ${successCount}`);
    log(`   Skipped (no companies or no updates): ${skippedCount}`);
    log(`   Failed: ${failedCount}`);
    log(`   Total companies updated: ${totalCompaniesUpdated}`);

    return {
      success: true,
      [`total${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}s`]: groupsToProcess.length,
      processed: successCount,
      skipped: skippedCount,
      failed: failedCount,
      totalCompaniesUpdated,
      runAt: new Date(),
    };
  } catch (error) {
    log(`❌ Job failed: ${error.message}`);
    throw error;
  }
}
