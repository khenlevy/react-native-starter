import { getJobsInExecutionOrder } from "@buydy/iso-business-types";
import logger from "@buydy/se-logger";

/**
 * Round-Robin Job Scheduler
 *
 * Manages job execution in a controlled round-robin fashion with:
 * - Controlled concurrency (max 2 jobs running simultaneously)
 * - Proper dependency handling
 * - Clean error handling and recovery
 * - Memory management between jobs
 */
export class JobScheduler {
  constructor(options = {}) {
    this.maxConcurrentJobs = options.maxConcurrentJobs || 1;
    this.jobDelayMs = options.jobDelayMs || 5000;
    this.jobTimeoutMs = options.jobTimeoutMs || 30 * 60 * 1000; // 30 minutes
    this.jobFunctionMap = options.jobFunctionMap || {};
    this.isRunning = false;
    this.currentJobs = new Map(); // Track running jobs
    this.jobQueue = []; // Jobs waiting to run
    this.jobHistory = []; // Track completed jobs
  }

  /**
   * Initialize the scheduler with job types
   */
  initialize() {
    const orderedJobTypes = getJobsInExecutionOrder();

    this.jobQueue = orderedJobTypes
      .map((jobType) => ({
        id: jobType.id,
        name: jobType.name,
        displayName: jobType.displayName,
        fn: this.jobFunctionMap[jobType.id],
        jobType,
        dependencies: jobType.dependencies || [],
        priority: this.getJobPriority(jobType),
        attempts: 0,
        maxAttempts: 3,
      }))
      .filter((job) => job.fn) // Only include jobs with functions
      .filter((job) => job.jobType.runOnInitialSync !== false) // Skip jobs that shouldn't run on initial sync
      .sort((a, b) => a.priority - b.priority); // Sort by priority

    logger.debug(`🎯 Job Scheduler initialized with ${this.jobQueue.length} jobs`);
    logger.debug(`📋 Job order: ${this.jobQueue.map((j) => j.name).join(" → ")}`);
  }

  /**
   * Start the round-robin job execution
   */
  async start() {
    if (this.isRunning) {
      logger.debug("⚠️  Scheduler already running");
      return;
    }

    this.isRunning = true;
    logger.business("🚀 Starting round-robin job scheduler");

    try {
      await this.executeRoundRobin();
    } catch (error) {
      logger.business("❌ Scheduler error:", error);
      throw error;
    } finally {
      this.isRunning = false;
      logger.business("🏁 Job scheduler stopped");
    }
  }

  /**
   * Execute jobs in round-robin fashion with controlled concurrency
   */
  async executeRoundRobin() {
    let completedJobs = 0;
    const totalJobs = this.jobQueue.length;

    while (completedJobs < totalJobs) {
      // Start new jobs up to max concurrency
      while (this.currentJobs.size < this.maxConcurrentJobs && this.jobQueue.length > 0) {
        const nextJob = this.getNextAvailableJob();
        if (nextJob) {
          this.startJob(nextJob);
        } else {
          break; // No available jobs
        }
      }

      // Wait for at least one job to complete
      if (this.currentJobs.size > 0) {
        await this.waitForJobCompletion();
        completedJobs++;
      } else {
        // No jobs running and none available - we're done
        break;
      }

      // Memory cleanup between rounds
      if (global.gc && completedJobs % 3 === 0) {
        logger.debug("🧹 Running garbage collection");
        global.gc();
      }
    }

    logger.business(`🎉 All ${totalJobs} jobs completed`);
  }

  /**
   * Get the next available job that can run (dependencies satisfied)
   */
  getNextAvailableJob() {
    for (let i = 0; i < this.jobQueue.length; i++) {
      const job = this.jobQueue[i];

      // Check if dependencies are satisfied
      if (this.areDependenciesSatisfied(job)) {
        return this.jobQueue.splice(i, 1)[0]; // Remove from queue
      }
    }
    return null;
  }

  /**
   * Check if job dependencies are satisfied
   */
  areDependenciesSatisfied(job) {
    if (!job.dependencies || job.dependencies.length === 0) {
      return true;
    }

    return job.dependencies.every((depId) =>
      this.jobHistory.some(
        (completed) => completed.id === depId && completed.status === "completed"
      )
    );
  }

  /**
   * Start a job execution
   */
  async startJob(job) {
    const jobId = `${job.name}-${Date.now()}`;

    logger.debug(
      `🚀 Starting job: ${job.displayName} [${this.currentJobs.size + 1}/${this.maxConcurrentJobs}]`
    );

    // Create database record for job execution
    let jobRecord = null;
    try {
      const { getModel } = await import("@buydy/se-db");
      const Jobs = getModel("jobs");

      jobRecord = new Jobs({
        name: job.name,
        displayName: job.displayName,
        status: "running",
        scheduledAt: new Date(),
        startedAt: new Date(),
        endedAt: null,
        progress: 0,
        result: null,
        error: null,
        logs: [],
        metadata: {
          jobId,
          scheduler: "initial-sync",
        },
      });

      await jobRecord.save();
      logger.debug(`📝 Created database record for job: ${job.displayName}`);
    } catch (error) {
      logger.business(`⚠️ Failed to create database record for job: ${job.displayName}`, {
        error: error.message,
      });
    }

    const jobExecution = {
      id: jobId,
      job,
      jobRecord,
      startTime: Date.now(),
      promise: this.executeJob(job, jobRecord),
    };

    this.currentJobs.set(jobId, jobExecution);

    // Handle job completion
    jobExecution.promise
      .then(async (result) => {
        await this.handleJobCompletion(jobId, "completed", result);
      })
      .catch(async (error) => {
        await this.handleJobCompletion(jobId, "failed", null, error);
      });
  }

  /**
   * Execute a single job with timeout and retry logic
   */
  async executeJob(job, jobRecord) {
    const { fn, name } = job;

    // Create job context with progress tracking
    const context = {
      progress: async (percent) => {
        logger.debug(`📊 [${name}] Progress: ${percent}%`);
        if (jobRecord) {
          try {
            jobRecord.progress = percent;
            await jobRecord.save();
          } catch (error) {
            logger.debug(`[${name}] Failed to update progress in database`, {
              error: error.message,
            });
          }
        }
      },
      appendLog: (msg) => logger.debug(`📝 [${name}] ${msg}`),
    };

    // Execute with timeout
    const result = await Promise.race([
      fn(context),
      this.createTimeoutPromise(this.jobTimeoutMs, name),
    ]);

    return result;
  }

  /**
   * Create a timeout promise for job execution
   */
  createTimeoutPromise(timeoutMs, jobName) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job ${jobName} timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    });
  }

  /**
   * Handle job completion (success or failure)
   */
  async handleJobCompletion(jobId, status, result, error) {
    const execution = this.currentJobs.get(jobId);
    if (!execution) return;

    const { job, jobRecord, startTime } = execution;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Update database record
    if (jobRecord) {
      try {
        jobRecord.status = status;
        jobRecord.endedAt = new Date();
        jobRecord.progress = status === "completed" ? 1 : jobRecord.progress;
        jobRecord.result = status === "completed" ? result : null;
        jobRecord.error = status === "failed" ? error?.message : null;

        await jobRecord.save();
        logger.debug(`📝 Updated database record for job: ${job.displayName}`);
      } catch (dbError) {
        logger.business(`⚠️ Failed to update database record for job: ${job.displayName}`, {
          error: dbError.message,
        });
      }
    }

    // Add to history
    this.jobHistory.push({
      id: job.id,
      name: job.name,
      status,
      duration: parseFloat(duration),
      error: error?.message,
      completedAt: new Date(),
    });

    // Log result
    if (status === "completed") {
      logger.debug(`✅ [${job.displayName}] completed in ${duration}s`);
    } else {
      logger.business(`❌ [${job.displayName}] failed after ${duration}s:`, error?.message);

      // Retry logic
      if (job.attempts < job.maxAttempts) {
        job.attempts++;
        logger.debug(
          `🔄 [${job.displayName}] retrying (attempt ${job.attempts}/${job.maxAttempts})`
        );
        this.jobQueue.unshift(job); // Add back to front of queue
      }
    }

    this.currentJobs.delete(jobId);
  }

  /**
   * Wait for at least one job to complete
   */
  async waitForJobCompletion() {
    return new Promise((resolve) => {
      const initialRunningJobs = this.currentJobs.size;

      const checkCompletion = () => {
        // Resolve when a job has completed (current jobs < initial running jobs)
        if (this.currentJobs.size < initialRunningJobs) {
          resolve();
        } else if (this.currentJobs.size === 0 && this.jobQueue.length === 0) {
          // All jobs are done
          resolve();
        } else {
          setTimeout(checkCompletion, 500);
        }
      };
      checkCompletion();
    });
  }

  /**
   * Get job priority based on category and dependencies
   */
  getJobPriority(jobType) {
    const priorityMap = {
      foundation: 1,
      fundamentals: 2,
      "data-processing": 3,
      analysis: 4,
    };

    return priorityMap[jobType.category] || 5;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentJobs: Array.from(this.currentJobs.keys()),
      queuedJobs: this.jobQueue.length,
      completedJobs: this.jobHistory.length,
      totalJobs: this.jobQueue.length + this.currentJobs.size + this.jobHistory.length,
    };
  }

  /**
   * Stop the scheduler gracefully
   */
  async stop() {
    logger.business("🛑 Stopping job scheduler");
    this.isRunning = false;

    // Wait for current jobs to complete
    while (this.currentJobs.size > 0) {
      logger.debug(`⏳ Waiting for ${this.currentJobs.size} jobs to complete`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.business("✅ Scheduler stopped gracefully");
  }
}
