import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const jobTypes = JSON.parse(
  readFileSync(join(__dirname, 'jobTypes.json'), 'utf8'),
);

const endpointTypes = JSON.parse(
  readFileSync(join(__dirname, 'endpointTypes.json'), 'utf8'),
);

const metrics = JSON.parse(
  readFileSync(join(__dirname, 'metrics.json'), 'utf8'),
);

/**
 * Get all job types as an array
 * @returns {Array} Array of all job type definitions
 */
export function getJobs() {
  return jobTypes;
}

/**
 * Get job types mapped by their ID/name for quick lookup
 * @returns {Object} Object with job IDs as keys and job definitions as values
 */
export function getJobsMapByType() {
  return jobTypes.reduce((map, job) => {
    map[job.id] = job;
    map[job.name] = job; // Also map by name for backward compatibility
    return map;
  }, {});
}

/**
 * Get job types grouped by category
 * @returns {Object} Object with categories as keys and arrays of jobs as values
 */
export function getJobsByCategory() {
  return jobTypes.reduce((groups, job) => {
    if (!groups[job.category]) {
      groups[job.category] = [];
    }
    groups[job.category].push(job);
    return groups;
  }, {});
}

/**
 * Get job types grouped by scope
 * @returns {Object} Object with scopes as keys and arrays of jobs as values
 */
export function getJobsByScope() {
  return jobTypes.reduce((groups, job) => {
    if (!groups[job.scope]) {
      groups[job.scope] = [];
    }
    groups[job.scope].push(job);
    return groups;
  }, {});
}

/**
 * Get job types filtered by enabled status
 * @param {boolean} enabled - Whether to get enabled (true) or disabled (false) jobs
 * @returns {Array} Array of job type definitions
 */
export function getJobsByEnabledStatus(enabled = true) {
  return jobTypes.filter((job) => job.enabled === enabled);
}

/**
 * Get job types filtered by priority
 * @param {string} priority - Priority level to filter by
 * @returns {Array} Array of job type definitions
 */
export function getJobsByPriority(priority) {
  return jobTypes.filter((job) => job.priority === priority);
}

/**
 * Get job types that have a specific dependency
 * @param {string} dependencyId - The job ID that other jobs depend on
 * @returns {Array} Array of job type definitions that depend on the specified job
 */
export function getJobsByDependency(dependencyId) {
  return jobTypes.filter((job) => job.dependencies.includes(dependencyId));
}

/**
 * Get job types filtered by tags
 * @param {string|Array} tags - Tag or array of tags to filter by
 * @returns {Array} Array of job type definitions
 */
export function getJobsByTags(tags) {
  const tagArray = Array.isArray(tags) ? tags : [tags];
  return jobTypes.filter((job) =>
    tagArray.some((tag) => job.tags.includes(tag)),
  );
}

/**
 * Get a specific job type by ID or name
 * @param {string} identifier - Job ID or name
 * @returns {Object|null} Job type definition or null if not found
 */
export function getJobById(identifier) {
  return (
    jobTypes.find((job) => job.id === identifier || job.name === identifier) ||
    null
  );
}

/**
 * Get job types that run on a specific schedule
 * @param {string} cronDefinition - Cron expression to match
 * @returns {Array} Array of job type definitions
 */
export function getJobsByCron(cronDefinition) {
  return jobTypes.filter((job) => job.cronDefinition === cronDefinition);
}

/**
 * Get job types that run daily
 * @returns {Array} Array of daily job type definitions
 */
export function getDailyJobs() {
  return getJobsByTags('daily');
}

/**
 * Get job types that run weekly
 * @returns {Array} Array of weekly job type definitions
 */
export function getWeeklyJobs() {
  return getJobsByTags('weekly');
}

/**
 * Get job types that process large cap stocks
 * @returns {Array} Array of large cap job type definitions
 */
export function getLargeCapJobs() {
  return getJobsByScope('large-cap');
}

/**
 * Get job types that process all stocks
 * @returns {Array} Array of all-stocks job type definitions
 */
export function getAllStocksJobs() {
  return getJobsByScope('all');
}

/**
 * Get job execution order based on dependencies
 * @returns {Array} Array of job type definitions in execution order
 */
export function getJobsInExecutionOrder() {
  const jobs = [...jobTypes];
  const ordered = [];
  const processed = new Set();

  function processJob(job) {
    if (processed.has(job.id)) return;

    // Process dependencies first
    job.dependencies.forEach((depId) => {
      const depJob = jobs.find((j) => j.id === depId);
      if (depJob) {
        processJob(depJob);
      }
    });

    ordered.push(job);
    processed.add(job.id);
  }

  jobs.forEach(processJob);
  return ordered;
}

/**
 * Get job types with their schedule information formatted for UI display
 * @returns {Array} Array of job type definitions with formatted schedule info
 */
export function getJobsWithScheduleInfo() {
  return jobTypes.map((job) => ({
    ...job,
    scheduleInfo: {
      cron: job.cronDefinition,
      description: job.cronDescription,
      timezone: job.timezone,
      nextRun: null, // Could be calculated with a cron parser library
      isRecurring: true,
    },
  }));
}

/**
 * Validate job type definition
 * @param {Object} job - Job type definition to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export function validateJobType(job) {
  const errors = [];
  const required = [
    'id',
    'name',
    'displayName',
    'description',
    'category',
    'scope',
    'cronDefinition',
  ];

  required.forEach((field) => {
    if (!job[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  if (job.dependencies && !Array.isArray(job.dependencies)) {
    errors.push('Dependencies must be an array');
  }

  if (job.tags && !Array.isArray(job.tags)) {
    errors.push('Tags must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get job statistics
 * @returns {Object} Statistics about job types
 */
export function getJobStatistics() {
  const stats = {
    total: jobTypes.length,
    byCategory: {},
    byScope: {},
    byPriority: {},
    byEnabled: { enabled: 0, disabled: 0 },
    bySchedule: { daily: 0, weekly: 0, other: 0 },
  };

  jobTypes.forEach((job) => {
    // Count by category
    stats.byCategory[job.category] = (stats.byCategory[job.category] || 0) + 1;

    // Count by scope
    stats.byScope[job.scope] = (stats.byScope[job.scope] || 0) + 1;

    // Count by priority
    stats.byPriority[job.priority] = (stats.byPriority[job.priority] || 0) + 1;

    // Count by enabled status
    stats.byEnabled[job.enabled ? 'enabled' : 'disabled']++;

    // Count by schedule
    if (job.tags.includes('daily')) {
      stats.bySchedule.daily++;
    } else if (job.tags.includes('weekly')) {
      stats.bySchedule.weekly++;
    } else {
      stats.bySchedule.other++;
    }
  });

  return stats;
}

// ============================================================================
// ENDPOINT TYPES FUNCTIONS
// ============================================================================

/**
 * Get all endpoint types as an array
 * @returns {Array} Array of all endpoint type definitions
 */
export function getEndpointTypes() {
  return endpointTypes;
}

/**
 * Get endpoint types mapped by their ID/name for quick lookup
 * @returns {Object} Object with endpoint IDs as keys and endpoint definitions as values
 */
export function getEndpointTypesMapByType() {
  return endpointTypes.reduce((map, endpoint) => {
    map[endpoint.id] = endpoint;
    map[endpoint.name] = endpoint;
    map[endpoint.path] = endpoint; // Also map by path for URL matching
    return map;
  }, {});
}

/**
 * Get endpoint types grouped by category
 * @returns {Object} Object with categories as keys and arrays of endpoints as values
 */
export function getEndpointTypesByCategory() {
  return endpointTypes.reduce((groups, endpoint) => {
    if (!groups[endpoint.category]) {
      groups[endpoint.category] = [];
    }
    groups[endpoint.category].push(endpoint);
    return groups;
  }, {});
}

/**
 * Get endpoint types filtered by enabled status
 * @param {boolean} enabled - Whether to get enabled (true) or disabled (false) endpoints
 * @returns {Array} Array of endpoint type definitions
 */
export function getEndpointTypesByEnabledStatus(enabled = true) {
  return endpointTypes.filter((endpoint) => endpoint.enabled === enabled);
}

/**
 * Get a specific endpoint type by ID, name, or path
 * @param {string} identifier - Endpoint ID, name, or path
 * @returns {Object|null} Endpoint type definition or null if not found
 */
export function getEndpointTypeById(identifier) {
  return (
    endpointTypes.find(
      (endpoint) =>
        endpoint.id === identifier ||
        endpoint.name === identifier ||
        endpoint.path === identifier,
    ) || null
  );
}

/**
 * Get endpoint type by path (for URL matching)
 * @param {string} path - API path to match
 * @returns {Object|null} Endpoint type definition or null if not found
 */
export function getEndpointTypeByPath(path) {
  return endpointTypes.find((endpoint) => endpoint.path === path) || null;
}

/**
 * Get endpoint statistics
 * @returns {Object} Statistics about endpoint types
 */
export function getEndpointTypeStatistics() {
  const stats = {
    total: endpointTypes.length,
    byCategory: {},
    byEnabled: { enabled: 0, disabled: 0 },
  };

  endpointTypes.forEach((endpoint) => {
    // Count by category
    stats.byCategory[endpoint.category] =
      (stats.byCategory[endpoint.category] || 0) + 1;

    // Count by enabled status
    stats.byEnabled[endpoint.enabled ? 'enabled' : 'disabled']++;
  });

  return stats;
}

/**
 * Validate endpoint type definition
 * @param {Object} endpoint - Endpoint type definition to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export function validateEndpointType(endpoint) {
  const errors = [];
  const required = [
    'id',
    'name',
    'displayName',
    'description',
    'category',
    'path',
  ];

  required.forEach((field) => {
    if (!endpoint[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// METRICS FUNCTIONS
// ============================================================================

/**
 * Get all metrics as an array
 * @returns {Array} Array of all metric definitions
 */
export function getMetrics() {
  return metrics;
}

/**
 * Get metrics mapped by their ID/key for quick lookup
 * @returns {Object} Object with metric IDs as keys and metric definitions as values
 */
export function getMetricsMapByType() {
  return metrics.reduce((map, metric) => {
    map[metric.id] = metric;
    map[metric.key] = metric;
    map[metric.apiField] = metric; // Also map by API field name
    map[metric.dbField] = metric; // Also map by DB field name
    return map;
  }, {});
}

/**
 * Get metrics grouped by category
 * @returns {Object} Object with categories as keys and arrays of metrics as values
 */
export function getMetricsByCategory() {
  return metrics.reduce((groups, metric) => {
    if (!groups[metric.category]) {
      groups[metric.category] = [];
    }
    groups[metric.category].push(metric);
    return groups;
  }, {});
}

/**
 * Get metrics filtered by enabled status
 * @param {boolean} enabled - Whether to get enabled (true) or disabled (false) metrics
 * @returns {Array} Array of metric definitions
 */
export function getMetricsByEnabledStatus(enabled = true) {
  return metrics.filter((metric) => metric.enabled === enabled);
}

/**
 * Get metrics filtered by priority
 * @param {number} priority - Priority level to filter by
 * @returns {Array} Array of metric definitions
 */
export function getMetricsByPriority(priority) {
  return metrics.filter((metric) => metric.priority === priority);
}

/**
 * Get metrics filtered by tags
 * @param {string|Array} tags - Tag or array of tags to filter by
 * @returns {Array} Array of metric definitions
 */
export function getMetricsByTags(tags) {
  const tagArray = Array.isArray(tags) ? [tags] : [tags];
  return metrics.filter((metric) =>
    tagArray.some((tag) => metric.tags.includes(tag)),
  );
}

/**
 * Get a specific metric by ID, key, API field, or DB field
 * @param {string} identifier - Metric ID, key, API field, or DB field
 * @returns {Object|null} Metric definition or null if not found
 */
export function getMetricById(identifier) {
  return (
    metrics.find(
      (metric) =>
        metric.id === identifier ||
        metric.key === identifier ||
        metric.apiField === identifier ||
        metric.dbField === identifier,
    ) || null
  );
}

/**
 * Get all dividend-related metrics
 * @returns {Array} Array of dividend metric definitions
 */
export function getDividendMetrics() {
  return getMetricsByCategory('dividend');
}

/**
 * Get metrics sorted by priority (ascending)
 * @returns {Array} Array of metric definitions sorted by priority
 */
export function getMetricsByPriorityOrder() {
  return [...metrics].sort((a, b) => a.priority - b.priority);
}

/**
 * Get metric statistics
 * @returns {Object} Statistics about metrics
 */
export function getMetricStatistics() {
  const stats = {
    total: metrics.length,
    byCategory: {},
    byType: {},
    byEnabled: { enabled: 0, disabled: 0 },
    byDataType: {},
  };

  metrics.forEach((metric) => {
    // Count by category
    stats.byCategory[metric.category] =
      (stats.byCategory[metric.category] || 0) + 1;

    // Count by type
    stats.byType[metric.type] = (stats.byType[metric.type] || 0) + 1;

    // Count by enabled status
    stats.byEnabled[metric.enabled ? 'enabled' : 'disabled']++;

    // Count by data type
    stats.byDataType[metric.dataType] =
      (stats.byDataType[metric.dataType] || 0) + 1;
  });

  return stats;
}

/**
 * Validate metric definition
 * @param {Object} metric - Metric definition to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export function validateMetric(metric) {
  const errors = [];
  const required = [
    'id',
    'key',
    'label',
    'displayName',
    'description',
    'category',
    'type',
    'dataType',
    'apiField',
    'dbField',
  ];

  required.forEach((field) => {
    if (!metric[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  if (metric.tags && !Array.isArray(metric.tags)) {
    errors.push('Tags must be an array');
  }

  if (metric.validation && typeof metric.validation !== 'object') {
    errors.push('Validation must be an object');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get metrics for API response (includes only essential fields)
 * @returns {Array} Array of metric definitions with essential fields only
 */
export function getMetricsForAPI() {
  return metrics.map((metric) => ({
    id: metric.id,
    key: metric.key,
    label: metric.label,
    displayName: metric.displayName,
    description: metric.description,
    category: metric.category,
    type: metric.type,
    unit: metric.unit,
    dataType: metric.dataType,
    precision: metric.precision,
    enabled: metric.enabled,
    priority: metric.priority,
    tags: metric.tags,
    apiField: metric.apiField,
    dbField: metric.dbField,
  }));
}

// Import and re-export metrics utilities
export {
  getCalculableMetrics,
  getDefaultMetricsForAPI,
  getMetricsConfigForJobs,
  validateMetrics,
  getMetricDisplayInfo,
  getCalculatorMapping,
  logMetricsConfiguration,
  normalizeCurrencyCode,
} from './metricsUtils.js';

// Import and re-export job configuration
export {
  JOB_CONFIG,
  getCacheExpirationHours,
  getMaxAgeCutoff,
  getJobConfig,
  validateCacheConsistency,
} from './jobConfig.js';

// Export the raw types for direct access
export { jobTypes, endpointTypes, metrics };

// Default export
export default {
  // Job types
  getJobs,
  getJobsMapByType,
  getJobsByCategory,
  getJobsByScope,
  getJobsByEnabledStatus,
  getJobsByPriority,
  getJobsByDependency,
  getJobsByTags,
  getJobById,
  getJobsByCron,
  getDailyJobs,
  getWeeklyJobs,
  getLargeCapJobs,
  getAllStocksJobs,
  getJobsInExecutionOrder,
  getJobsWithScheduleInfo,
  validateJobType,
  getJobStatistics,
  jobTypes,

  // Endpoint types
  getEndpointTypes,
  getEndpointTypesMapByType,
  getEndpointTypesByCategory,
  getEndpointTypesByEnabledStatus,
  getEndpointTypeById,
  getEndpointTypeByPath,
  getEndpointTypeStatistics,
  validateEndpointType,
  endpointTypes,

  // Metrics
  getMetrics,
  getMetricsMapByType,
  getMetricsByCategory,
  getMetricsByEnabledStatus,
  getMetricsByPriority,
  getMetricsByTags,
  getMetricById,
  getDividendMetrics,
  getMetricsByPriorityOrder,
  getMetricStatistics,
  validateMetric,
  getMetricsForAPI,
  metrics,
};
