import {
  getJobs,
  getJobsMapByType,
  getJobsByCategory,
  getJobsByScope,
  getJobsByTags,
  getJobById,
  getDailyJobs,
  getWeeklyJobs,
  getLargeCapJobs,
  getAllStocksJobs,
  getJobsInExecutionOrder,
  getJobsWithScheduleInfo,
  getJobStatistics,
  validateJobType,
} from '@buydy/iso-business-types';

/**
 * Get all job types
 */
export const getAllJobTypes = async (req, res, next) => {
  try {
    const {
      category,
      scope,
      priority,
      enabled,
      tags,
      cron,
      includeScheduleInfo = false,
    } = req.query;

    let jobTypes = getJobs();

    // Apply filters
    if (category) {
      const categoryJobs = getJobsByCategory()[category];
      if (categoryJobs) {
        jobTypes = categoryJobs;
      } else {
        jobTypes = [];
      }
    }

    if (scope) {
      const scopeJobs = getJobsByScope()[scope];
      if (scopeJobs) {
        jobTypes = jobTypes.filter((job) => scopeJobs.includes(job));
      } else {
        jobTypes = [];
      }
    }

    if (priority) {
      jobTypes = jobTypes.filter((job) => job.priority === priority);
    }

    if (enabled !== undefined) {
      const enabledStatus = enabled === 'true';
      jobTypes = jobTypes.filter((job) => job.enabled === enabledStatus);
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      jobTypes = getJobsByTags(tagArray).filter((job) =>
        jobTypes.includes(job),
      );
    }

    if (cron) {
      jobTypes = jobTypes.filter((job) => job.cronDefinition === cron);
    }

    // Add schedule info if requested
    if (includeScheduleInfo === 'true') {
      jobTypes = getJobsWithScheduleInfo().filter((job) =>
        jobTypes.some((j) => j.id === job.id),
      );
    }

    res.json({
      jobTypes,
      total: jobTypes.length,
      filters: {
        category,
        scope,
        priority,
        enabled,
        tags,
        cron,
        includeScheduleInfo,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific job type by ID
 */
export const getJobTypeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeScheduleInfo = false } = req.query;

    const jobType = getJobById(id);

    if (!jobType) {
      return res.status(404).json({
        error: 'Job type not found',
        id,
      });
    }

    let result = jobType;

    if (includeScheduleInfo === 'true') {
      const jobsWithSchedule = getJobsWithScheduleInfo();
      const jobWithSchedule = jobsWithSchedule.find((j) => j.id === id);
      if (jobWithSchedule) {
        result = jobWithSchedule;
      }
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get job types grouped by category
 */
export const getJobTypesByCategory = async (req, res, next) => {
  try {
    const jobsByCategory = getJobsByCategory();

    res.json({
      categories: jobsByCategory,
      categoryNames: Object.keys(jobsByCategory),
      totalCategories: Object.keys(jobsByCategory).length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get job types grouped by scope
 */
export const getJobTypesByScope = async (req, res, next) => {
  try {
    const jobsByScope = getJobsByScope();

    res.json({
      scopes: jobsByScope,
      scopeNames: Object.keys(jobsByScope),
      totalScopes: Object.keys(jobsByScope).length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get job types in execution order (respecting dependencies)
 */
export const getJobTypesInExecutionOrder = async (req, res, next) => {
  try {
    const orderedJobs = getJobsInExecutionOrder();

    res.json({
      jobTypes: orderedJobs,
      total: orderedJobs.length,
      executionOrder: orderedJobs.map((job) => ({
        id: job.id,
        name: job.name,
        displayName: job.displayName,
        dependencies: job.dependencies,
        cronDefinition: job.cronDefinition,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get job types with schedule information
 */
export const getJobTypesWithSchedule = async (req, res, next) => {
  try {
    const jobsWithSchedule = getJobsWithScheduleInfo();

    res.json({
      jobTypes: jobsWithSchedule,
      total: jobsWithSchedule.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get job type statistics
 */
export const getJobTypeStatistics = async (req, res, next) => {
  try {
    const stats = getJobStatistics();

    res.json({
      statistics: stats,
      summary: {
        totalJobs: stats.total,
        enabledJobs: stats.byEnabled.enabled,
        disabledJobs: stats.byEnabled.disabled,
        categories: Object.keys(stats.byCategory).length,
        scopes: Object.keys(stats.byScope).length,
        priorities: Object.keys(stats.byPriority).length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get job types map for quick lookup
 */
export const getJobTypesMap = async (req, res, next) => {
  try {
    const jobsMap = getJobsMapByType();

    res.json({
      jobTypesMap: jobsMap,
      total: Object.keys(jobsMap).length / 2, // Divided by 2 because each job is mapped by both id and name
      availableKeys: Object.keys(jobsMap),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get convenience job type collections
 */
export const getConvenienceJobTypes = async (req, res, next) => {
  try {
    const { type } = req.params;

    let jobTypes = [];
    let description = '';

    switch (type) {
      case 'daily':
        jobTypes = getDailyJobs();
        description = 'Jobs that run daily';
        break;
      case 'weekly':
        jobTypes = getWeeklyJobs();
        description = 'Jobs that run weekly';
        break;
      case 'large-cap':
        jobTypes = getLargeCapJobs();
        description = 'Jobs that process large cap stocks';
        break;
      case 'all-stocks':
        jobTypes = getAllStocksJobs();
        description = 'Jobs that process all stocks';
        break;
      default:
        return res.status(400).json({
          error: 'Invalid convenience type',
          availableTypes: ['daily', 'weekly', 'large-cap', 'all-stocks'],
        });
    }

    res.json({
      type,
      description,
      jobTypes,
      total: jobTypes.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate a job type definition
 */
export const validateJobTypeDefinition = async (req, res, next) => {
  try {
    const jobType = req.body;

    if (!jobType) {
      return res.status(400).json({
        error: 'Job type definition is required',
      });
    }

    const validation = validateJobType(jobType);

    res.json({
      validation,
      jobType: validation.isValid ? jobType : null,
    });
  } catch (error) {
    next(error);
  }
};
