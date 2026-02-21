/**
 * Job Configuration Constants
 *
 * Centralized configuration for job settings to ensure consistency
 * across all jobs in the system.
 */

/**
 * Default cache and data retention settings for jobs
 */
export const JOB_CONFIG = {
  // Data retention period (how long to keep data before considering it stale)
  MAX_AGE_DAYS: 7,

  // Cache expiration period (how long to cache API responses)
  CACHE_EXPIRATION_HOURS: 24 * 7, // 7 days (same as MAX_AGE_DAYS)

  // Rate limiting settings
  RATE_LIMITS: {
    // Conservative rate limiting for most jobs
    CONSERVATIVE: 200,
    // Higher rate limiting for exchange/symbol jobs (less sensitive data)
    HIGH: 1000,
  },

  // Chunk processing settings
  CHUNK_SIZE: 10,

  // Dividend history settings
  DIVIDEND_HISTORY_YEARS: 10,

  // Large cap threshold
  LARGE_CAP_THRESHOLD: 1000000000, // $1B in dollars
};

/**
 * Get cache expiration hours based on max age days
 * @param {number} maxAgeDays - Maximum age in days
 * @returns {number} Cache expiration in hours
 */
export function getCacheExpirationHours(maxAgeDays = JOB_CONFIG.MAX_AGE_DAYS) {
  return maxAgeDays * 24;
}

/**
 * Get max age cutoff date
 * @param {number} maxAgeDays - Maximum age in days
 * @returns {Date} Cutoff date
 */
export function getMaxAgeCutoff(maxAgeDays = JOB_CONFIG.MAX_AGE_DAYS) {
  return new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
}

/**
 * Get job-specific configuration
 * @param {string} jobType - Type of job ('fundamentals', 'exchanges', 'technicals', 'dividends')
 * @returns {Object} Job-specific configuration
 */
export function getJobConfig(jobType) {
  const baseConfig = {
    maxAgeDays: JOB_CONFIG.MAX_AGE_DAYS,
    cacheExpirationHours: getCacheExpirationHours(JOB_CONFIG.MAX_AGE_DAYS),
    chunkSize: JOB_CONFIG.CHUNK_SIZE,
  };

  switch (jobType) {
    case 'exchanges':
      return {
        ...baseConfig,
        maxCallsPerMin: JOB_CONFIG.RATE_LIMITS.HIGH,
      };
    case 'fundamentals':
    case 'technicals':
    case 'dividends':
    case 'metrics':
      return {
        ...baseConfig,
        maxCallsPerMin: JOB_CONFIG.RATE_LIMITS.CONSERVATIVE,
      };
    case 'price-performance':
      return {
        ...baseConfig,
        maxAgeDays: Math.min(7, JOB_CONFIG.MAX_AGE_DAYS),
        cacheExpirationHours: getCacheExpirationHours(7),
        maxCallsPerMin: JOB_CONFIG.RATE_LIMITS.CONSERVATIVE,
      };
    default:
      return baseConfig;
  }
}

/**
 * Validate that cache expiration and max age are consistent
 * @param {number} maxAgeDays - Maximum age in days
 * @param {number} cacheExpirationHours - Cache expiration in hours
 * @returns {boolean} Whether the values are consistent
 */
export function validateCacheConsistency(maxAgeDays, cacheExpirationHours) {
  const expectedCacheHours = getCacheExpirationHours(maxAgeDays);
  return cacheExpirationHours === expectedCacheHours;
}

export default JOB_CONFIG;
