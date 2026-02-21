// Heatmap Service
// API calls for metrics heatmap visualization

const API_BASE_URL = 'http://localhost:3001/api/v1';

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Fetch heatmap data
 */
export async function fetchHeatmapData({
  groupBy = 'sector',
  groupName,
  metrics = [
    'DividendYieldCurrent',
    'DividendGrowth5Y',
    'DebtToEquityCurrent',
    'EBITDAGrowth1Y',
  ],
  limit = 50,
  offset = 0,
  onlyComplete = false,
}) {
  try {
    const params = new URLSearchParams({
      groupBy,
      metrics: Array.isArray(metrics) ? metrics.join(',') : metrics,
      limit: limit.toString(),
      offset: offset.toString(),
      onlyComplete: onlyComplete.toString(),
    });

    if (groupName) {
      params.append('groupName', groupName);
    }

    const endpoint = `/metrics/heatmap?${params.toString()}`;
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    throw error;
  }
}

/**
 * Calculate ranking for companies based on selected method (weighted average or geometric mean)
 * Accepts symbols array, groupBy parameter, and ranking method
 * Returns top 30 companies with symbol and score
 */
export async function calculateRanking(
  symbols,
  metrics,
  groupBy = 'sector',
  weights = null,
  priceRangeFilters = null,
  method = 'weighted',
) {
  try {
    return await apiRequest('/ranking/calculate', {
      method: 'POST',
      body: JSON.stringify({
        symbols,
        metrics,
        groupBy,
        weights,
        priceRangeFilters,
        method,
      }),
    });
  } catch (error) {
    console.error('Error calculating ranking:', error);
    throw error;
  }
}

/**
 * Fetch all sectors
 */
export async function fetchSectors() {
  try {
    const response = await apiRequest('/metrics/heatmap/sectors');
    return response.sectors;
  } catch (error) {
    console.error('Error fetching sectors:', error);
    throw error;
  }
}

/**
 * Fetch industries (optionally filtered by sector)
 */
export async function fetchIndustries(sector) {
  try {
    const params = sector ? `?sector=${encodeURIComponent(sector)}` : '';
    const response = await apiRequest(`/metrics/heatmap/industries${params}`);
    return response.industries;
  } catch (error) {
    console.error('Error fetching industries:', error);
    throw error;
  }
}

/**
 * Fetch available metrics
 */
export async function fetchAvailableMetrics() {
  try {
    const response = await apiRequest('/metrics/heatmap/available');
    return response.metrics;
  } catch (error) {
    console.error('Error fetching available metrics:', error);
    throw error;
  }
}

/**
 * Filter stocks by price range criteria
 */
export async function filterStocksByPriceRange(symbols, filters) {
  try {
    return await apiRequest('/metrics/heatmap/price-range/filter', {
      method: 'POST',
      body: JSON.stringify({
        symbols,
        filters,
      }),
    });
  } catch (error) {
    console.error('Error filtering stocks by price range:', error);
    throw error;
  }
}

/**
 * Get price range position for a specific symbol and period
 */
export async function getSymbolPricePosition(symbol, period) {
  try {
    const endpoint = `/metrics/heatmap/price-range/position/${symbol}?period=${period}`;
    return await apiRequest(endpoint);
  } catch (error) {
    console.error('Error getting symbol price position:', error);
    throw error;
  }
}

/**
 * Export heatmap data to CSV
 */
export function exportToCSV(companies, metrics, availableMetrics = []) {
  // Helper to format CSV value
  const formatCSVValue = (value) => {
    if (value === null || value === undefined || value === '') return '';
    // Escape values that contain commas or quotes
    const strValue = String(value);
    if (
      strValue.includes(',') ||
      strValue.includes('"') ||
      strValue.includes('\n')
    ) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
  };

  // CSV header
  const headers = [
    'Symbol',
    'Sector',
    'Industry',
    ...metrics.map((m) => `${m} (Percentile)`),
    ...metrics.map((m) => `${m} (Raw)`),
  ];

  // CSV rows
  const metricMetaByKey = new Map(
    Array.isArray(availableMetrics)
      ? availableMetrics.map((metric) => [metric.key, metric])
      : [],
  );

  const shouldInvertForMetric = (metricKey) => {
    const metric = metricMetaByKey.get(metricKey);
    return metric && ['debt', 'leverage'].includes(metric.category);
  };

  const transformPercentileForExport = (metricKey, percentile) => {
    if (percentile === null || percentile === undefined) return percentile;
    if (shouldInvertForMetric(metricKey)) {
      const transformed = 1 - percentile;
      return Math.max(0, Math.min(1, transformed));
    }
    return percentile;
  };

  const rows = companies.map((company) => {
    const percentileValues = metrics.map((m) => {
      const val = transformPercentileForExport(m, company.percentiles[m]);
      return val !== null && val !== undefined ? (val * 100).toFixed(2) : '';
    });

    const rawValues = metrics.map((m) => {
      const val = company.raw[m];
      return val !== null && val !== undefined ? val : '';
    });

    return [
      formatCSVValue(company.symbol),
      formatCSVValue(company.sector),
      formatCSVValue(company.industry),
      ...percentileValues.map(formatCSVValue),
      ...rawValues.map(formatCSVValue),
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.map(formatCSVValue).join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `heatmap_${new Date().toISOString().split('T')[0]}.csv`,
  );
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
