import { getModel } from '@buydy/se-db';
import {
  getMetricsForAPI,
  getDefaultMetricsForAPI,
  validateMetrics,
  getMetricsMapByType,
} from '@buydy/iso-business-types';
import logger from '@buydy/se-logger';

/**
 * Heatmap Controller
 *
 * Provides API endpoints for metrics heat map visualization.
 * Supports sector, industry, and company-level aggregations with percentile data.
 */

/**
 * GET /api/metrics/heatmap
 *
 * Fetch companies with their percentiles for heat map visualization
 */
export async function getHeatmapData(req, res) {
  try {
    // Get default metrics from shared utilities - single source of truth
    const defaultMetrics = getDefaultMetricsForAPI();

    const {
      groupBy = 'sector', // 'sector' | 'industry' | 'company'
      groupName, // optional: specific sector/industry name
      metrics = defaultMetrics, // Use enum metrics as default
      limit = 50,
      offset = 0,
      onlyComplete = 'false', // 'true' | 'false' - only show companies with all selected metrics
    } = req.query;

    // Parse onlyComplete as boolean
    const showOnlyComplete = onlyComplete === 'true' || onlyComplete === true;

    // Parse metrics array if it's a string
    const rawMetricsArray =
      typeof metrics === 'string'
        ? metrics.split(',')
        : Array.isArray(metrics)
        ? metrics
        : defaultMetrics;

    const metricsArray = rawMetricsArray
      .map((metric) => (typeof metric === 'string' ? metric.trim() : metric))
      .filter(Boolean);

    // Validate requested metrics against enum
    const validation = validateMetrics(metricsArray);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid metrics requested',
        invalidMetrics: validation.invalid,
        availableMetrics: defaultMetrics,
      });
    }

    const metricsMap = getMetricsMapByType();
    const resolvedMetrics = metricsArray.map((metricKey) => {
      const metricDefinition = metricsMap[metricKey];
      const dbField = metricDefinition?.dbField || metricKey;

      return {
        requestKey: metricKey,
        definition: metricDefinition,
        dbField,
        pathSegments: dbField.split('.'),
      };
    });

    logger.business(
      `[Heatmap] Request → groupBy=${groupBy}, groupName=${
        groupName || 'All'
      }, metrics=${metricsArray.join(
        ', ',
      )}, onlyComplete=${showOnlyComplete}, limit=${limit}, offset=${offset}`,
    );

    const buildFieldExpression = (rootField, pathSegments) =>
      pathSegments.reduce(
        (expr, segment) => ({
          $getField: {
            field: segment,
            input: {
              $ifNull: [expr, {}],
            },
          },
        }),
        `$${rootField}`,
      );

    const buildExistsCondition = (rootField, pathSegments) => ({
      $ne: [
        {
          $ifNull: [buildFieldExpression(rootField, pathSegments), null],
        },
        null,
      ],
    });

    const metricsAvailabilityConditions = resolvedMetrics.map((metric) =>
      buildExistsCondition('metricsDoc', metric.pathSegments),
    );

    const completenessConditions = resolvedMetrics.map((metric) => ({
      $and: [
        buildExistsCondition('metricsDoc', metric.pathSegments),
        buildExistsCondition('percentilesDoc', metric.pathSegments),
      ],
    }));

    const createMetricsExistenceMatchStage = () => {
      // Only filter by metrics existence when showOnlyComplete is true
      // When false, we want to show ALL companies even without metrics
      if (!showOnlyComplete) {
        return null;
      }

      const stage = {
        $match: {
          'metricsData.0': { $exists: true },
        },
      };

      if (metricsAvailabilityConditions.length > 0) {
        stage.$match.$expr = {
          $or: metricsAvailabilityConditions,
        };
      }

      return stage;
    };

    const createCompletenessMatchStage = () =>
      showOnlyComplete && completenessConditions.length > 0
        ? {
            $match: {
              $expr: {
                $and: completenessConditions,
              },
            },
          }
        : null;

    const metricsExistenceMatchStage = createMetricsExistenceMatchStage();
    const completenessMatchStage = createCompletenessMatchStage();

    // Validate groupBy parameter
    if (!['sector', 'industry', 'company'].includes(groupBy)) {
      return res.status(400).json({
        error:
          "Invalid groupBy parameter. Must be 'sector', 'industry', or 'company'",
      });
    }

    const Fundamentals = getModel('fundamentals');
    // const Metrics = getModel('metrics');

    let companiesData = [];
    let totalCount = 0;

    // Build match query for fundamentals based on groupBy
    const fundamentalsMatch = {};

    if (groupBy === 'sector' && groupName) {
      if (groupName === 'Unknown') {
        // Query for companies with missing or empty sector
        fundamentalsMatch['$or'] = [
          { 'fundamentals.General.Sector': { $exists: false } },
          { 'fundamentals.General.Sector': null },
          { 'fundamentals.General.Sector': '' },
        ];
      } else {
        fundamentalsMatch['fundamentals.General.Sector'] = groupName;
      }
    } else if (groupBy === 'industry' && groupName) {
      if (groupName === 'Unknown') {
        // Query for companies with missing or empty industry
        fundamentalsMatch['$or'] = [
          { 'fundamentals.General.Industry': { $exists: false } },
          { 'fundamentals.General.Industry': null },
          { 'fundamentals.General.Industry': '' },
        ];
      } else {
        fundamentalsMatch['fundamentals.General.Industry'] = groupName;
      }
    }

    const percentilesField = groupBy === 'industry' ? 'industry' : 'sector';

    // Get the first metrics document from the lookup result
    // $metricsData is an array of metrics documents, each with a 'metrics' field
    const firstMetricsDoc = { $arrayElemAt: ['$metricsData', 0] };
    const metricsSourceExpression = {
      $ifNull: [
        {
          $getField: {
            field: 'metrics',
            input: firstMetricsDoc,
          },
        },
        {},
      ],
    };

    const metricsDocStage = {
      $addFields: {
        metricsDoc: metricsSourceExpression,
        percentilesDoc: {
          $ifNull: [
            {
              $getField: {
                field: percentilesField,
                input: {
                  $ifNull: [
                    {
                      $getField: {
                        field: 'percentiles',
                        input: metricsSourceExpression,
                      },
                    },
                    {},
                  ],
                },
              },
            },
            {},
          ],
        },
      },
    };

    // Use aggregation to join with metrics, filtering by large-cap directly from fundamentals
    // OPTIMIZED: Filter by MarketCapitalization directly in fundamentals (no expensive $lookup needed)
    // Market cap is stored in fundamentals.Highlights.MarketCapitalization from EODHD API
    const buildPipeline = (requireCompleteness = false) => {
      const pipelineStages = [
        {
          $match: {
            ...(Object.keys(fundamentalsMatch).length > 0
              ? fundamentalsMatch
              : {}),
            'fundamentals.Highlights.MarketCapitalization': {
              $gte: 1000000000,
            },
          },
        },
        {
          $lookup: {
            from: 'metrics',
            localField: 'symbol',
            foreignField: 'symbol',
            as: 'metricsData',
          },
        },
        metricsDocStage,
      ];

      // Only apply metrics existence filter when requireCompleteness is true
      // When false, show all companies regardless of metrics
      if (metricsExistenceMatchStage) {
        pipelineStages.push(metricsExistenceMatchStage);
      }

      if (requireCompleteness && completenessMatchStage) {
        pipelineStages.push(completenessMatchStage);
      }

      pipelineStages.push(
        {
          $project: {
            symbol: 1,
            sector: '$fundamentals.General.Sector',
            industry: '$fundamentals.General.Industry',
            metrics: '$metricsDoc',
          },
        },
        { $skip: parseInt(offset) },
        { $limit: parseInt(limit) },
      );

      return pipelineStages;
    };

    const buildCountPipeline = (requireCompleteness = false) => {
      const stages = [
        {
          $match: {
            ...(Object.keys(fundamentalsMatch).length > 0
              ? fundamentalsMatch
              : {}),
            'fundamentals.Highlights.MarketCapitalization': {
              $gte: 1000000000,
            },
          },
        },
        {
          $lookup: {
            from: 'metrics',
            localField: 'symbol',
            foreignField: 'symbol',
            as: 'metricsData',
          },
        },
        metricsDocStage,
      ];

      // Only apply metrics existence filter when requireCompleteness is true
      // When false, show all companies regardless of metrics
      // Use the same stages as the main pipeline
      if (metricsExistenceMatchStage) {
        stages.push(metricsExistenceMatchStage);
      }

      if (requireCompleteness && completenessMatchStage) {
        stages.push(completenessMatchStage);
      }

      stages.push({ $count: 'total' });
      return stages;
    };

    let companies = await Fundamentals.aggregate(
      buildPipeline(showOnlyComplete),
    );

    const countResult = await Fundamentals.aggregate(
      buildCountPipeline(showOnlyComplete),
    );
    totalCount = countResult.length > 0 ? countResult[0].total : 0;

    let completenessFallback = false;
    if (showOnlyComplete && totalCount === 0) {
      logger.business(
        `[Heatmap] Completeness filter removed all companies (metrics=${metricsArray.join(
          ', ',
        )}). Falling back to partial results.`,
      );
      companies = await Fundamentals.aggregate(buildPipeline(false));
      const fallbackCountResult = await Fundamentals.aggregate(
        buildCountPipeline(false),
      );
      totalCount =
        fallbackCountResult.length > 0 ? fallbackCountResult[0].total : 0;
      completenessFallback = true;
    }

    // Build response from aggregation results
    const getNestedValue = (source, pathSegments) =>
      pathSegments.reduce((acc, key) => {
        if (acc === null || acc === undefined) {
          return undefined;
        }
        return acc[key];
      }, source);

    companiesData = companies.map((company) => {
      const percentiles = {};
      const rawValues = {};

      // Extract percentiles based on groupBy
      const percentileSource =
        groupBy === 'industry'
          ? company.metrics?.percentiles?.industry
          : company.metrics?.percentiles?.sector;

      resolvedMetrics.forEach((metric) => {
        const percentileValue = getNestedValue(
          percentileSource,
          metric.pathSegments,
        );
        const rawValue = getNestedValue(company.metrics, metric.pathSegments);

        percentiles[metric.requestKey] =
          percentileValue !== undefined ? percentileValue : null;
        rawValues[metric.requestKey] = rawValue !== undefined ? rawValue : null;
      });

      return {
        symbol: company.symbol,
        sector: company.sector || 'Unknown',
        industry: company.industry || 'Unknown',
        percentiles,
        raw: rawValues,
      };
    });

    logger.business(
      `[Heatmap] Response → companies=${companies.length}, total=${totalCount}, completenessFallback=${completenessFallback}`,
    );

    res.json({
      group: groupName || 'All',
      groupBy,
      metrics: metricsArray,
      companies: companiesData,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalCount,
      },
      completenessFallback,
    });
  } catch (error) {
    logger.business('Error fetching heatmap data', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch heatmap data',
      message: error.message,
    });
  }
}

/**
 * GET /api/metrics/sectors
 *
 * Get list of all available sectors
 */
export async function getAllSectors(req, res) {
  try {
    const Fundamentals = getModel('fundamentals');
    const Metrics = getModel('metrics');

    const sectors = await Fundamentals.distinct('fundamentals.General.Sector');

    // Filter out null/empty values but keep 'Unknown'
    const validSectors = sectors.filter((s) => s && s.trim() !== '').sort();

    // Check if there are any companies with missing sector that have metrics
    const companiesWithoutSector = await Fundamentals.countDocuments({
      $or: [
        { 'fundamentals.General.Sector': { $exists: false } },
        { 'fundamentals.General.Sector': null },
        { 'fundamentals.General.Sector': '' },
      ],
    });

    // If there are companies without sector data, check if any have metrics
    if (companiesWithoutSector > 0) {
      const companiesWithoutSectorData = await Fundamentals.find({
        $or: [
          { 'fundamentals.General.Sector': { $exists: false } },
          { 'fundamentals.General.Sector': null },
          { 'fundamentals.General.Sector': '' },
        ],
      }).select('symbol');

      const symbolsWithoutSector = companiesWithoutSectorData.map(
        (c) => c.symbol,
      );

      // Check if any of these symbols have metrics
      const metricsCount = await Metrics.countDocuments({
        symbol: { $in: symbolsWithoutSector },
      });

      // Only add "Unknown" if there are companies with metrics but missing sector
      if (metricsCount > 0 && !validSectors.includes('Unknown')) {
        validSectors.push('Unknown');
        validSectors.sort();
      }
    }

    res.json({ sectors: validSectors });
  } catch (error) {
    logger.business('Error fetching sectors', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch sectors',
      message: error.message,
    });
  }
}

/**
 * GET /api/metrics/industries
 *
 * Get list of all available industries (optionally filtered by sector)
 */
export async function getAllIndustries(req, res) {
  try {
    const { sector } = req.query;
    const Fundamentals = getModel('fundamentals');
    const Metrics = getModel('metrics');

    let industries;

    if (sector) {
      // Get industries for specific sector
      const sectorQuery =
        sector === 'Unknown'
          ? {
              $or: [
                { 'fundamentals.General.Sector': { $exists: false } },
                { 'fundamentals.General.Sector': null },
                { 'fundamentals.General.Sector': '' },
              ],
            }
          : { 'fundamentals.General.Sector': sector };

      const companies = await Fundamentals.find(sectorQuery).select(
        'fundamentals.General.Industry symbol',
      );

      // Get unique industries, keeping 'Unknown' for missing values
      const industriesSet = new Set();
      const symbolsWithoutIndustry = [];

      companies.forEach((c) => {
        const industry = c.fundamentals?.General?.Industry;
        if (industry && industry.trim() !== '') {
          industriesSet.add(industry);
        } else {
          symbolsWithoutIndustry.push(c.symbol);
        }
      });

      industries = Array.from(industriesSet).sort();

      // Check if companies without industry have metrics
      if (symbolsWithoutIndustry.length > 0) {
        const metricsCount = await Metrics.countDocuments({
          symbol: { $in: symbolsWithoutIndustry },
        });

        if (metricsCount > 0 && !industries.includes('Unknown')) {
          industries.push('Unknown');
          industries.sort();
        }
      }
    } else {
      // Get all industries
      industries = await Fundamentals.distinct('fundamentals.General.Industry');
      industries = industries.filter((i) => i && i.trim() !== '').sort();

      // Check if there are any companies with missing industry that have metrics
      const companiesWithoutIndustry = await Fundamentals.find({
        $or: [
          { 'fundamentals.General.Industry': { $exists: false } },
          { 'fundamentals.General.Industry': null },
          { 'fundamentals.General.Industry': '' },
        ],
      }).select('symbol');

      const symbolsWithoutIndustry = companiesWithoutIndustry.map(
        (c) => c.symbol,
      );

      if (symbolsWithoutIndustry.length > 0) {
        const metricsCount = await Metrics.countDocuments({
          symbol: { $in: symbolsWithoutIndustry },
        });

        // Only add "Unknown" if there are companies with metrics but missing industry
        if (metricsCount > 0 && !industries.includes('Unknown')) {
          industries.push('Unknown');
          industries.sort();
        }
      }
    }

    res.json({ industries });
  } catch (error) {
    logger.business('Error fetching industries', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch industries',
      message: error.message,
    });
  }
}

/**
 * GET /api/metrics/available
 *
 * Get list of all available metrics for heatmap from ISO business enum
 */
export async function getAvailableMetrics(req, res) {
  try {
    // Get metrics from ISO business enum - single source of truth
    const metrics = getMetricsForAPI();

    res.json({ metrics });
  } catch (error) {
    logger.business('Error fetching available metrics', {
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch available metrics',
      message: error.message,
    });
  }
}
