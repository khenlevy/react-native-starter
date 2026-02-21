import { Jobs, getModel } from '@buydy/se-db';
import { getJobsMapByType } from '@buydy/iso-business-types';
import logger from '@buydy/se-logger';

/**
 * Get all jobs with optional filtering and pagination
 */
export const getAllJobs = async (req, res, next) => {
  try {
    const {
      status,
      name,
      limit = 50,
      skip = 0,
      sortBy = 'scheduledAt',
      sortOrder = 'desc',
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (name) query.name = { $regex: name, $options: 'i' };

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const jobs = await Jobs.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    // Get total count for pagination
    const total = await Jobs.countDocuments(query);

    res.json({
      jobs,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + parseInt(limit) < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single job by ID
 */
export const getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const job = await Jobs.findById(id).lean();

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${id} does not exist`,
      });
    }

    res.json({ job });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent jobs (last 24 hours)
 */
export const getRecentJobs = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    const jobs = await Jobs.findRecentJobs(parseInt(limit));

    res.json({ jobs });
  } catch (error) {
    next(error);
  }
};

/**
 * Get currently running jobs
 */
export const getRunningJobs = async (req, res, next) => {
  try {
    const jobs = await Jobs.findRunningJobs();

    res.json({ jobs });
  } catch (error) {
    next(error);
  }
};

/**
 * Get failed jobs
 */
export const getFailedJobs = async (req, res, next) => {
  try {
    const { since } = req.query;
    const sinceDate = since ? new Date(since) : null;

    const jobs = await Jobs.findFailedJobs(sinceDate);

    res.json({ jobs });
  } catch (error) {
    next(error);
  }
};

/**
 * Get job history for a specific job name
 */
export const getJobHistory = async (req, res, next) => {
  try {
    const { name } = req.params;
    const { limit = 20 } = req.query;

    const rawJobs = await Jobs.getJobHistory(name, parseInt(limit));

    const jobs = rawJobs.map((job) => {
      const cycleNumber = job?.metadata?.cycleNumber ?? null;
      const cycledListName = job?.metadata?.cycledListName ?? null;
      const nodeId = job?.metadata?.nodeId ?? null;

      return {
        ...job,
        cycleNumber,
        cycledListName,
        nodeId,
      };
    });

    res.json({ jobs });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new job
 */
export const createJob = async (req, res, next) => {
  try {
    const { name, metadata = {} } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Job name is required',
      });
    }

    const job = new Jobs({
      name,
      metadata,
      status: 'scheduled',
      scheduledAt: new Date(),
    });

    await job.save();

    res.status(201).json({ job });
  } catch (error) {
    next(error);
  }
};

/**
 * Update job status and progress
 */
export const updateJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      status,
      progress,
      result,
      error,
      logMessage,
      logLevel = 'info',
    } = req.body;

    const job = await Jobs.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${id} does not exist`,
      });
    }

    // Update status-specific fields
    if (status === 'running' && job.status === 'scheduled') {
      await job.markAsRunning();
    } else if (status === 'completed') {
      await job.markAsCompleted(result);
    } else if (status === 'failed') {
      await job.markAsFailed(error);
    } else if (status) {
      job.status = status;
    }

    // Update progress
    if (progress !== undefined) {
      await job.updateProgress(progress);
    }

    // Add log message
    if (logMessage) {
      await job.addLog(logMessage, logLevel);
    }

    // Save any other updates
    await job.save();

    res.json({ job });
  } catch (error) {
    next(error);
  }
};

/**
 * Run a job (create new job with same name and trigger execution)
 */
export const runJob = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get the existing job to copy its name and metadata
    const existingJob = await Jobs.findById(id);

    if (!existingJob) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${id} does not exist`,
      });
    }

    // Check if a job with the same name is already running
    const runningJob = await Jobs.findOne({
      name: existingJob.name,
      status: 'running',
    });

    if (runningJob) {
      return res.status(409).json({
        error: 'Job already running',
        message: `A job with name "${existingJob.name}" is already running`,
        runningJobId: runningJob._id,
      });
    }

    // Create a new job with the same name and metadata
    const newJob = new Jobs({
      name: existingJob.name,
      metadata: existingJob.metadata || {},
      status: 'scheduled',
      scheduledAt: new Date(),
      cronExpression: existingJob.cronExpression,
      timezone: existingJob.timezone,
    });

    await newJob.save();

    // Trigger actual job execution using makeJob with runNow
    try {
      // Import makeJob from the scanner package
      const { makeJob } = await import(
        '@buydy/app-stocks-scanner/src/jobs/makeJob.js'
      );

      // Get the job function from the job function map
      const { getJobsMapByType } = await import('@buydy/iso-business-types');
      const jobsMap = getJobsMapByType();
      const jobType = jobsMap[existingJob.name];

      if (jobType && jobType.function) {
        // Execute the job immediately
        makeJob(jobType.function, {
          name: existingJob.name,
          cron: '0 0 0 1 1 *', // Dummy cron (won't be used since runNow=true)
          runNow: true,
          timezone: existingJob.timezone || 'UTC',
        });

        res.status(201).json({
          message: 'Job execution triggered successfully',
          job: newJob,
          executionStarted: true,
        });
      } else {
        // If we can't find the job function, just mark as scheduled
        res.status(201).json({
          message:
            'Job scheduled successfully (job function not found for immediate execution)',
          job: newJob,
          executionStarted: false,
        });
      }
    } catch (executionError) {
      logger.business('Failed to trigger job execution', {
        error: executionError.message,
      });
      // Still return success since the job record was created
      res.status(201).json({
        message: 'Job created successfully (execution trigger failed)',
        job: newJob,
        executionStarted: false,
        warning: 'Could not trigger immediate execution',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a job
 */
export const deleteJob = async (req, res, next) => {
  try {
    const { id } = req.params;

    const job = await Jobs.findByIdAndDelete(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${id} does not exist`,
      });
    }

    res.json({
      message: 'Job deleted successfully',
      job: { id: job._id, name: job.name },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete all jobs
 */
export const deleteAllJobs = async (req, res, next) => {
  try {
    const result = await Jobs.deleteMany({});

    res.json({
      message: 'All jobs deleted successfully',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get job statistics
 */
export const getJobStats = async (req, res, next) => {
  try {
    const stats = await Jobs.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statsObject = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    // Get total jobs
    const total = await Jobs.countDocuments();

    // Get recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivity = await Jobs.countDocuments({
      scheduledAt: { $gte: yesterday },
    });

    res.json({
      stats: {
        total,
        scheduled: statsObject.scheduled || 0,
        running: statsObject.running || 0,
        completed: statsObject.completed || 0,
        failed: statsObject.failed || 0,
      },
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get jobs grouped by type/name with summary information
 */
export const getJobsByType = async (req, res, next) => {
  try {
    const { limit = 50, skip = 0 } = req.query;

    // Get unique job names with their latest execution and statistics
    // First, find the latest FINISHED job (completed or failed) for each job type
    const latestFinishedJobs = await Jobs.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'failed'] },
        },
      },
      {
        $sort: { endedAt: -1 },
      },
      {
        $group: {
          _id: '$name',
          latestFinishedJob: { $first: '$$ROOT' },
        },
      },
    ]);

    // Create a map of job name to latest finished job
    const latestFinishedMap = new Map();
    latestFinishedJobs.forEach((item) => {
      latestFinishedMap.set(item._id, item.latestFinishedJob);
    });

    // Get all job statistics
    // First, get the latest job for each name (sorted by scheduledAt descending, then take first)
    const jobTypesWithLatest = await Jobs.aggregate([
      {
        $sort: { scheduledAt: -1 }, // Sort all jobs by scheduledAt descending
      },
      {
        $group: {
          _id: '$name',
          count: { $sum: 1 },
          latestJob: { $first: '$$ROOT' }, // First one after sort is the latest
          runningCount: {
            $sum: { $cond: [{ $eq: ['$status', 'running'] }, 1, 0] },
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
          },
          scheduledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          name: '$_id',
          totalRuns: '$count',
          runningCount: 1,
          completedCount: 1,
          failedCount: 1,
          scheduledCount: 1,
          latestJob: 1,
          successRate: {
            $cond: [
              { $gt: ['$count', 0] },
              { $multiply: [{ $divide: ['$completedCount', '$count'] }, 100] },
              0,
            ],
          },
          schedule: null, // Will be populated from centralized job types
        },
      },
      { $sort: { 'latestJob.scheduledAt': -1 } },
      { $skip: parseInt(skip) },
      { $limit: parseInt(limit) },
    ]);

    // Use the corrected aggregation result
    const jobTypes = jobTypesWithLatest;

    const totalTypes = await Jobs.distinct('name').then(
      (names) => names.length,
    );

    // Get current cycle from CycledListStatus for running jobs without cycle
    const CycledListStatus = getModel('cycled_list_status');
    const statusDoc = await CycledListStatus.findOne().sort({
      lastUpdated: -1,
    });
    const currentCycle = statusDoc?.currentCycle || null;
    const cycledListName = statusDoc?.name || null;

    // Populate schedule information from centralized job types and extract cycleNumber
    const jobTypesMap = getJobsMapByType();
    const enrichedJobTypes = jobTypes.map((jobType) => {
      // Get the latest FINISHED job (completed or failed) for "last run" display
      const latestFinishedJob = latestFinishedMap.get(jobType.name);

      // Use latestFinishedJob for "last run" if it exists, otherwise use latestJob if it's finished
      const lastRunJob =
        latestFinishedJob ||
        (jobType.latestJob?.status !== 'running' ? jobType.latestJob : null);

      // Extract cycleNumber from latestJob metadata (for current running job)
      let cycleNumber = jobType.latestJob?.metadata?.cycleNumber || null;

      // If the job is running and doesn't have a cycleNumber, but it's part of the cycled list,
      // assign it the current cycle
      if (
        cycleNumber === null &&
        jobType.latestJob?.status === 'running' &&
        cycledListName &&
        jobType.latestJob?.metadata?.cycledListName === cycledListName &&
        currentCycle !== null
      ) {
        cycleNumber = currentCycle;
        // Update the job record with the cycle number
        Jobs.updateOne(
          { _id: jobType.latestJob._id },
          {
            $set: {
              'metadata.cycleNumber': currentCycle,
            },
          },
        ).catch((err) => {
          logger.business(
            `Failed to update cycle number for job ${jobType.latestJob._id}`,
            {
              error: err.message,
            },
          );
        });
      }

      const centralizedJobType = jobTypesMap[jobType.name];
      const enriched = {
        ...jobType,
        cycleNumber, // Add cycleNumber at the top level for easier access
        latestJob: jobType.latestJob, // Keep latestJob for current status/progress (may be running)
        lastFinishedJob: lastRunJob, // Add separate field for last finished run (completed/failed only)
      };

      // For "last run" display, use lastFinishedJob if available, otherwise latestJob if it's finished
      // This ensures UI shows the last FINISHED run time, not the current running job's start time
      if (lastRunJob && jobType.latestJob?.status === 'running') {
        // If there's a finished job and current is running, replace latestJob.endedAt with finished job's endedAt
        // This way UI can show "last finished run" time
        enriched.latestJob = {
          ...jobType.latestJob,
          endedAt: lastRunJob.endedAt, // Use finished job's endedAt for "last run" display
          lastFinishedStatus: lastRunJob.status, // Track what the last finished status was
        };
      }

      if (centralizedJobType) {
        enriched.schedule = {
          cron: centralizedJobType.cronDefinition,
          description: centralizedJobType.description,
          dependencies: centralizedJobType.dependencies.join(', ') || 'None',
          category: centralizedJobType.category,
          scope: centralizedJobType.scope,
          priority: centralizedJobType.priority,
          estimatedDuration: centralizedJobType.estimatedDuration,
          dataSource: centralizedJobType.dataSource,
          tags: centralizedJobType.tags,
        };
      }

      return enriched;
    });

    res.json({
      jobTypes: enrichedJobTypes,
      pagination: {
        total: totalTypes,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: skip + limit < totalTypes,
      },
    });
  } catch (error) {
    next(error);
  }
};
