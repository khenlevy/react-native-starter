/**
 * Cycled List Initialization
 * Sets up the cycled list system with job functions and workflow
 */

import { getCycledList } from "@buydy/se-list";
import logger from "@buydy/se-logger";
import { EODHDLimitManager } from "./EODHDLimitManager.js";

// Job function imports
import { syncFundamentalsLargeCap } from "../jobs/large-cap/fundamentals/syncFundamentalsLargeCap.js";
import { syncDividendsLargeCap } from "../jobs/large-cap/dividends/syncDividendsLargeCap.js";
import { syncTechnicalsLargeCap } from "../jobs/large-cap/technicals/syncTechnicalsLargeCap.js";
import { syncMetricsLargeCap } from "../jobs/large-cap/metrics/syncMetricsLargeCap.js";
import { syncSectorPercentiles } from "../jobs/large-cap/company-percentiles/syncSectorPercentiles.js";
import { syncIndustryPercentiles } from "../jobs/large-cap/company-percentiles/syncIndustryPercentiles.js";
import { syncAllExchangesAndSymbols } from "../jobs/all/exchanges/syncExchangesAndSymbols.js";
import { findAndMarkLargeCapStocks } from "../jobs/large-cap/findAndMarkLargeCapStocks.js";
import { syncPricePerformanceLargeCap } from "../jobs/large-cap/performance/syncPricePerformanceLargeCap.js";
import { syncMetricsValuationLargeCap } from "../jobs/large-cap/valuation/syncMetricsValuationLargeCap.js";

export class CycledListInitializer {
  // Throttle cycle list progress updates (max once per 2 seconds)
  static get CYCLE_LIST_UPDATE_THROTTLE() {
    return 2000;
  }

  constructor(limitManager) {
    this.cycledList = null;
    this.limitManager = limitManager;
    this.isShuttingDown = false;
  }

  /**
   * Job function mapping
   */
  getJobFunctionMap() {
    return {
      syncAllExchangesAndSymbols,
      syncFundamentalsLargeCap,
      findAndMarkLargeCapStocks,
      syncDividendsLargeCap,
      syncTechnicalsLargeCap,
      syncMetricsLargeCap,
      syncMetricsValuationLargeCap,
      syncPricePerformanceLargeCap,
      syncSectorPercentiles,
      syncIndustryPercentiles,
    };
  }

  /**
   * Creates the executeAsyncFn handler for the cycled list
   * This function sets up job execution with proper tracking, progress reporting, and error handling
   */
  createExecuteAsyncFnHandler() {
    const jobFunctionMap = this.getJobFunctionMap();
    // Store workflow for fallback check (in case node.skipped wasn't preserved)
    const workflow = this.createWorkflow();
    const workflowMap = new Map(workflow.map((job) => [job.functionName, job]));

    return async (node) => {
      // Check if job is marked as skipped in workflow
      // First check node property, then fallback to workflow definition
      const isSkipped =
        node.skipped === true || workflowMap.get(node.functionName)?.skipped === true;
      if (isSkipped) {
        logger.business(`⏭️ Skipping job (marked as skipped in workflow): ${node.name}`);
        try {
          const { getModel } = await import("@buydy/se-db");
          const Jobs = getModel("jobs");

          // Check for existing job record
          const existingJob = await Jobs.findOne({
            name: node.functionName,
            "metadata.cycledListName": this.cycledList.name,
            "metadata.cycleNumber": this.cycledList.currentCycle,
            "metadata.nodeId": node.id,
          }).sort({ startedAt: -1 });

          if (existingJob && existingJob.status !== "skipped") {
            // Mark existing job as skipped
            await Jobs.findByIdAndUpdate(
              existingJob._id,
              {
                status: "skipped",
                endedAt: new Date(),
                result: { reason: "Skipped in workflow configuration" },
              },
              { new: true }
            );
            logger.business(`✅ Marked job as skipped: ${node.name}`);
          } else if (!existingJob) {
            // Create new job record with skipped status
            const skippedJob = new Jobs({
              name: node.functionName,
              displayName: node.name,
              machineName: "scanner-droplet",
              status: "skipped",
              scheduledAt: new Date(),
              startedAt: new Date(),
              endedAt: new Date(),
              progress: 0,
              result: { reason: "Skipped in workflow configuration" },
              error: null,
              logs: [],
              metadata: {
                cycledListName: this.cycledList.name,
                cycleNumber: this.cycledList.currentCycle,
                nodeId: node.id,
                parallelGroup: node.parallelGroup,
              },
            });
            await skippedJob.save();
            logger.business(`✅ Created skipped job record: ${node.name}`);
          }
        } catch (error) {
          logger.business(`⚠️ Failed to mark job as skipped: ${node.name}`, {
            error: error.message,
          });
        }
        return null; // Return null to indicate job was skipped (same as completed for cycle purposes)
      }

      const jobFunction = jobFunctionMap[node.functionName];
      if (!jobFunction) {
        throw new Error(`Job function not found: ${node.functionName}`);
      }

      logger.business(`🔄 Executing job: ${node.name}`);
      const startTime = Date.now();

      // Throttle cycle list progress updates (max once per 2 seconds)
      let lastCycleListUpdate = 0;

      // Check for existing job record (for resume scenarios)
      let jobRecord = null;
      try {
        const { getModel } = await import("@buydy/se-db");
        const Jobs = getModel("jobs");

        // Look for existing job record from current cycle
        const existingJob = await Jobs.findOne({
          name: node.functionName,
          "metadata.cycledListName": this.cycledList.name,
          "metadata.cycleNumber": this.cycledList.currentCycle,
          "metadata.nodeId": node.id,
        }).sort({ startedAt: -1 });

        if (existingJob) {
          // If job should be skipped but is running, mark it as skipped and return
          if (
            (node.skipped === true || workflowMap.get(node.functionName)?.skipped === true) &&
            existingJob.status === "running"
          ) {
            logger.business(
              `⏭️ Found running job that should be skipped: ${node.name}, marking as skipped`
            );
            await Jobs.findByIdAndUpdate(
              existingJob._id,
              {
                status: "skipped",
                endedAt: new Date(),
                result: { reason: "Skipped in workflow configuration (was running)" },
              },
              { new: true }
            );
            return null; // Return null to indicate job was skipped
          }

          // Check if "running" job is stale (container was restarted)
          if (existingJob.status === "running") {
            // If job was started more than 5 minutes ago, it's stale (container restart)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (existingJob.startedAt < fiveMinutesAgo) {
              logger.business(
                `⚠️ Found stale running job: ${node.name} (started ${Math.round(
                  (Date.now() - existingJob.startedAt) / 1000 / 60
                )}m ago), marking as failed and retrying`
              );
              await existingJob.markAsFailedAtomic(
                "Job was marked as running but container restarted - likely incomplete"
              );
              // Fall through to create new job record
            } else {
              // Job is still fresh, use it (shouldn't happen if container just started, but handle it)
              jobRecord = existingJob;
              logger.business(`📝 Using existing running job: ${node.name}`);
            }
          }

          // If we didn't use the existing job above, check if we should retry it
          if (!jobRecord) {
            if (existingJob.status === "cancelled" || existingJob.status === "paused") {
              // Preserve progress when resuming - markAsRetryingAtomic doesn't reset progress
              const preservedProgress = existingJob.progress || 0;
              const updatedJob = await existingJob.markAsRetryingAtomic();
              jobRecord = updatedJob || existingJob; // Use updated job if returned, otherwise use original
              // Refresh jobRecord to get latest state (including preserved progress)
              if (jobRecord._id) {
                try {
                  const refreshed = await Jobs.findById(jobRecord._id);
                  if (refreshed) jobRecord = refreshed;
                } catch (err) {
                  // If refresh fails, continue with existing jobRecord
                  logger.debug(`[${node.name}] Failed to refresh job record, using existing`);
                }
              }
              logger.business(
                `🔄 Resuming cancelled/paused job: ${node.name} (progress: ${(
                  preservedProgress * 100
                ).toFixed(1)}%)`
              );
            } else if (existingJob.status === "failed") {
              // Resume from failed job - mark as retrying and continue
              // Preserve progress if it exists (though failed jobs usually have 0)
              const preservedProgress = existingJob.progress || 0;
              const updatedJob = await existingJob.markAsRetryingAtomic();
              jobRecord = updatedJob || existingJob;
              // Refresh jobRecord to get latest state
              if (jobRecord._id) {
                try {
                  const refreshed = await Jobs.findById(jobRecord._id);
                  if (refreshed) jobRecord = refreshed;
                } catch (err) {
                  logger.debug(`[${node.name}] Failed to refresh job record, using existing`);
                }
              }
              logger.business(
                `🔄 Retrying failed job: ${node.name} (progress: ${(
                  preservedProgress * 100
                ).toFixed(1)}%)`
              );
            } else if (existingJob.status === "completed") {
              // Job completed, skip it (cycle will move to next job)
              logger.business(`✅ Job already completed in this cycle: ${node.name}, skipping`);
              return null; // Skip this job, cycle continues
            }
          }

          // If still no job record, create new one
          if (!jobRecord) {
            jobRecord = new Jobs({
              name: node.functionName,
              displayName: node.name,
              machineName: "scanner-droplet",
              status: "running",
              scheduledAt: new Date(),
              startedAt: new Date(),
              endedAt: null,
              progress: 0,
              result: null,
              error: null,
              logs: [],
              metadata: {
                cycledListName: this.cycledList.name,
                cycleNumber: this.cycledList.currentCycle,
                nodeId: node.id,
                parallelGroup: node.parallelGroup,
              },
            });
            await jobRecord.save();
            logger.business(`📝 Created new job record: ${node.name}`);
          }
        } else {
          // New job: create fresh record
          jobRecord = new Jobs({
            name: node.functionName,
            displayName: node.name,
            machineName: "scanner-droplet",
            status: "running",
            scheduledAt: new Date(),
            startedAt: new Date(),
            endedAt: null,
            progress: 0,
            result: null,
            error: null,
            logs: [],
            metadata: {
              cycledListName: this.cycledList.name,
              cycleNumber: this.cycledList.currentCycle,
              nodeId: node.id,
              parallelGroup: node.parallelGroup,
            },
          });
          await jobRecord.save();
          logger.business(`📝 Created job record: ${node.name}`);
        }
      } catch (error) {
        logger.business(`⚠️ Failed to create/update job record: ${node.name}`, {
          error: error.message,
        });
      }

      // Set up progress and appendLog callbacks for the job
      const appendLog = async (msg, level = "info") => {
        logger.debug(`[${node.name}] ${msg}`);
        // Only store important logs (errors, warnings, start/end, summaries)
        if (
          level === "error" ||
          level === "warn" ||
          msg.includes("started") ||
          msg.includes("completed") ||
          msg.includes("Summary") ||
          msg.includes("Final")
        ) {
          if (jobRecord) {
            try {
              await jobRecord.addLogAtomic(msg, level);
            } catch (error) {
              logger.debug(`[${node.name}] Failed to add log`, { error: error.message });
            }
          }
        }
      };

      // Store job record ID for progress callback to use
      const jobRecordId = jobRecord?._id || null;

      const progress = async (p) => {
        if (typeof p !== "number" || p < 0 || p > 1) {
          logger.debug(`[${node.name}] Invalid progress value: ${p}`);
          return;
        }

        // Find the job record to update - try multiple strategies
        let jobIdToUpdate = jobRecordId;

        // If we don't have a job ID, try to find the current running job
        if (!jobIdToUpdate) {
          try {
            const { getModel } = await import("@buydy/se-db");
            const Jobs = getModel("jobs");
            // Find the current running job for this cycle
            const currentJob = await Jobs.findOne({
              name: node.functionName,
              "metadata.cycledListName": this.cycledList.name,
              "metadata.cycleNumber": this.cycledList.currentCycle,
              status: { $in: ["running", "retrying"] },
            }).sort({ startedAt: -1 });

            if (currentJob) {
              jobIdToUpdate = currentJob._id;
            } else {
              logger.debug(`[${node.name}] No active job record found for progress update`);
              return;
            }
          } catch (error) {
            logger.debug(`[${node.name}] Failed to find job record for progress`, {
              error: error.message,
            });
            return;
          }
        }

        try {
          // Use atomic update to avoid stale document errors
          const { getModel } = await import("@buydy/se-db");
          const Jobs = getModel("jobs");
          const result = await Jobs.findByIdAndUpdate(
            jobIdToUpdate,
            { progress: p },
            { new: true }
          );

          if (result) {
            logger.debug(
              `[${node.name}] ✅ Progress updated: ${(p * 100).toFixed(
                1
              )}% (jobId: ${jobIdToUpdate})`
            );
          } else {
            logger.debug(
              `[${node.name}] ⚠️ Progress update returned null (jobId: ${jobIdToUpdate})`
            );
          }

          // Throttled update of cycle list progress
          const now = Date.now();
          if (now - lastCycleListUpdate >= CycledListInitializer.CYCLE_LIST_UPDATE_THROTTLE) {
            lastCycleListUpdate = now;
            // Update cycle list progress in background (don't await to avoid blocking)
            this.updateCycledListProgress().catch((error) => {
              logger.debug(`[${node.name}] Failed to update cycle list progress`, {
                error: error.message,
              });
            });
          }
        } catch (error) {
          logger.debug(`[${node.name}] ❌ Failed to update progress`, {
            error: error.message,
            jobId: jobIdToUpdate,
          });
        }
      };

      try {
        // If jobRecord is null, skip this job (already completed)
        if (!jobRecord) {
          logger.business(`⏭️ Skipping already completed job: ${node.name}`);
          return null;
        }

        // Mark job as running if it's in retrying state (resumed from cancelled/paused/failed)
        // This ensures status is correctly updated and progress is preserved
        if (jobRecord.status === "retrying") {
          try {
            const preservedProgress = jobRecord.progress || 0;
            await jobRecord.markAsRunning();
            // Refresh jobRecord to get latest state from database (ensures correct status and progress)
            if (jobRecord._id) {
              try {
                const { getModel } = await import("@buydy/se-db");
                const Jobs = getModel("jobs");
                const refreshed = await Jobs.findById(jobRecord._id);
                if (refreshed) {
                  jobRecord = refreshed;
                  // jobRecordId already points to the correct _id (same record, just refreshed state)
                  logger.business(
                    `🔄 Marked resumed job as running: ${node.name} (status: ${
                      jobRecord.status
                    }, progress preserved: ${(jobRecord.progress * 100).toFixed(1)}%)`
                  );
                }
              } catch (refreshError) {
                logger.debug(
                  `[${node.name}] Failed to refresh job record after marking as running`,
                  { error: refreshError.message }
                );
                logger.business(
                  `🔄 Marked resumed job as running: ${node.name} (progress preserved: ${(
                    preservedProgress * 100
                  ).toFixed(1)}%)`
                );
              }
            }
          } catch (error) {
            logger.debug(`[${node.name}] Failed to mark resumed job as running`, {
              error: error.message,
            });
            // Continue anyway - job will still execute
          }
        }

        const result = await jobFunction({ progress, appendLog });
        const duration = Date.now() - startTime;

        // Mark job as completed
        await jobRecord.markAsCompletedAtomic(result);
        logger.business(`📝 Job record completed: ${node.name}`);

        // Update CycledLinkedList progress after job completion
        await this.updateCycledListProgress();

        logger.business(`✅ Job completed: ${node.name} (${duration}ms)`);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Check if this is an EODHD limit error - if so, throw immediately without saving
        // This will trigger pause (not stop) via pause conditions
        const limitManager = new EODHDLimitManager();
        if (limitManager.shouldThrowOnEODHDError(error)) {
          logger.business(
            `🚨 EODHD limit error detected in job ${node.name} - throwing immediately`
          );
          throw error; // Re-throw immediately to trigger pause
        }

        // For other errors, mark job as failed
        if (jobRecord) {
          await jobRecord.markAsFailed(error);
          logger.business(`📝 Job record failed: ${node.name}`);
        }

        // Update CycledLinkedList progress after job failure
        await this.updateCycledListProgress();

        logger.business(`❌ Job failed: ${node.name} (${duration}ms)`, { error: error.message });
        throw error; // This will be caught by CycledLinkedList and may trigger stop() with stopReason
      }
    };
  }

  /**
   * Create the cycled list workflow
   */
  createWorkflow() {
    return [
      // Exchange and symbols sync (foundation)
      {
        name: "syncExchangesAndSymbols",
        functionName: "syncAllExchangesAndSymbols",
      },

      // Large cap fundamentals and identification
      {
        name: "syncFundamentalsLargeCap",
        functionName: "syncFundamentalsLargeCap",
      },
      {
        name: "findAndMarkLargeCapStocks",
        functionName: "findAndMarkLargeCapStocks",
      },

      // Dividends and technicals
      {
        name: "syncDividendsLargeCap",
        //parallelGroup: "large-cap-data",
        functionName: "syncDividendsLargeCap",
      },
      {
        name: "syncTechnicalsLargeCap",
        //parallelGroup: "large-cap-data",
        functionName: "syncTechnicalsLargeCap",
        skipped: true, // Skipped: not used in metric calculations
      },

      // Metrics and percentiles (parallel execution)
      {
        name: "syncMetricsLargeCap",
        functionName: "syncMetricsLargeCap",
      },
      {
        name: "syncMetricsValuationLargeCap",
        functionName: "syncMetricsValuationLargeCap",
      },
      {
        name: "syncPricePerformanceLargeCap",
        functionName: "syncPricePerformanceLargeCap",
      },
      {
        name: "syncSectorPercentiles",
        parallelGroup: "percentiles",
        functionName: "syncSectorPercentiles",
      },
      {
        name: "syncIndustryPercentiles",
        parallelGroup: "percentiles",
        functionName: "syncIndustryPercentiles",
      },
    ];
  }

  /**
   * Initialize the cycled list system
   */
  async initialize() {
    logger.business("🔄 Initializing cycled list system...");

    this.cycledList = getCycledList();

    // Set up pause condition for EODHD limits
    await this.cycledList.pauseOnTruthy(async (error) => {
      const shouldPause = await this.limitManager.checkEODHDLimit(error);
      if (shouldPause) {
        logger.business("🚨 EODHD daily limit reached - pausing cycle list");
        // Handle job cancellation when pausing
        await this.handleJobCancellation();
        // Expose next scheduled resume time to UI/status
        this.cycledList.nextCycleScheduled = this.limitManager.dailyResetTime;
        // Store pause reason for UI
        this.cycledList.pauseReason = "EODHD daily API limit reached. Will resume at midnight UTC.";
        // Force immediate pause and persistence
        await this.cycledList.pause();
        await this.cycledList.notifyStatusChange();
        logger.business(
          `⏸️ Cycle list paused. Will resume at: ${this.limitManager.dailyResetTime?.toISOString()}`
        );
      }
      return shouldPause;
    });

    // Set up continue condition for daily reset
    await this.cycledList.continueOnTruthy(async () => {
      const canContinue = await this.limitManager.checkDailyReset();
      if (canContinue && !this.limitManager.isLimitReached) {
        // Clear the scheduled time and pause reason once we resume
        this.cycledList.nextCycleScheduled = null;
        this.cycledList.pauseReason = null;
        await this.cycledList.notifyStatusChange();
      }
      return canContinue;
    });

    // Create the workflow
    const workflow = this.createWorkflow();

    // Override executeAsyncFn to use our job functions and create job records
    this.cycledList.executeAsyncFn = this.createExecuteAsyncFnHandler();

    // Setup status persistence callback
    await this.setupStatusPersistence();

    // Try to restore previous state from database
    const restored = await this.restorePreviousState();

    if (!restored) {
      // No previous state found, create new cycled list
      await this.cycledList.create("Stocks Scanner Daily Sync", workflow, {
        // cycleInterval removed - cycles run continuously now
        maxCycles: null, // Run forever
        cancelFunction: async () => {
          await this.limitManager.cancelExternalOperations();
        },
      });
    } else {
      logger.business("✅ Restored previous cycled list state from database");
      // Set up executeAsyncFn override (needed after restore)
      this.cycledList.executeAsyncFn = this.createExecuteAsyncFnHandler();

      // Update progress immediately on restore to reflect current job states
      await this.updateCycledListProgress();
      logger.business("📊 Updated cycle progress after restore");

      // Check if the previous cycle actually completed (all jobs finished)
      const { getModel } = await import("@buydy/se-db");
      const Jobs = getModel("jobs");
      const workflow = this.createWorkflow();

      // Get jobs from the restored cycle
      const cycleJobs = await Jobs.find({
        "metadata.cycledListName": this.cycledList.name,
        "metadata.cycleNumber": this.cycledList.currentCycle,
      }).lean();

      // Check if all jobs in the cycle are completed or failed
      const allJobsFinished = workflow.every((wfJob) => {
        const job = cycleJobs.find((j) => j.name === wfJob.functionName);
        return job && (job.status === "completed" || job.status === "failed");
      });

      // Only start a new cycle if:
      // 1. Not paused
      // 2. Previous cycle actually completed (all jobs finished)
      if (!this.cycledList.isPaused) {
        if (allJobsFinished) {
          // All jobs finished - start next cycle immediately
          logger.business(
            `✅ Previous cycle ${this.cycledList.currentCycle} completed - starting next cycle immediately`
          );
          await this.cycledList.startNextCycleImmediately();
        } else {
          logger.business(
            `🔄 Previous cycle ${this.cycledList.currentCycle} not finished - determining resume point from workflow order`
          );

          // Calculate the correct resume index based on workflow order and job statuses
          const resumeIndex = await this.calculateResumeIndexFromWorkflow(workflow, cycleJobs);

          if (resumeIndex >= 0) {
            logger.business(
              `📍 Resuming from job index ${resumeIndex} (workflow order) - ${
                workflow[resumeIndex]?.name || "unknown"
              }`
            );
            this.cycledList.currentAsyncFnIndex = resumeIndex;
          } else {
            logger.business(`⚠️ Could not determine resume point - starting from beginning`);
            this.cycledList.currentAsyncFnIndex = -1; // Start from beginning
          }

          // Resume the cycle (don't start a new one)
          this.cycledList.isRunning = true;
          await this.cycledList.notifyStatusChange();
          // Continue execution from where it left off - skip completed jobs
          await this.cycledList.executeList();
        }
      } else {
        logger.business("⏸️ Restored state shows paused - will wait for continue condition");
      }
    }

    logger.business("✅ Cycled list system initialized");
    return this.cycledList;
  }

  /**
   * Handle job cancellation when CycledLinkedList pauses
   */
  async handleJobCancellation() {
    try {
      const { getModel } = await import("@buydy/se-db");
      const Jobs = getModel("jobs");

      // Find all running jobs for current cycle
      const runningJobs = await Jobs.find({
        status: "running",
        "metadata.cycledListName": this.cycledList.name,
        "metadata.cycleNumber": this.cycledList.currentCycle,
      });

      // Mark them as cancelled
      for (const job of runningJobs) {
        await job.markAsCancelledAtomic("CycledLinkedList paused - will retry on resume");
        logger.business(`🛑 Cancelled job: ${job.displayName}`);
      }

      logger.business(`🛑 Cancelled ${runningJobs.length} running jobs due to pause`);
    } catch (error) {
      logger.business(`⚠️ Failed to cancel jobs: ${error.message}`);
    }
  }

  /**
   * Update CycledLinkedList progress based on current job statuses
   * Takes into account individual job progress for running jobs
   * Uses workflow definition as source of truth for total jobs
   */
  async updateCycledListProgress() {
    try {
      const { getModel } = await import("@buydy/se-db");
      const Jobs = getModel("jobs");

      // Use workflow definition as source of truth for total jobs per cycle
      const workflow = this.createWorkflow();
      const expectedTotalJobs = workflow.length; // This is the actual number of jobs per cycle

      // Get all jobs for current cycle - use lean() for better performance and freshness
      const cycleJobs = await Jobs.find({
        "metadata.cycledListName": this.cycledList.name,
        "metadata.cycleNumber": this.cycledList.currentCycle,
      }).lean();

      // Create a map of functionName -> job for easier lookup
      const jobMap = new Map();
      cycleJobs.forEach((job) => {
        jobMap.set(job.name, job);
      });

      // Calculate progress based on workflow and actual job statuses
      let completedJobs = 0;
      let failedJobs = 0;
      let runningJobs = 0;
      let totalProgress = 0;

      // Go through each job in the workflow and check its status
      for (const workflowJob of workflow) {
        const job = jobMap.get(workflowJob.functionName);

        if (!job) {
          // Job hasn't been created yet - counts as 0% progress
          continue;
        }

        if (job.status === "completed" || job.status === "skipped") {
          completedJobs++;
          totalProgress += 100; // Skipped jobs count as completed for progress
        } else if (job.status === "failed") {
          failedJobs++;
          // Failed jobs don't contribute to progress
        } else if (job.status === "running" || job.status === "retrying") {
          runningJobs++;
          // Running jobs count based on their individual progress (0-100%)
          totalProgress += (job.progress || 0) * 100;
        }
        // Other statuses (cancelled, paused, etc.) don't contribute to progress
      }

      // Update CycledLinkedList progress
      this.cycledList.completedAsyncFns = completedJobs;
      this.cycledList.failedAsyncFns = failedJobs;
      this.cycledList.totalAsyncFns = expectedTotalJobs; // Use workflow length as source of truth

      // Calculate average progress percentage based on expected total
      if (expectedTotalJobs > 0) {
        const progress = totalProgress / expectedTotalJobs;
        this.cycledList.progress = Math.min(100, Math.max(0, progress));

        logger.debug(
          `📊 Cycle progress update: ${completedJobs}/${expectedTotalJobs} completed, ${runningJobs} running, progress: ${this.cycledList.progress.toFixed(
            1
          )}%`
        );
      } else {
        this.cycledList.progress = 0;
      }

      // Update current async function based on running jobs
      const currentRunningJob = cycleJobs.find((job) => job.status === "running");
      if (currentRunningJob) {
        this.cycledList.currentAsyncFn = {
          name: currentRunningJob.displayName,
          functionName: currentRunningJob.name,
        };
        this.cycledList.currentAsyncFnIndex =
          parseInt(currentRunningJob.metadata.nodeId.replace("asyncFn_", "")) || 0;
      } else {
        // Clear current async function if no running jobs
        this.cycledList.currentAsyncFn = null;
        this.cycledList.currentAsyncFnIndex = -1;
      }

      // Trigger status change callback to persist updated progress to database
      await this.cycledList.notifyStatusChange();

      logger.business(
        `📊 Updated cycle progress: ${completedJobs}/${expectedTotalJobs} completed (${this.cycledList.progress.toFixed(
          1
        )}%)`
      );
    } catch (error) {
      logger.business(`⚠️ Failed to update progress: ${error.message}`);
    }
  }

  /**
   * Calculate the correct resume index based on workflow order and job statuses
   * Finds the first job in workflow order that is NOT completed
   * @param {Array} workflow - The workflow definition
   * @param {Array} cycleJobs - Jobs from the current cycle
   * @returns {number} The index in the workflow to resume from, or -1 if all jobs are done
   */
  async calculateResumeIndexFromWorkflow(workflow, cycleJobs) {
    // Create a map of functionName -> job status for quick lookup
    const jobStatusMap = new Map();
    cycleJobs.forEach((job) => {
      jobStatusMap.set(job.name, job.status);
    });

    // Go through workflow in order and find the first job that is NOT completed
    for (let i = 0; i < workflow.length; i++) {
      const workflowJob = workflow[i];
      const jobStatus = jobStatusMap.get(workflowJob.functionName);

      // If job doesn't exist or is not completed/failed, this is where we should resume
      if (!jobStatus) {
        logger.business(
          `   📍 Resume point: Job ${workflowJob.name} (index ${i}) - not started yet`
        );
        return i;
      }

      // If job is completed or failed, continue to next job
      if (jobStatus === "completed" || jobStatus === "failed") {
        continue;
      }

      // If job is running, retrying, cancelled, or paused, resume from here
      if (["running", "retrying", "cancelled", "paused"].includes(jobStatus)) {
        logger.business(
          `   📍 Resume point: Job ${workflowJob.name} (index ${i}) - status: ${jobStatus}`
        );
        return i;
      }

      // If job is skipped, continue to next job (skipped jobs are considered done)
      if (jobStatus === "skipped") {
        continue;
      }

      // Unknown status - resume from here to be safe
      logger.business(
        `   📍 Resume point: Job ${workflowJob.name} (index ${i}) - unknown status: ${jobStatus}`
      );
      return i;
    }

    // All jobs are completed/failed - should start new cycle
    logger.business(`   ✅ All jobs in workflow are completed or failed`);
    return -1;
  }

  /**
   * Restore previous state from database
   */
  async restorePreviousState() {
    try {
      const { getModel } = await import("@buydy/se-db");
      const CycledListStatus = getModel("cycled_list_status");

      const previousStatus = await CycledListStatus.findOne({
        name: "Stocks Scanner Daily Sync",
      });

      if (!previousStatus) {
        return false;
      }

      // Get workflow configuration
      const workflow = this.createWorkflow();

      // Restore state by creating the cycled list with workflow
      // but don't start it automatically - let it resume from paused state
      this.cycledList.name = previousStatus.name;
      this.cycledList.asyncFns = workflow;
      // cycleInterval is deprecated - cycles run continuously now
      this.cycledList.cycleInterval = null;
      this.cycledList.maxCycles = previousStatus.maxCycles;
      this.cycledList.currentCycle = previousStatus.currentCycle;
      this.cycledList.totalCycles = previousStatus.totalCycles;
      this.cycledList.cancelFunction = async () => {
        await this.limitManager.cancelExternalOperations();
      };

      // Rebuild the linked list nodes
      workflow.forEach((asyncFn, index) => {
        this.cycledList.linkedList.addNode(`asyncFn_${index}`, {
          name: asyncFn.name,
          parallelGroup: asyncFn.parallelGroup,
          functionName: asyncFn.functionName || asyncFn.name,
          skipped: asyncFn.skipped || false, // Preserve skipped flag from workflow
        });
      });

      // Restore pause state
      this.cycledList.isPaused = previousStatus.isPaused;
      this.cycledList.manualPause = previousStatus.manualPause || false;
      this.cycledList.isRunning = false; // Always start stopped

      logger.business(
        `🔄 Restored state: Cycle ${this.cycledList.currentCycle}, Total cycles: ${this.cycledList.totalCycles}, Paused: ${this.cycledList.isPaused}`
      );

      return true;
    } catch (error) {
      logger.debug("Could not restore previous state:", error.message);
      return false;
    }
  }

  /**
   * Setup database persistence for cycled list status
   */
  async setupStatusPersistence() {
    try {
      const { getModel } = await import("@buydy/se-db");
      const CycledListStatus = getModel("cycled_list_status");

      this.cycledList.setStatusChangeCallback(async (status) => {
        try {
          // Convert conditions to their string representations
          const persistableData = {
            ...status,
            pauseConditions: Array.isArray(status.pauseConditions)
              ? status.pauseConditions.map((c) => (typeof c === "string" ? c : "condition"))
              : [],
            continueConditions: Array.isArray(status.continueConditions)
              ? status.continueConditions.map((c) => (typeof c === "string" ? c : "condition"))
              : [],
            lastUpdated: new Date(),
          };

          await CycledListStatus.findOneAndUpdate(
            { name: this.cycledList.name },
            { $set: persistableData },
            { upsert: true, new: true }
          );
        } catch (error) {
          logger.debug("Failed to persist cycled list status:", error.message);
        }
      });
    } catch (error) {
      logger.debug("Could not setup status persistence:", error.message);
    }
  }

  /**
   * Start periodic status logging
   */
  startStatusLogging() {
    setInterval(() => {
      if (this.isShuttingDown) return;

      const status = this.cycledList.status();
      logger.business("📊 Status Update:", {
        overallStatus: status.overallStatus,
        currentCycle: status.currentCycle,
        totalCycles: status.totalCycles,
        progress: `${status.progress}%`,
        currentJob: status.currentAsyncFn?.name || "None",
        nextJob: status.nextAsyncFn?.name || "None",
        isPaused: status.isPaused,
        isRunning: status.isRunning,
        pauseReason: status.pauseReason || null,
      });
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.business("🛑 Shutting down cycled list...");
    this.isShuttingDown = true;

    if (this.cycledList) {
      await this.cycledList.stop();
    }

    logger.debug("✅ Cycled list shutdown complete");
  }
}
