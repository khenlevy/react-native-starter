import { getModel } from '@buydy/se-db';
import { LARGE_CAP_THRESHOLD } from '@buydy/se-db/src/utils/largeCapFilter.js';
import logger from '@buydy/se-logger';

/**
 * Get large cap stocks with filtering and search capabilities
 */
export const getLargeCapStocks = async (req, res) => {
  try {
    const {
      search,
      exchange,
      sector,
      industry,
      country,
      minCap,
      maxCap,
      hasFundamentals,
      hasDividends,
      hasTechnicals,
      sortBy = 'marketCap',
      sortOrder = 'desc',
      limit = 50,
      skip = 0,
    } = req.query;

    const ExchangeSymbols = getModel('exchange_symbols');

    // Build the base query for large cap stocks from exchange_symbols collection
    let query = {
      'symbols.cap': {
        $gte: LARGE_CAP_THRESHOLD,
      },
    };

    // Add filters for exchange_symbols collection
    if (exchange) {
      query['symbols.Exchange'] = new RegExp(exchange, 'i');
    }

    if (sector) {
      query['symbols.Sector'] = new RegExp(sector, 'i');
    }

    if (industry) {
      query['symbols.Industry'] = new RegExp(industry, 'i');
    }

    if (country) {
      query['symbols.Country'] = new RegExp(country, 'i');
    }

    if (minCap || maxCap) {
      const capFilter = {};
      if (minCap) capFilter.$gte = parseFloat(minCap);
      if (maxCap) capFilter.$lte = parseFloat(maxCap);
      query['symbols.cap'] = capFilter;
    }

    // Search functionality (symbol or company name)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { 'symbols.Code': searchRegex },
        { 'symbols.Name': searchRegex },
      ];
    }

    // Build sort object for aggregation pipeline
    const sort = {};
    if (sortBy === 'marketCap') {
      sort.marketCap = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'name') {
      sort.name = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'symbol') {
      sort.symbol = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    // Get models for lookups
    // const Fundamentals = getModel('fundamentals');
    // const Dividends = getModel('dividends');
    // const Technicals = getModel('technicals');

    // Use aggregation pipeline for exchange_symbols collection with lookups
    const pipeline = [
      { $unwind: '$symbols' },
      { $match: query },
      {
        $lookup: {
          from: 'fundamentals',
          let: { code: '$symbols.Code', exchange: '$symbols.Exchange' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$symbol', '$$code'] },
                    { $eq: ['$symbol', { $concat: ['$$code', '.US'] }] },
                    {
                      $eq: [
                        '$symbol',
                        { $concat: ['$$code', '.', '$$exchange'] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'fundamentalsData',
        },
      },
      {
        $lookup: {
          from: 'dividends',
          let: { code: '$symbols.Code', exchange: '$symbols.Exchange' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$symbol', '$$code'] },
                    { $eq: ['$symbol', { $concat: ['$$code', '.US'] }] },
                    {
                      $eq: [
                        '$symbol',
                        { $concat: ['$$code', '.', '$$exchange'] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'dividendsData',
        },
      },
      {
        $lookup: {
          from: 'technicals',
          let: { code: '$symbols.Code', exchange: '$symbols.Exchange' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$symbol', '$$code'] },
                    { $eq: ['$symbol', { $concat: ['$$code', '.US'] }] },
                    {
                      $eq: [
                        '$symbol',
                        { $concat: ['$$code', '.', '$$exchange'] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'technicalsData',
        },
      },
      {
        $addFields: {
          marketCap: '$symbols.cap',
          name: '$symbols.Name',
          exchange: '$symbols.Exchange',
          country: '$symbols.Country',
          sector: '$symbols.Sector',
          industry: '$symbols.Industry',
          currency: '$symbols.Currency',
          symbol: '$symbols.Code',
          hasFundamentals: { $gt: [{ $size: '$fundamentalsData' }, 0] },
          fundamentalsLastUpdate: {
            $arrayElemAt: ['$fundamentalsData.updatedAt', 0],
          },
          hasDividends: { $gt: [{ $size: '$dividendsData' }, 0] },
          dividendsLastUpdate: {
            $arrayElemAt: ['$dividendsData.lastUpdated', 0],
          },
          hasTechnicals: { $gt: [{ $size: '$technicalsData' }, 0] },
          technicalsLastUpdate: {
            $arrayElemAt: ['$technicalsData.lastUpdated', 0],
          },
        },
      },
      // Filter by data availability
      {
        $match: {
          ...(hasFundamentals !== undefined && {
            hasFundamentals: hasFundamentals === 'true',
          }),
          ...(hasDividends !== undefined && {
            hasDividends: hasDividends === 'true',
          }),
          ...(hasTechnicals !== undefined && {
            hasTechnicals: hasTechnicals === 'true',
          }),
        },
      },
      { $sort: sort },
      { $skip: parseInt(skip) },
      { $limit: parseInt(limit) },
      {
        $project: {
          id: '$_id',
          symbol: 1,
          name: { $ifNull: ['$name', 'N/A'] },
          code: '$symbol',
          exchange: { $ifNull: ['$exchange', 'N/A'] },
          country: { $ifNull: ['$country', 'N/A'] },
          sector: { $ifNull: ['$sector', 'N/A'] },
          industry: { $ifNull: ['$industry', 'N/A'] },
          currency: { $ifNull: ['$currency', 'USD'] },
          marketCap: { $ifNull: ['$marketCap', 0] },
          peRatio: null,
          pbRatio: null,
          dividendYield: null,
          roe: null,
          debtToEquity: null,
          revenue: null,
          profitMargin: null,
          eps: null,
          bookValue: null,
          price: null,
          hasFundamentals: 1,
          fundamentalsLastUpdate: 1,
          hasDividends: 1,
          dividendsLastUpdate: 1,
          hasTechnicals: 1,
          technicalsLastUpdate: 1,
          updatedAt: '$symbols.capLastSync',
          fetchedAt: '$symbols.capLastSync',
        },
      },
    ];

    // Execute aggregation pipeline
    const stocks = await ExchangeSymbols.aggregate(pipeline).allowDiskUse(true);

    // Get total count for pagination using a separate count pipeline
    const countPipeline = [
      { $unwind: '$symbols' },
      { $match: query },
      {
        $lookup: {
          from: 'fundamentals',
          let: { code: '$symbols.Code', exchange: '$symbols.Exchange' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$symbol', '$$code'] },
                    { $eq: ['$symbol', { $concat: ['$$code', '.US'] }] },
                    {
                      $eq: [
                        '$symbol',
                        { $concat: ['$$code', '.', '$$exchange'] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'fundamentalsData',
        },
      },
      {
        $lookup: {
          from: 'dividends',
          let: { code: '$symbols.Code', exchange: '$symbols.Exchange' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$symbol', '$$code'] },
                    { $eq: ['$symbol', { $concat: ['$$code', '.US'] }] },
                    {
                      $eq: [
                        '$symbol',
                        { $concat: ['$$code', '.', '$$exchange'] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'dividendsData',
        },
      },
      {
        $lookup: {
          from: 'technicals',
          let: { code: '$symbols.Code', exchange: '$symbols.Exchange' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$symbol', '$$code'] },
                    { $eq: ['$symbol', { $concat: ['$$code', '.US'] }] },
                    {
                      $eq: [
                        '$symbol',
                        { $concat: ['$$code', '.', '$$exchange'] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'technicalsData',
        },
      },
      {
        $addFields: {
          hasFundamentals: { $gt: [{ $size: '$fundamentalsData' }, 0] },
          hasDividends: { $gt: [{ $size: '$dividendsData' }, 0] },
          hasTechnicals: { $gt: [{ $size: '$technicalsData' }, 0] },
        },
      },
      // Filter by data availability
      {
        $match: {
          ...(hasFundamentals !== undefined && {
            hasFundamentals: hasFundamentals === 'true',
          }),
          ...(hasDividends !== undefined && {
            hasDividends: hasDividends === 'true',
          }),
          ...(hasTechnicals !== undefined && {
            hasTechnicals: hasTechnicals === 'true',
          }),
        },
      },
      { $count: 'total' },
    ];

    const countResult = await ExchangeSymbols.aggregate(
      countPipeline,
    ).allowDiskUse(true);
    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      data: {
        stocks: stocks,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          pages: Math.ceil(total / parseInt(limit)),
          currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
        },
      },
    });
  } catch (error) {
    logger.business('Error fetching large cap stocks', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch large cap stocks',
      details: error.message,
    });
  }
};

/**
 * Get filter options for large cap stocks
 */
export const getFilterOptions = async (req, res) => {
  try {
    const ExchangeSymbols = getModel('exchange_symbols');

    // Get unique values for each filter field from exchange_symbols collection
    const pipeline = [
      { $unwind: '$symbols' },
      {
        $match: {
          'symbols.cap': {
            $gte: LARGE_CAP_THRESHOLD,
          },
        },
      },
      {
        $group: {
          _id: null,
          exchanges: { $addToSet: '$symbols.Exchange' },
          sectors: { $addToSet: '$symbols.Sector' },
          industries: { $addToSet: '$symbols.Industry' },
          countries: { $addToSet: '$symbols.Country' },
          minMarketCap: { $min: '$symbols.cap' },
          maxMarketCap: { $max: '$symbols.cap' },
        },
      },
    ];

    const result = await ExchangeSymbols.aggregate(pipeline).allowDiskUse(true);
    const filterData = result[0] || {};

    // Clean up and sort the filter options
    const filterOptions = {
      exchanges: (filterData.exchanges || [])
        .filter(Boolean)
        .sort()
        .map((exchange) => ({ value: exchange, label: exchange })),
      sectors: (filterData.sectors || [])
        .filter(Boolean)
        .sort()
        .map((sector) => ({ value: sector, label: sector })),
      industries: (filterData.industries || [])
        .filter(Boolean)
        .sort()
        .map((industry) => ({ value: industry, label: industry })),
      countries: (filterData.countries || [])
        .filter(Boolean)
        .sort()
        .map((country) => ({ value: country, label: country })),
      marketCapRange: {
        min: filterData.minMarketCap || LARGE_CAP_THRESHOLD,
        max: filterData.maxMarketCap || LARGE_CAP_THRESHOLD * 100,
      },
    };

    res.json({
      success: true,
      data: filterOptions,
    });
  } catch (error) {
    logger.business('Error fetching filter options', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter options',
      details: error.message,
    });
  }
};

/**
 * Get stock autocomplete suggestions
 */
export const getStockAutocomplete = async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
        },
      });
    }

    const ExchangeSymbols = getModel('exchange_symbols');

    // Search for stocks matching the query using aggregation for better performance
    const searchRegex = new RegExp(query, 'i');
    const pipeline = [
      { $unwind: '$symbols' },
      {
        $match: {
          'symbols.cap': {
            $gte: LARGE_CAP_THRESHOLD,
          },
          $or: [
            { 'symbols.Code': searchRegex },
            { 'symbols.Name': searchRegex },
          ],
        },
      },
      {
        $project: {
          symbol: '$symbols.Code',
          name: '$symbols.Name',
          code: '$symbols.Code',
          exchange: '$symbols.Exchange',
          marketCap: '$symbols.cap',
        },
      },
      { $limit: 10 },
    ];

    const stocks = await ExchangeSymbols.aggregate(pipeline).allowDiskUse(true);

    // Transform to autocomplete format
    const suggestions = stocks.map((stock) => {
      return {
        id: stock._id,
        symbol: stock.symbol,
        name: stock.name || 'N/A',
        code: stock.code || stock.symbol.split('.')[0],
        exchange: stock.exchange || 'N/A',
        marketCap: stock.marketCap || 0,
        displayText: `${stock.code || stock.symbol.split('.')[0]} - ${
          stock.name || 'N/A'
        } (${stock.exchange || 'N/A'})`,
      };
    });

    res.json({
      success: true,
      data: {
        suggestions,
      },
    });
  } catch (error) {
    logger.business('Error fetching autocomplete suggestions', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch autocomplete suggestions',
      details: error.message,
    });
  }
};

/**
 * Get available sectors for filtering
 */
export const getSectors = async (req, res) => {
  try {
    const ExchangeSymbols = getModel('exchange_symbols');

    const pipeline = [
      { $unwind: '$symbols' },
      {
        $match: {
          'symbols.cap': {
            $gte: LARGE_CAP_THRESHOLD,
          },
          'symbols.Sector': { $exists: true, $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: '$symbols.Sector',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          sector: '$_id',
          count: 1,
        },
      },
      { $sort: { sector: 1 } },
    ];

    const sectors = await ExchangeSymbols.aggregate(pipeline);

    res.json({
      success: true,
      data: sectors,
    });
  } catch (error) {
    logger.business('Error fetching sectors', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sectors',
      details: error.message,
    });
  }
};

/**
 * Get available industries for filtering
 */
export const getIndustries = async (req, res) => {
  try {
    const ExchangeSymbols = getModel('exchange_symbols');

    const pipeline = [
      { $unwind: '$symbols' },
      {
        $match: {
          'symbols.cap': {
            $gte: LARGE_CAP_THRESHOLD,
          },
          'symbols.Industry': { $exists: true, $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: '$symbols.Industry',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          industry: '$_id',
          count: 1,
        },
      },
      { $sort: { industry: 1 } },
    ];

    const industries = await ExchangeSymbols.aggregate(pipeline);

    res.json({
      success: true,
      data: industries,
    });
  } catch (error) {
    logger.business('Error fetching industries', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch industries',
      details: error.message,
    });
  }
};

/**
 * Get stock statistics
 */
export const getStockStats = async (req, res) => {
  try {
    // Get models for direct counting
    const ExchangeSymbols = getModel('exchange_symbols');
    const Fundamentals = getModel('fundamentals');
    const Dividends = getModel('dividends');
    const Technicals = getModel('technicals');

    // Count total large cap stocks
    const totalStocksPipeline = [
      { $unwind: '$symbols' },
      {
        $match: {
          'symbols.cap': {
            $gte: LARGE_CAP_THRESHOLD,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalStocks: { $sum: 1 },
          totalMarketCap: { $sum: '$symbols.cap' },
          avgMarketCap: { $avg: '$symbols.cap' },
        },
      },
    ];

    const stocksResult = await ExchangeSymbols.aggregate(totalStocksPipeline);
    const stocksStats = stocksResult[0] || {};

    // Get actual counts from each collection
    const [totalFundamentals, totalDividends, totalTechnicals] =
      await Promise.all([
        Fundamentals.countDocuments(),
        Dividends.countDocuments(),
        Technicals.countDocuments(),
      ]);

    res.json({
      success: true,
      data: {
        totalStocks: stocksStats.totalStocks || 0,
        totalFundamentals: totalFundamentals,
        totalDividends: totalDividends,
        totalTechnicals: totalTechnicals,
        totalMarketCap: stocksStats.totalMarketCap || 0,
        avgMarketCap: stocksStats.avgMarketCap || 0,
      },
    });
  } catch (error) {
    logger.business('Error fetching stock statistics', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stock statistics',
      details: error.message,
    });
  }
};
