/**
 * Index Rules Configuration
 *
 * Defines all MongoDB indexes based on ACTUAL API query patterns and usage analysis.
 * These indexes are optimized for:
 * - Heatmap queries (sector/industry filtering, large-cap filtering, symbol lookups)
 * - Ranking queries (bulk symbol lookups with $in)
 * - Stocks queries (exchange_symbols unwinding and filtering)
 * - Job queries (name/status filtering, scheduledAt sorting)
 * - Metrics queries (symbol lookups, freshness checks)
 * - Distinct queries (sectors, industries)
 *
 * All indexes are based on real query patterns from API controllers.
 */

/**
 * Index rules for each collection
 * Format: { fields: { fieldName: direction }, options: { ... }, priority: number }
 * Priority: 1 = Critical (create first), 2 = High, 3 = Medium, 4 = Low
 *
 * @type {Object<string, Array<{fields: Object, options?: Object, priority?: number}>>}
 */
export const indexRules = {
  // Fundamentals collection - used heavily in heatmap and ranking queries
  fundamentals: [
    // CRITICAL: Primary lookup by symbol (unique) - used in ALL lookups
    {
      fields: { symbol: 1 },
      options: { unique: true },
      priority: 1,
    },

    // CRITICAL: Compound index for heatmap sector + market cap filtering
    // Query pattern: { 'fundamentals.General.Sector': 'X', 'fundamentals.Highlights.MarketCapitalization': { $gte: 1B } }
    // Used in: heatmapController.getHeatmapData() - most common query
    {
      fields: {
        "fundamentals.General.Sector": 1,
        "fundamentals.Highlights.MarketCapitalization": 1,
      },
      priority: 1,
    },

    // CRITICAL: Compound index for heatmap industry + market cap filtering
    // Query pattern: { 'fundamentals.General.Industry': 'X', 'fundamentals.Highlights.MarketCapitalization': { $gte: 1B } }
    // Used in: heatmapController.getHeatmapData()
    {
      fields: {
        "fundamentals.General.Industry": 1,
        "fundamentals.Highlights.MarketCapitalization": 1,
      },
      priority: 1,
    },

    // HIGH: Market cap filtering (single field for range queries)
    // Query pattern: { 'fundamentals.Highlights.MarketCapitalization': { $gte: 1B } }
    // Used in: heatmapController.getHeatmapData(), stocksController.getStockStats()
    {
      fields: { "fundamentals.Highlights.MarketCapitalization": 1 },
      priority: 2,
    },

    // HIGH: Sector filtering (single field for distinct queries)
    // Query pattern: distinct('fundamentals.General.Sector')
    // Used in: heatmapController.getAllSectors()
    {
      fields: { "fundamentals.General.Sector": 1 },
      priority: 2,
    },

    // HIGH: Industry filtering (single field for distinct queries)
    // Query pattern: distinct('fundamentals.General.Industry')
    // Used in: heatmapController.getAllIndustries()
    {
      fields: { "fundamentals.General.Industry": 1 },
      priority: 2,
    },

    // HIGH: Compound index for sector + industry filtering
    // Query pattern: { 'fundamentals.General.Sector': 'X', 'fundamentals.General.Industry': 'Y' }
    // Used in: heatmapController.getAllIndustries() with sector filter
    {
      fields: {
        "fundamentals.General.Sector": 1,
        "fundamentals.General.Industry": 1,
      },
      priority: 2,
    },

    // MEDIUM: Symbol + sector compound (for efficient lookups with sector context)
    // Query pattern: { symbol: 'X', 'fundamentals.General.Sector': 'Y' }
    {
      fields: { symbol: 1, "fundamentals.General.Sector": 1 },
      priority: 3,
    },

    // MEDIUM: Market filtering
    // Query pattern: { market: 'X' }
    {
      fields: { market: 1 },
      priority: 3,
    },

    // LOW: Data freshness queries (for maintenance/cleanup)
    {
      fields: { fetchedAt: -1 },
      priority: 4,
    },
    {
      fields: { updatedAt: -1 },
      priority: 4,
    },
  ],

  // Metrics collection - used in heatmap lookups and ranking queries
  metrics: [
    // CRITICAL: Primary lookup by symbol (unique) - used in ALL $lookup operations
    // Query pattern: { symbol: 'X' } or { symbol: { $in: [...] } }
    // Used in: heatmapController (lookup), rankingController (lookup), heatmapController (countDocuments with $in)
    {
      fields: { symbol: 1 },
      options: { unique: true },
      priority: 1,
    },

    // HIGH: Exchange filtering
    // Query pattern: { exchange: 'X' }
    {
      fields: { exchange: 1 },
      priority: 2,
    },

    // HIGH: Symbol with freshness (for recent data queries)
    // Query pattern: { symbol: 'X', lastUpdated: -1 }
    {
      fields: { symbol: 1, lastUpdated: -1 },
      priority: 2,
    },

    // MEDIUM: Exchange with freshness (for exchange-specific recent data)
    // Query pattern: { exchange: 'X', lastUpdated: -1 }
    {
      fields: { exchange: 1, lastUpdated: -1 },
      priority: 3,
    },

    // MEDIUM: Data freshness queries
    {
      fields: { lastUpdated: -1 },
      priority: 3,
    },
    {
      fields: { fetchedAt: -1 },
      priority: 3,
    },

    // MEDIUM: Metrics last calculated (for percentile calculations)
    // Query pattern: { 'metrics.lastCalculated': -1 }
    {
      fields: { "metrics.lastCalculated": -1 },
      priority: 3,
    },

    // LOW: Exchange + metrics last calculated
    {
      fields: { exchange: 1, "metrics.lastCalculated": -1 },
      priority: 4,
    },
  ],

  // ExchangeSymbols collection - critical for stocks API with $unwind operations
  // NOTE: After $unwind, queries filter on unwound fields, but indexes on array fields
  // can still help MongoDB optimize the unwind operation
  exchange_symbols: [
    // CRITICAL: Primary lookup by exchangeCode (unique)
    {
      fields: { exchangeCode: 1 },
      options: { unique: true },
      priority: 1,
    },

    // HIGH: Market cap filtering on symbols array (helps with $unwind + $match)
    // Query pattern: After $unwind, { 'symbols.cap': { $gte: 1B } }
    // Used in: stocksController.getLargeCapStocks(), stocksController.getStockStats()
    // Note: MongoDB can use this index to optimize $unwind operations
    {
      fields: { "symbols.cap": 1 },
      priority: 2,
    },

    // HIGH: Exchange filtering on symbols array
    // Query pattern: After $unwind, { 'symbols.Exchange': 'X' }
    // Used in: stocksController.getLargeCapStocks()
    {
      fields: { "symbols.Exchange": 1 },
      priority: 2,
    },

    // HIGH: Sector filtering on symbols array
    // Query pattern: After $unwind, { 'symbols.Sector': 'X' }
    // Used in: stocksController.getLargeCapStocks()
    {
      fields: { "symbols.Sector": 1 },
      priority: 2,
    },

    // HIGH: Industry filtering on symbols array
    // Query pattern: After $unwind, { 'symbols.Industry': 'X' }
    // Used in: stocksController.getLargeCapStocks()
    {
      fields: { "symbols.Industry": 1 },
      priority: 2,
    },

    // MEDIUM: Compound index for cap + exchange (common filter combination)
    // Query pattern: After $unwind, { 'symbols.cap': { $gte: 1B }, 'symbols.Exchange': 'X' }
    {
      fields: {
        "symbols.cap": 1,
        "symbols.Exchange": 1,
      },
      priority: 3,
    },

    // MEDIUM: Compound index for cap + sector
    {
      fields: {
        "symbols.cap": 1,
        "symbols.Sector": 1,
      },
      priority: 3,
    },

    // MEDIUM: Compound index for cap + industry
    {
      fields: {
        "symbols.cap": 1,
        "symbols.Industry": 1,
      },
      priority: 3,
    },

    // MEDIUM: Symbol code lookup (for finding symbols across exchanges)
    // Query pattern: After $unwind, { 'symbols.Code': 'X' }
    // Used in: stocksController (search functionality)
    {
      fields: { "symbols.Code": 1 },
      priority: 3,
    },

    // LOW: Country filtering
    {
      fields: { "symbols.Country": 1 },
      priority: 4,
    },

    // LOW: Symbol type filtering
    {
      fields: { "symbols.Type": 1 },
      priority: 4,
    },

    // LOW: Data freshness
    {
      fields: { fetchedAt: -1 },
      priority: 4,
    },
    {
      fields: { updatedAt: -1 },
      priority: 4,
    },
  ],

  // Jobs collection - used for job tracking and history
  jobs: [
    // CRITICAL: Job name filtering (most common query)
    // Query pattern: { name: 'X' }
    // Used in: jobsController.getAllJobs(), jobsController.getJobsByType()
    {
      fields: { name: 1 },
      priority: 1,
    },

    // HIGH: Status filtering
    // Query pattern: { status: 'X' }
    // Used in: jobsController.getAllJobs(), cycledListController
    {
      fields: { status: 1 },
      priority: 2,
    },

    // HIGH: Scheduled time sorting (most common sort)
    // Query pattern: sort({ scheduledAt: -1 })
    // Used in: jobsController.getAllJobs(), jobsController.getJobsByType()
    {
      fields: { scheduledAt: -1 },
      priority: 2,
    },

    // HIGH: Compound: name + scheduledAt (for job history queries)
    // Query pattern: { name: 'X' }, sort({ scheduledAt: -1 })
    // Used in: jobsController.getJobsByType()
    {
      fields: { name: 1, scheduledAt: -1 },
      priority: 2,
    },

    // HIGH: Compound: status + scheduledAt (for finding running/failed jobs)
    // Query pattern: { status: 'X' }, sort({ scheduledAt: -1 })
    {
      fields: { status: 1, scheduledAt: -1 },
      priority: 2,
    },

    // MEDIUM: Machine name filtering
    {
      fields: { machineName: 1 },
      priority: 3,
    },

    // LOW: Log timestamp queries
    {
      fields: { "logs.ts": -1 },
      priority: 4,
    },

    // LOW: Ended time for filtering completed/failed jobs
    {
      fields: { endedAt: -1 },
      priority: 4,
    },
  ],

  // Technicals collection - technical indicator data
  technicals: [
    // CRITICAL: Primary lookup by symbol (unique)
    {
      fields: { symbol: 1 },
      options: { unique: true },
      priority: 1,
    },

    // MEDIUM: Exchange filtering
    {
      fields: { exchange: 1 },
      priority: 3,
    },

    // MEDIUM: Symbol with freshness
    {
      fields: { symbol: 1, lastUpdated: -1 },
      priority: 3,
    },

    // LOW: Exchange with freshness
    {
      fields: { exchange: 1, lastUpdated: -1 },
      priority: 4,
    },

    // LOW: Data freshness queries
    {
      fields: { lastUpdated: -1 },
      priority: 4,
    },
    {
      fields: { fetchedAt: -1 },
      priority: 4,
    },
  ],

  // Dividends collection - dividend data
  dividends: [
    // CRITICAL: Primary lookup by symbol (unique)
    {
      fields: { symbol: 1 },
      options: { unique: true },
      priority: 1,
    },

    // MEDIUM: Exchange filtering
    {
      fields: { exchange: 1 },
      priority: 3,
    },

    // MEDIUM: Symbol with freshness
    {
      fields: { symbol: 1, lastUpdated: -1 },
      priority: 3,
    },

    // LOW: Exchange with freshness
    {
      fields: { exchange: 1, lastUpdated: -1 },
      priority: 4,
    },

    // LOW: Dividend history date queries
    {
      fields: { "history.date": -1 },
      priority: 4,
    },

    // LOW: Upcoming dividend date queries
    {
      fields: { "upcoming.date": 1 },
      priority: 4,
    },

    // LOW: Data freshness
    {
      fields: { lastUpdated: -1 },
      priority: 4,
    },
    {
      fields: { fetchedAt: -1 },
      priority: 4,
    },
  ],

  // Exchanges collection - exchange information
  exchanges: [
    // CRITICAL: Primary lookup by code (unique)
    {
      fields: { code: 1 },
      options: { unique: true },
      priority: 1,
    },

    // LOW: Country filtering
    {
      fields: { Country: 1 },
      priority: 4,
    },

    // LOW: Currency filtering
    {
      fields: { Currency: 1 },
      priority: 4,
    },

    // LOW: Data freshness
    {
      fields: { fetchedAt: -1 },
      priority: 4,
    },
    {
      fields: { updatedAt: -1 },
      priority: 4,
    },
  ],

  // CycledListStatus collection - cycled list system status
  cycled_list_status: [
    // CRITICAL: Primary lookup by name (unique)
    {
      fields: { name: 1 },
      options: { unique: true },
      priority: 1,
    },

    // HIGH: Last updated sorting (most common query)
    // Query pattern: findOne().sort({ lastUpdated: -1 })
    // Used in: cycledListController, jobsController.getJobsByType()
    {
      fields: { lastUpdated: -1 },
      priority: 2,
    },

    // MEDIUM: Overall status filtering
    {
      fields: { overallStatus: 1 },
      priority: 3,
    },

    // MEDIUM: Status + lastUpdated compound
    {
      fields: { overallStatus: 1, lastUpdated: -1 },
      priority: 3,
    },
  ],

  // CachedResponseEodhd collection - API response caching
  cached_response_eodhistoricaldata: [
    // CRITICAL: Cache key lookup (unique) - most common query
    {
      fields: { cacheKey: 1 },
      options: { unique: true },
      priority: 1,
    },

    // HIGH: API endpoint filtering
    // Query pattern: distinct('apiEndpoint', { ... })
    // Used in: eodhdUsageController.getUsageStats()
    {
      fields: { apiEndpoint: 1 },
      priority: 2,
    },

    // HIGH: Endpoint + createdAt (for endpoint-specific queries)
    // Query pattern: { apiEndpoint: 'X' }, sort({ createdAt: -1 })
    // Used in: eodhdUsageController.getUsageTrends()
    {
      fields: { apiEndpoint: 1, createdAt: -1 },
      priority: 2,
    },

    // MEDIUM: Expiration queries (TTL index candidate)
    {
      fields: { expiresAt: -1 },
      priority: 3,
    },

    // LOW: Time-based queries
    {
      fields: { createdAt: -1 },
      priority: 4,
    },
    {
      fields: { updatedAt: -1 },
      priority: 4,
    },
  ],
};

/**
 * Get index rules for a specific collection
 * @param {string} collectionName - Collection name
 * @returns {Array|undefined} Index rules for the collection
 */
export function getIndexRules(collectionName) {
  return indexRules[collectionName];
}

/**
 * Get all collection names that have index rules
 * @returns {string[]} Array of collection names
 */
export function getCollectionNames() {
  return Object.keys(indexRules);
}

/**
 * Get index rules sorted by priority (critical first)
 * @param {string} collectionName - Collection name
 * @returns {Array|undefined} Sorted index rules
 */
export function getIndexRulesByPriority(collectionName) {
  const rules = indexRules[collectionName];
  if (!rules) return undefined;

  return [...rules].sort((a, b) => {
    const priorityA = a.priority || 4; // Default to low priority
    const priorityB = b.priority || 4;
    return priorityA - priorityB;
  });
}
