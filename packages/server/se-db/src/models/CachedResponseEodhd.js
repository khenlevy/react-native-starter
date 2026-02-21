import mongoose from "mongoose";

/**
 * Cached Response EODHD Schema
 * Tracks cached EODHD API responses for usage analytics
 * Collection: cached_response_eodhistoricaldata
 */
const cachedResponseEodhdSchema = new mongoose.Schema(
  {
    // MD5 hash of endpoint + params (unique cache key)
    cacheKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // API endpoint name (e.g., "eod", "real-time", "fundamental")
    apiEndpoint: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Request parameters
    params: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Cached response data
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Expiration timestamp
    expiresAt: {
      type: Date,
      required: true,
      // Index created explicitly below (line 74) to avoid duplicate index warning
    },

    // Creation timestamp (when cache entry was created)
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    // Last update timestamp (when cache entry was updated)
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    // Collection name
    collection: "cached_response_eodhistoricaldata",

    // Disable automatic timestamps (we handle our own)
    timestamps: false,

    // Ensure indexes
    autoIndex: true,
  }
);

// Indexes for better query performance
cachedResponseEodhdSchema.index({ apiEndpoint: 1, createdAt: -1 }); // For endpoint-specific queries
cachedResponseEodhdSchema.index({ expiresAt: 1 }); // For expiration queries
cachedResponseEodhdSchema.index({ createdAt: -1 }); // For time-based queries

// Static methods for analytics
cachedResponseEodhdSchema.statics.getUsageStats = function (filters = {}) {
  const matchStage = {};

  // Apply filters
  if (filters.since) matchStage.createdAt = { $gte: filters.since };
  if (filters.until) {
    matchStage.createdAt = matchStage.createdAt || {};
    matchStage.createdAt.$lte = filters.until;
  }
  if (filters.endpoint) matchStage.apiEndpoint = filters.endpoint;

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        cachedRequests: { $sum: 1 }, // All entries are cached
        successfulRequests: { $sum: 1 }, // Cached entries are successful
        failedRequests: { $sum: 0 }, // No failed requests in cache
        totalResponseSize: {
          $sum: {
            $cond: [
              { $isArray: "$data" },
              { $size: "$data" },
              {
                $cond: [
                  { $eq: [{ $type: "$data" }, "object"] },
                  { $size: { $objectToArray: "$data" } },
                  0,
                ],
              },
            ],
          },
        },
        uniqueEndpoints: { $addToSet: "$apiEndpoint" },
      },
    },
    {
      $project: {
        _id: 0,
        totalRequests: 1,
        cachedRequests: 1,
        successfulRequests: 1,
        failedRequests: 1,
        cacheHitRate: {
          $cond: [
            { $gt: ["$totalRequests", 0] },
            { $multiply: [{ $divide: ["$cachedRequests", "$totalRequests"] }, 100] },
            0,
          ],
        },
        successRate: {
          $cond: [
            { $gt: ["$totalRequests", 0] },
            { $multiply: [{ $divide: ["$successfulRequests", "$totalRequests"] }, 100] },
            0,
          ],
        },
        avgResponseTime: { $literal: 0 }, // Not available in cache
        totalResponseSize: 1,
        uniqueEndpoints: { $size: "$uniqueEndpoints" },
      },
    },
  ]);
};

cachedResponseEodhdSchema.statics.getEndpointStats = function (filters = {}) {
  const matchStage = {};

  // Apply filters
  if (filters.since) matchStage.createdAt = { $gte: filters.since };
  if (filters.until) {
    matchStage.createdAt = matchStage.createdAt || {};
    matchStage.createdAt.$lte = filters.until;
  }
  if (filters.endpoint) matchStage.apiEndpoint = filters.endpoint;

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$apiEndpoint",
        totalRequests: { $sum: 1 },
        cachedRequests: { $sum: 1 }, // All entries are cached
        successfulRequests: { $sum: 1 }, // All cached entries are successful
        failedRequests: { $sum: 0 },
        totalResponseSize: {
          $sum: {
            $cond: [
              { $isArray: "$data" },
              { $size: "$data" },
              {
                $cond: [
                  { $eq: [{ $type: "$data" }, "object"] },
                  { $size: { $objectToArray: "$data" } },
                  0,
                ],
              },
            ],
          },
        },
        lastRequest: { $max: "$createdAt" },
      },
    },
    {
      $project: {
        endpoint: "$_id",
        _id: 0,
        totalRequests: 1,
        cachedRequests: 1,
        successfulRequests: 1,
        failedRequests: 1,
        cacheHitRate: {
          $cond: [
            { $gt: ["$totalRequests", 0] },
            { $multiply: [{ $divide: ["$cachedRequests", "$totalRequests"] }, 100] },
            100, // All are cached
          ],
        },
        successRate: {
          $cond: [
            { $gt: ["$totalRequests", 0] },
            { $multiply: [{ $divide: ["$successfulRequests", "$totalRequests"] }, 100] },
            100, // All are successful
          ],
        },
        avgResponseTime: { $round: [0, 2] }, // Not available, set to 0
        totalResponseSize: 1,
        lastRequest: 1,
      },
    },
    { $sort: { totalRequests: -1 } },
  ]);
};

cachedResponseEodhdSchema.statics.getRecentUsage = function (limit = 100, filters = {}) {
  const query = {};

  // Apply filters
  if (filters.endpoint) query.apiEndpoint = filters.endpoint;
  if (filters.since) query.createdAt = { $gte: filters.since };
  if (filters.until) {
    query.createdAt = query.createdAt || {};
    query.createdAt.$lte = filters.until;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("apiEndpoint cacheKey params createdAt updatedAt data")
    .lean();
};

// Create and export the model
export const CachedResponseEodhd = mongoose.model("CachedResponseEodhd", cachedResponseEodhdSchema);
export default CachedResponseEodhd;
