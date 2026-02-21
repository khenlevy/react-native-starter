import { useEffect, useState } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

const PriceRangeFilters = ({
  filters = {},
  onChange = () => {},
  onReset = () => {},
  enabled = false,
  onEnabledChange = () => {},
  isFiltering = false,
  isLoadingPriceData = false,
  priceDataError = null,
  hasPriceData = false,
  className = '',
}) => {
  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(
        document.documentElement.classList.contains('dark') ||
          window.matchMedia('(prefers-color-scheme: dark)').matches,
      );
    };

    checkDarkMode();

    // Watch for class changes on html element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Watch for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDarkMode);
    };
  }, []);

  // Define the periods we want to support
  const periods = ['1W', '1M', '3M', '6M', '1Y'];

  // Get default filter values
  const getDefaultFilters = () => {
    const defaultFilters = {};
    periods.forEach((period) => {
      defaultFilters[period] = [-100, 100];
    });
    return defaultFilters;
  };

  // Check if any filters are active (not at default -100 to 100 range)
  const hasActiveFilters = () => {
    return Object.values(filters).some(([min, max]) => min > -100 || max < 100);
  };

  // Handle individual filter change
  const handleFilterChange = (period, newValue) => {
    const updatedFilters = {
      ...filters,
      [period]: newValue,
    };
    onChange(updatedFilters);
  };

  // Handle reset all filters
  const handleReset = () => {
    const resetFilters = getDefaultFilters();
    onReset(resetFilters);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Price Range Filters
          {isFiltering && (
            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
              🔄 Filtering...
            </span>
          )}
        </label>
        <button
          onClick={handleReset}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
          disabled={isFiltering || !hasActiveFilters() || !enabled}
        >
          Reset All
        </button>
      </div>

      {/* Enable/Disable Toggle */}
      <label
        className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 ${
          isFiltering
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Price Filtering
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {enabled
              ? 'Excluding companies with missing pricing metrics'
              : 'Showing all companies (including missing pricing metrics)'}
          </span>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          disabled={isFiltering}
          className="h-4 w-4 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
      </label>

      {/* Filter Cards */}
      <div className="space-y-4">
        {periods.map((period) => {
          const [minValue, maxValue] = filters[period] || [-100, 100];

          return (
            <div
              key={period}
              className="border rounded-lg p-3 border-gray-100 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {period} Range
                </label>
              </div>

              <div className="px-2">
                <Slider
                  range
                  min={-100}
                  max={100}
                  value={[minValue, maxValue]}
                  onChange={(value) => handleFilterChange(period, value)}
                  disabled={!enabled || isFiltering}
                  tipFormatter={(value) => `${value}%`}
                  trackStyle={[
                    {
                      backgroundColor: enabled
                        ? '#3b82f6'
                        : isDarkMode
                        ? '#4b5563'
                        : '#d1d5db',
                      height: 6,
                    },
                  ]}
                  handleStyle={[
                    {
                      backgroundColor: enabled
                        ? '#3b82f6'
                        : isDarkMode
                        ? '#6b7280'
                        : '#9ca3af',
                      borderColor: enabled
                        ? '#3b82f6'
                        : isDarkMode
                        ? '#6b7280'
                        : '#9ca3af',
                      width: 20,
                      height: 20,
                      marginTop: -7,
                      cursor: enabled ? 'pointer' : 'not-allowed',
                    },
                    {
                      backgroundColor: enabled
                        ? '#3b82f6'
                        : isDarkMode
                        ? '#6b7280'
                        : '#9ca3af',
                      borderColor: enabled
                        ? '#3b82f6'
                        : isDarkMode
                        ? '#6b7280'
                        : '#9ca3af',
                      width: 20,
                      height: 20,
                      marginTop: -7,
                      cursor: enabled ? 'pointer' : 'not-allowed',
                    },
                  ]}
                  railStyle={{
                    backgroundColor: isDarkMode ? '#374151' : '#e5e7eb',
                    height: 6,
                  }}
                  dotStyle={{
                    backgroundColor: isDarkMode ? '#374151' : '#e5e7eb',
                    borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                    width: 8,
                    height: 8,
                    marginTop: -1,
                  }}
                  activeDotStyle={{
                    backgroundColor: enabled
                      ? '#3b82f6'
                      : isDarkMode
                      ? '#6b7280'
                      : '#9ca3af',
                    borderColor: enabled
                      ? '#3b82f6'
                      : isDarkMode
                      ? '#6b7280'
                      : '#9ca3af',
                    width: 8,
                    height: 8,
                    marginTop: -1,
                  }}
                />
              </div>

              {/* Value Display */}
              <div className="flex justify-between items-center text-sm px-2 mt-2">
                <div className="flex flex-col items-center px-2">
                  <span className="text-gray-500 dark:text-gray-400 text-xs mb-1">
                    Min
                  </span>
                  <span
                    className={`font-medium text-xs ${
                      enabled
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {minValue}%
                  </span>
                </div>
                <div className="flex flex-col items-center px-2">
                  <span className="text-gray-500 dark:text-gray-400 text-xs mb-1">
                    Max
                  </span>
                  <span
                    className={`font-medium text-xs ${
                      enabled
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {maxValue}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Messages */}
      {!enabled && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          💡 Enable filtering to exclude companies with missing pricing metrics.
          When disabled, all companies are shown regardless of pricing data
          availability.
        </div>
      )}

      {enabled && hasActiveFilters() && (
        <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
          ⚠️ Active filters will exclude stocks outside the specified ranges
          {hasPriceData && (
            <span className="ml-1">(Local filtering active)</span>
          )}
        </div>
      )}

      {enabled && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          💡 Filters apply automatically as you adjust the sliders
        </div>
      )}

      {isLoadingPriceData && (
        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
          🔄 Loading price data...
        </div>
      )}

      {priceDataError && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
          ⚠️ {priceDataError}
        </div>
      )}

      {hasPriceData && (
        <div className="mt-2 text-xs text-green-600 dark:text-green-400">
          ✅ Price data loaded for filtering
        </div>
      )}
    </div>
  );
};

export default PriceRangeFilters;
