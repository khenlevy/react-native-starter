import { Table } from '@buydy/cl-table';
import { Button } from '@buydy/cl-button';
import TopCompaniesTable from '../components/TopCompaniesTable';

const HeatMapContent = ({
  // Data
  heatmapData,
  displayCompanies,
  topCompanies,
  optimizationMethodName,
  selectedMetrics,
  availableMetrics,
  selectedGroupBy,

  // States
  loading,
  isFiltering,
  error,

  // Callbacks
  onExportCSV,
  getPercentileColor,
  getTextColorForBg,
  formatMetricValue,
}) => {
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4 m-6">
        {error}
      </div>
    );
  }

  if (loading && !heatmapData) {
    return (
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center space-y-8">
          {/* Impressive multi-ring spinner */}
          <div className="relative">
            {/* Outer ring - slow rotation */}
            <svg
              className="animate-spin h-[120px] w-[120px] text-blue-500"
              style={{ animationDuration: '3s' }}
              fill="none"
              viewBox="0 0 120 120"
            >
              <circle
                className="opacity-20"
                cx="60"
                cy="60"
                r="50"
                stroke="currentColor"
                strokeWidth="6"
              ></circle>
              <path
                className="opacity-60"
                fill="currentColor"
                d="M60 10 A50 50 0 0 1 110 60 L60 60 Z"
              ></path>
            </svg>

            {/* Middle ring - medium rotation */}
            <svg
              className="animate-spin h-[90px] w-[90px] text-blue-400 absolute top-[15px] left-[15px]"
              style={{ animationDuration: '2s', animationDirection: 'reverse' }}
              fill="none"
              viewBox="0 0 90 90"
            >
              <circle
                className="opacity-30"
                cx="45"
                cy="45"
                r="38"
                stroke="currentColor"
                strokeWidth="5"
              ></circle>
              <path
                className="opacity-70"
                fill="currentColor"
                d="M45 7 A38 38 0 0 1 83 45 L45 45 Z"
              ></path>
            </svg>

            {/* Inner ring - fast rotation */}
            <svg
              className="animate-spin h-[60px] w-[60px] text-blue-300 absolute top-[30px] left-[30px]"
              style={{ animationDuration: '1s' }}
              fill="none"
              viewBox="0 0 60 60"
            >
              <circle
                className="opacity-40"
                cx="30"
                cy="30"
                r="25"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-80"
                fill="currentColor"
                d="M30 5 A25 25 0 0 1 55 30 L30 30 Z"
              ></path>
            </svg>

            {/* Center pulsing dot */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="h-4 w-4 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </div>

          {/* Loading text with animation */}
          <div className="text-center">
            <span className="text-5xl font-semibold bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-blue-300 dark:to-blue-500 animate-pulse">
              Loading heatmap data...
            </span>
            <div className="mt-4 flex justify-center space-x-2">
              <div
                className="h-2 w-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: '0s' }}
              ></div>
              <div
                className="h-2 w-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              ></div>
              <div
                className="h-2 w-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: '0.4s' }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!heatmapData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-6xl mb-4">📊</div>
          <div className="text-xl">
            Select filters and click &ldquo;Load Heatmap&rdquo; to view data
          </div>
        </div>
      </div>
    );
  }

  const companiesToDisplay = Array.isArray(displayCompanies)
    ? displayCompanies
    : heatmapData.companies;

  const metricMetaByKey = new Map(
    Array.isArray(availableMetrics)
      ? availableMetrics.map((metric) => [metric.key, metric])
      : [],
  );

  const shouldInvertForMetric = (metricKey) => {
    const metric = metricMetaByKey.get(metricKey);
    return metric && ['debt', 'leverage'].includes(metric.category);
  };

  const transformPercentileForDisplay = (metricKey, percentile) => {
    if (percentile === null || percentile === undefined) return percentile;
    if (shouldInvertForMetric(metricKey)) {
      const transformed = 1 - percentile;
      return Math.max(0, Math.min(1, transformed));
    }
    return percentile;
  };

  const getPercentileTooltipLabel = (metricKey) => {
    if (shouldInvertForMetric(metricKey)) {
      return 'Percentile (higher = better)';
    }
    return 'Percentile';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Companies Table */}
      <div className="flex-shrink-0">
        <TopCompaniesTable
          topCompanies={topCompanies}
          optimizationMethodName={optimizationMethodName}
        />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center flex-shrink-0 px-6">
        <div className="flex items-center space-x-3">
          {/* Loading Icon - Left of header */}
          {(loading || isFiltering) && (
            <div className="flex items-center space-x-2 text-blue-600 dark:text-accent-dark">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold dark:text-white">
              {companiesToDisplay.length} Companies
            </h3>
          </div>
        </div>
        <Button onClick={onExportCSV} variant="secondary">
          📥 Export CSV
        </Button>
      </div>

      {/* Heatmap Table */}
      <div className="flex-1 overflow-auto p-6 relative">
        {isFiltering && (
          <div className="absolute inset-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-30">
            <div className="flex flex-col items-center space-y-3 text-blue-600 dark:text-accent-dark">
              <svg
                className="animate-spin h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Updating price filtered results...
              </span>
            </div>
          </div>
        )}
        <Table
          columns={[
            {
              key: 'symbol',
              label: 'Symbol',
              align: 'left',
            },
            {
              key: 'group',
              label: selectedGroupBy === 'sector' ? 'Sector' : 'Industry',
              align: 'left',
            },
            ...selectedMetrics.map((metricKey) => {
              const metric = availableMetrics.find((m) => m.key === metricKey);
              return {
                key: metricKey,
                label: metric?.label,
                align: 'center',
                render: (value, row) => {
                  if (value === null || value === undefined) return '-';
                  const rawPercentile = row.percentiles?.[metricKey];
                  const metricInverted = shouldInvertForMetric(metricKey);
                  const rawSuffix =
                    metricInverted &&
                    rawPercentile !== null &&
                    rawPercentile !== undefined
                      ? rawPercentile
                      : null;

                  return (
                    <span className="inline-flex items-baseline gap-1">
                      <span>{`${(value * 100).toFixed(0)}%`}</span>
                      {rawSuffix !== null && (
                        <span className="text-[11px] opacity-80">
                          {`(${(rawSuffix * 100).toFixed(0)}%)`}
                        </span>
                      )}
                    </span>
                  );
                },
                getTooltip: (row) => {
                  const percentile = row.percentiles?.[metricKey];
                  const displayPercentile =
                    row.displayPercentiles?.[metricKey] ??
                    transformPercentileForDisplay(metricKey, percentile);
                  const raw = row.raw[metricKey];
                  const metricType = metric?.type || 'unknown';

                  const rawFormatted =
                    raw !== null && raw !== undefined
                      ? formatMetricValue(raw, metricType)
                      : 'N/A';
                  const percentileFormatted =
                    displayPercentile !== null &&
                    displayPercentile !== undefined
                      ? (displayPercentile * 100).toFixed(1) + '%'
                      : 'N/A';

                  const percentileLabel = getPercentileTooltipLabel(metricKey);

                  return `Raw Value: ${rawFormatted}\n${percentileLabel}: ${percentileFormatted}`;
                },
              };
            }),
          ]}
          data={companiesToDisplay.map((company) => {
            const displayPercentiles = {};
            if (company.percentiles) {
              selectedMetrics.forEach((metricKey) => {
                displayPercentiles[metricKey] = transformPercentileForDisplay(
                  metricKey,
                  company.percentiles?.[metricKey],
                );
              });
            }

            return {
              id: company.symbol,
              symbol: company.symbol,
              group:
                selectedGroupBy === 'sector'
                  ? company.sector
                  : company.industry,
              ...company,
              displayPercentiles,
            };
          })}
          getCellValue={(row, column) => {
            if (column.key === 'symbol' || column.key === 'group') {
              return row[column.key];
            }
            return (
              row.displayPercentiles?.[column.key] ??
              transformPercentileForDisplay(
                column.key,
                row.percentiles?.[column.key],
              )
            );
          }}
          getCellClassName={(row, column, value) => {
            if (column.key === 'symbol' || column.key === 'group') {
              return column.key === 'group'
                ? 'text-gray-600 dark:text-gray-400'
                : '';
            }
            const percentile = value;
            const colorClass = getPercentileColor(percentile);
            const textClass = getTextColorForBg(percentile);
            return `${colorClass} ${textClass}`;
          }}
          stickyFirstColumn={true}
        />
      </div>
    </div>
  );
};

export default HeatMapContent;
