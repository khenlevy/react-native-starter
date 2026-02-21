import { getModel } from '@buydy/se-db';
import {
  getEndpointTypes,
  getEndpointTypesByCategory,
} from '@buydy/iso-business-types';

/**
 * EODHD API Usage Controller
 * Handles API requests for EODHD usage tracking and analytics
 */

/**
 * Get EODHD API usage statistics
 */
export const getUsageStats = async (req, res, next) => {
  try {
    const CachedResponseEodhd = getModel('cached_response_eodhistoricaldata');

    // Parse query parameters
    const { endpoint, since, until, jobName: _jobName } = req.query;

    // Build filters
    const filters = {};
    if (endpoint) filters.endpoint = endpoint;
    if (since) filters.since = new Date(since);
    if (until) filters.until = new Date(until);
    // jobName is not available in cache collection, ignore it

    // Get usage statistics
    const statsResult = await CachedResponseEodhd.getUsageStats(filters);
    const stats =
      statsResult.length > 0
        ? statsResult[0]
        : {
            totalRequests: 0,
            cachedRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cacheHitRate: 0,
            successRate: 0,
            avgResponseTime: 0,
            totalResponseSize: 0,
            uniqueEndpoints: 0,
          };

    res.json({ stats });
  } catch (error) {
    next(error);
  }
};

/**
 * Get endpoint-specific statistics
 */
export const getEndpointStats = async (req, res, next) => {
  try {
    const CachedResponseEodhd = getModel('cached_response_eodhistoricaldata');

    // Parse query parameters
    const { endpoint, since, until, jobName: _jobName } = req.query;

    // Build filters
    const filters = {};
    if (endpoint && endpoint !== 'all') filters.endpoint = endpoint;
    if (since) filters.since = new Date(since);
    if (until) filters.until = new Date(until);
    // jobName is not available in cache collection, ignore it

    // Get endpoint statistics
    const endpointStats = await CachedResponseEodhd.getEndpointStats(filters);

    res.json({ endpointStats: endpointStats || [] });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent EODHD API usage records
 */
export const getRecentUsage = async (req, res, next) => {
  try {
    const CachedResponseEodhd = getModel('cached_response_eodhistoricaldata');

    // Parse query parameters
    const {
      limit = 100,
      endpoint,
      isCached: _isCached,
      isSuccess: _isSuccess,
      since,
      until,
      jobName: _jobName,
    } = req.query;

    // Build filters
    const filters = {};
    if (endpoint) filters.endpoint = endpoint;
    // isCached is always true for cache entries, filter handled in UI
    // isSuccess is always true for cache entries, filter handled in UI
    if (since) filters.since = new Date(since);
    if (until) filters.until = new Date(until);
    // jobName is not available in cache collection, ignore it

    // Get recent usage records
    const usage = await CachedResponseEodhd.getRecentUsage(
      parseInt(limit),
      filters,
    );

    // Map fields to match UI expectations
    const mappedUsage = usage.map((record) => ({
      endpoint: record.apiEndpoint,
      method: 'GET', // All cache entries are GET requests
      url: '', // Not available in cache
      params: record.params || {},
      statusCode: 200, // All cached entries are successful
      isSuccess: true, // All cached entries are successful
      isCached: true, // All entries are cached
      responseTime: 0, // Not tracked in cache
      responseSize: record.data ? JSON.stringify(record.data).length : 0, // Estimate from data
      error: null,
      errorDetails: null,
      jobName: null, // Not available in cache
      clientId: 'eodhd-client',
      requestedAt: record.createdAt,
      respondedAt: record.updatedAt,
      cacheKey: record.cacheKey,
      cacheTtl: null,
      rateLimit: null,
    }));

    res.json({ usage: mappedUsage });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available endpoints for filtering
 */
export const getAvailableEndpoints = async (req, res, next) => {
  try {
    // Get all endpoint types from enum
    const endpointTypes = getEndpointTypes();

    // Get distinct endpoints from database (for endpoints that have been used)
    const CachedResponseEodhd = getModel('cached_response_eodhistoricaldata');
    const usedEndpoints = await CachedResponseEodhd.distinct('apiEndpoint', {
      apiEndpoint: { $ne: null },
    });

    // Combine enum endpoints with used endpoints
    const allEndpoints = [
      ...endpointTypes.map((et) => et.displayName),
      ...usedEndpoints.filter(
        (e) => !endpointTypes.some((et) => et.displayName === e),
      ),
    ];

    // Remove duplicates and sort
    const uniqueEndpoints = [...new Set(allEndpoints)].sort();

    res.json({ endpoints: uniqueEndpoints });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available job names for filtering
 */
export const getAvailableJobs = async (req, res, next) => {
  try {
    // Job names are not available in the cache collection
    // Return empty array as jobs are not tracked in cache
    res.json({ jobs: [] });
  } catch (error) {
    next(error);
  }
};

/**
 * Get endpoint types with categories
 */
export const getEndpointTypesData = async (req, res, next) => {
  try {
    const endpointTypes = getEndpointTypes();
    const endpointTypesByCategory = getEndpointTypesByCategory();

    res.json({
      endpointTypes,
      endpointTypesByCategory,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get usage trends over time
 */
export const getUsageTrends = async (req, res, next) => {
  try {
    const CachedResponseEodhd = getModel('cached_response_eodhistoricaldata');

    // Parse query parameters
    const {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default to last 7 days
      until = new Date(),
      groupBy = 'hour', // hour, day, week
    } = req.query;

    // Build date grouping
    let dateGroup;
    switch (groupBy) {
      case 'hour':
        dateGroup = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' },
        };
        break;
      case 'day':
        dateGroup = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        };
        break;
      case 'week':
        dateGroup = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' },
        };
        break;
      default:
        dateGroup = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        };
    }

    // Aggregate usage trends
    const trends = await CachedResponseEodhd.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(since),
            $lte: new Date(until),
          },
        },
      },
      {
        $group: {
          _id: dateGroup,
          totalRequests: { $sum: 1 },
          cachedRequests: { $sum: 1 }, // All entries are cached
          successfulRequests: { $sum: 1 }, // All cached entries are successful
          failedRequests: { $sum: 0 },
          totalResponseSize: {
            $sum: {
              $cond: [
                { $isArray: '$data' },
                { $size: '$data' },
                {
                  $cond: [
                    { $eq: [{ $type: '$data' }, 'object'] },
                    { $size: { $objectToArray: '$data' } },
                    0,
                  ],
                },
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
              hour: '$_id.hour || 0',
            },
          },
          totalRequests: 1,
          cachedRequests: 1,
          successfulRequests: 1,
          failedRequests: 1,
          cacheHitRate: {
            $cond: [
              { $gt: ['$totalRequests', 0] },
              {
                $multiply: [
                  { $divide: ['$cachedRequests', '$totalRequests'] },
                  100,
                ],
              },
              100, // All are cached
            ],
          },
          successRate: {
            $cond: [
              { $gt: ['$totalRequests', 0] },
              {
                $multiply: [
                  { $divide: ['$successfulRequests', '$totalRequests'] },
                  100,
                ],
              },
              100, // All are successful
            ],
          },
          avgResponseTime: { $literal: 0 }, // Not available
          totalResponseSize: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    res.json({ trends });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete old usage records
 */
export const deleteOldRecords = async (req, res, next) => {
  try {
    const CachedResponseEodhd = getModel('cached_response_eodhistoricaldata');

    // Parse query parameters
    const {
      olderThan = 30, // Default to 30 days
    } = req.query;

    // Calculate cutoff date
    const cutoffDate = new Date(Date.now() - olderThan * 24 * 60 * 60 * 1000);

    // Delete old records (expired cache entries)
    const result = await CachedResponseEodhd.deleteMany({
      expiresAt: { $lt: cutoffDate },
    });

    res.json({
      message: `Deleted ${result.deletedCount} old cache entries`,
      deletedCount: result.deletedCount,
      cutoffDate,
    });
  } catch (error) {
    next(error);
  }
};
