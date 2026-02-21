import { getModel } from '@buydy/se-db';

/**
 * Get cycled list status
 */
export const getCycledListStatus = async (req, res, next) => {
  try {
    // Get status from database instead of in-memory
    const CycledListStatus = getModel('cycled_list_status');
    const Jobs = getModel('jobs');

    // Get the latest status (there should only be one document, but get the most recent)
    const statusDoc = await CycledListStatus.findOne().sort({
      lastUpdated: -1,
    });

    // If no status document exists, return not initialized
    if (!statusDoc) {
      const response = {
        name: null,
        overallStatus: 'not_initialized',
        isRunning: false,
        isPaused: false,
        manualPause: false,
        currentCycle: 0,
        totalCycles: 0,
        maxCycles: null,
        cycleInterval: 24 * 60 * 60 * 1000,
        totalAsyncFns: 0,
        completedAsyncFns: 0,
        failedAsyncFns: 0,
        currentAsyncFnIndex: -1,
        progress: 0,
        currentAsyncFn: null,
        nextAsyncFn: null,
        pauseConditions: [],
        continueConditions: [],
        nextCycleScheduled: null,
        statusText: 'Not Initialized',
        statusColor: 'gray',
        progressPercentage: 0,
        timeUntilNextCycle: null,
        cycleProgress: {
          current: 0,
          total: 0,
          percentage: 0,
          completed: 0,
          remaining: 0,
        },
        jobStatusBreakdown: {
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          paused: 0,
          retrying: 0,
        },
      };
      return res.json(response);
    }

    // Workflow definition - source of truth for total jobs per cycle
    // This must match the workflow in CycledListInitializer.createWorkflow()
    const expectedWorkflow = [
      {
        name: 'syncExchangesAndSymbols',
        functionName: 'syncAllExchangesAndSymbols',
      },
      {
        name: 'syncFundamentalsLargeCap',
        functionName: 'syncFundamentalsLargeCap',
      },
      {
        name: 'findAndMarkLargeCapStocks',
        functionName: 'findAndMarkLargeCapStocks',
      },
      { name: 'syncDividendsLargeCap', functionName: 'syncDividendsLargeCap' },
      {
        name: 'syncTechnicalsLargeCap',
        functionName: 'syncTechnicalsLargeCap',
        skipped: true,
      },
      { name: 'syncMetricsLargeCap', functionName: 'syncMetricsLargeCap' },
      {
        name: 'syncMetricsValuationLargeCap',
        functionName: 'syncMetricsValuationLargeCap',
      },
      {
        name: 'syncPricePerformanceLargeCap',
        functionName: 'syncPricePerformanceLargeCap',
      },
      {
        name: 'syncSectorPercentiles',
        functionName: 'syncSectorPercentiles',
        parallelGroup: 'percentiles',
      },
      {
        name: 'syncIndustryPercentiles',
        functionName: 'syncIndustryPercentiles',
        parallelGroup: 'percentiles',
      },
    ];
    // Count only non-skipped jobs for progress calculation
    const expectedTotalJobs = expectedWorkflow.filter(
      (job) => !job.skipped,
    ).length;

    // Get all jobs for current cycle - use lean() for better performance
    const currentCycleJobs = await Jobs.find({
      'metadata.cycledListName': statusDoc.name,
      'metadata.cycleNumber': statusDoc.currentCycle,
    }).lean();

    // Create a map of functionName -> job for easier lookup
    const jobMap = new Map();
    currentCycleJobs.forEach((job) => {
      jobMap.set(job.name, job);
    });

    // Materialize workflow with actual job records and derived status
    const workflowJobs = expectedWorkflow
      .filter((job) => !job.skipped)
      .map((job, index) => {
        const jobRecord = jobMap.get(job.functionName);
        const status = jobRecord?.status || 'pending';
        return {
          ...job,
          index,
          record: jobRecord || null,
          status,
        };
      });

    const isRunningStatus = (status) =>
      status === 'running' || status === 'retrying';
    const isCompletedStatus = (status) =>
      status === 'completed' || status === 'skipped';

    // Calculate progress based on workflow and actual job statuses
    let totalProgress = 0;
    workflowJobs.forEach((job) => {
      if (isCompletedStatus(job.status)) {
        totalProgress += 100;
      } else if (isRunningStatus(job.status)) {
        const progressValue =
          typeof job.record?.progress === 'number'
            ? Math.min(Math.max(job.record.progress, 0), 1)
            : 0;
        totalProgress += progressValue * 100;
      }
    });

    const completedJobs = workflowJobs.filter((job) =>
      isCompletedStatus(job.status),
    ).length;
    const runningJobs = workflowJobs.filter((job) =>
      isRunningStatus(job.status),
    ).length;
    const failedJobs = workflowJobs.filter(
      (job) => job.status === 'failed',
    ).length;
    const cancelledJobs = workflowJobs.filter(
      (job) => job.status === 'cancelled',
    ).length;
    const pausedJobs = workflowJobs.filter(
      (job) => job.status === 'paused',
    ).length;
    const retryingJobs = workflowJobs.filter(
      (job) => job.status === 'retrying',
    ).length;
    const pendingJobs = workflowJobs.filter(
      (job) => job.status === 'pending',
    ).length;

    const jobStatusBreakdown = {
      running: runningJobs,
      completed: completedJobs,
      failed: failedJobs,
      cancelled: cancelledJobs,
      paused: pausedJobs,
      retrying: retryingJobs,
      pending: pendingJobs,
      skipped: expectedWorkflow.filter((job) => job.skipped).length,
    };

    // Calculate progress percentage based on expected total jobs
    const calculatedProgress =
      expectedTotalJobs > 0
        ? Math.min(100, Math.max(0, totalProgress / expectedTotalJobs))
        : 0;

    const allJobsCompleted =
      workflowJobs.length > 0 &&
      workflowJobs.every((job) => isCompletedStatus(job.status));

    const runningJobIndex = workflowJobs.findIndex((job) =>
      isRunningStatus(job.status),
    );
    const nextIncompleteJobIndex = workflowJobs.findIndex(
      (job) => !isCompletedStatus(job.status),
    );

    let currentJobIndex = -1;
    if (runningJobIndex !== -1) {
      currentJobIndex = runningJobIndex;
    } else if (!allJobsCompleted) {
      currentJobIndex = nextIncompleteJobIndex;
    }

    const previousJob =
      currentJobIndex > 0
        ? [...workflowJobs]
            .slice(0, currentJobIndex)
            .reverse()
            .find((job) => isCompletedStatus(job.status))
        : null;

    const currentJob =
      currentJobIndex >= 0
        ? workflowJobs[currentJobIndex]
        : allJobsCompleted
        ? null
        : workflowJobs[0] || null;

    // When all jobs are completed, show the last job as previous and null current/next
    const safePreviousJob = allJobsCompleted
      ? workflowJobs[workflowJobs.length - 1] || null
      : previousJob;
    const safeCurrentJob = allJobsCompleted ? null : currentJob;
    const safeNextJob =
      allJobsCompleted || !currentJob
        ? null
        : workflowJobs
            .slice(currentJob.index + 1)
            .find((job) => !isCompletedStatus(job.status));

    const cycleCurrentPosition =
      safeCurrentJob && !allJobsCompleted
        ? Math.min(safeCurrentJob.index + 1, expectedTotalJobs)
        : Math.min(expectedTotalJobs, completedJobs);

    const formatJobInfo = (job) => {
      if (!job) {
        return null;
      }

      const displayName = job.record?.displayName || job.name;
      const progressPercentage =
        typeof job.record?.progress === 'number'
          ? Math.round(Math.min(Math.max(job.record.progress, 0), 1) * 100)
          : null;

      return {
        name: job.name,
        displayName,
        functionName: job.functionName,
        status: job.status || 'pending',
        progressPercentage,
        startedAt: job.record?.startedAt || null,
        endedAt: job.record?.endedAt || null,
        scheduledAt: job.record?.scheduledAt || null,
        machineName: job.record?.machineName || null,
        errorMessage: job.record?.error || null,
        result: job.record?.result || null,
        index: job.index,
      };
    };

    const previousJobInfo = formatJobInfo(safePreviousJob);
    const currentJobInfo = formatJobInfo(safeCurrentJob);
    const nextJobInfo = formatJobInfo(safeNextJob);

    // Format the response for the UI
    const response = {
      name: statusDoc.name,
      overallStatus: statusDoc.overallStatus,
      isRunning: statusDoc.isRunning,
      isPaused: statusDoc.isPaused,
      manualPause: statusDoc.manualPause || false,
      pauseReason: statusDoc.pauseReason || null,
      stopReason: statusDoc.stopReason || null,

      // Cycle information
      currentCycle: statusDoc.currentCycle,
      totalCycles: statusDoc.totalCycles,
      maxCycles: statusDoc.maxCycles,
      cycleInterval: statusDoc.cycleInterval,

      // Async function execution status - use workflow as source of truth
      totalAsyncFns: expectedTotalJobs,
      completedAsyncFns: completedJobs,
      failedAsyncFns: failedJobs,
      currentAsyncFnIndex: safeCurrentJob
        ? safeCurrentJob.index
        : allJobsCompleted
        ? expectedTotalJobs - 1
        : -1,
      progress: calculatedProgress, // Use recalculated progress

      // Current async function details
      previousAsyncFn: previousJobInfo,
      currentAsyncFn: currentJobInfo,
      nextAsyncFn: nextJobInfo,

      // Conditions
      pauseConditions: statusDoc.pauseConditions || [],
      continueConditions: statusDoc.continueConditions || [],

      // Timing
      nextCycleScheduled: statusDoc.nextCycleScheduled,

      // Additional UI-friendly data
      statusText: getStatusText(statusDoc.overallStatus),
      statusColor: getStatusColor(statusDoc.overallStatus),
      progressPercentage: Math.round(calculatedProgress), // Use recalculated progress
      timeUntilNextCycle: getTimeUntilNextCycle(statusDoc.nextCycleScheduled),
      cycleProgress: {
        current: cycleCurrentPosition,
        total: expectedTotalJobs,
        percentage: Math.round(calculatedProgress),
        completed: completedJobs,
        remaining: Math.max(expectedTotalJobs - completedJobs, 0),
      },
      jobTimeline: workflowJobs.map((job) => formatJobInfo(job)),
      jobStatusBreakdown,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get human-readable status text
 */
function getStatusText(overallStatus) {
  switch (overallStatus) {
    case 'running':
      return 'Running';
    case 'paused':
      return 'Paused (EODHD Limit)';
    case 'stopped':
      return 'Stopped';
    case 'completed':
      return 'Completed';
    case 'not_initialized':
      return 'Not Initialized';
    default:
      return 'Unknown';
  }
}

/**
 * Get status color for UI
 */
function getStatusColor(overallStatus) {
  switch (overallStatus) {
    case 'running':
      return 'green';
    case 'paused':
      return 'yellow';
    case 'stopped':
      return 'red';
    case 'completed':
      return 'blue';
    case 'not_initialized':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Get time until next cycle
 */
function getTimeUntilNextCycle(nextCycleScheduled) {
  if (!nextCycleScheduled) {
    return null;
  }

  const now = new Date();
  const nextCycle = new Date(nextCycleScheduled);
  const diffMs = nextCycle.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'Now';
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Get cycle progress information (reserved for future use)
 * @param {object} status
 */
// eslint-disable-next-line no-unused-vars
function getCycleProgress(status) {
  if (status.totalAsyncFns === 0) {
    return {
      current: 0,
      total: 0,
      percentage: 0,
      completed: 0,
      remaining: 0,
    };
  }

  return {
    current: status.currentAsyncFnIndex + 1,
    total: status.totalAsyncFns,
    percentage: Math.round(status.progress),
    completed: status.completedAsyncFns,
    remaining: status.totalAsyncFns - status.completedAsyncFns,
  };
}

/**
 * Manually pause the cycled list
 */
export const pauseCycledList = async (req, res, next) => {
  try {
    const { getCycledList } = await import('@buydy/se-list');
    const cycledList = getCycledList();

    if (!cycledList.name) {
      return res.status(400).json({
        error: 'Cycled list not initialized',
      });
    }

    await cycledList.pauseManually();

    res.json({
      success: true,
      message: 'Cycled list paused manually',
      status: cycledList.getStatus(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually resume the cycled list
 */
export const resumeCycledList = async (req, res, next) => {
  try {
    const { getCycledList } = await import('@buydy/se-list');
    const cycledList = getCycledList();

    if (!cycledList.name) {
      return res.status(400).json({
        error: 'Cycled list not initialized',
      });
    }

    await cycledList.resumeManually();

    res.json({
      success: true,
      message: 'Cycled list resumed manually',
      status: cycledList.getStatus(),
    });
  } catch (error) {
    next(error);
  }
};
