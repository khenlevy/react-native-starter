import { useEffect, useRef } from 'react';
import { Button } from '@buydy/cl-button';
import { Select } from '@buydy/cl-select';
import { PriceRangeFilters } from '@buydy/cl-slider';
import SectorFilter from './SectorFilter';
import IndustryFilter from './IndustryFilter';

// Component for category checkbox with indeterminate state support
const CategoryCheckbox = ({
  checked,
  indeterminate,
  onChange,
  disabled,
  label,
}) => {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className="flex items-center space-x-2 mb-2 cursor-pointer">
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="form-checkbox h-4 w-4 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      />
      <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </h5>
    </label>
  );
};

const HeatMapSidebar = ({
  // Data
  sectors,
  industries,
  availableMetrics,
  selectedMetrics,
  selectedSectors,
  selectedIndustries,
  selectedGroupBy,

  // States
  loading,
  initialDataLoading,
  isFiltering,
  onlyCompleteMetrics,
  showDimensions,
  showFilters,
  showOptimum,
  heatmapLoaded, // Whether heatmap data is loaded

  // Formula states
  formulaMethod,
  weights: _weights,

  // Price range filters
  priceRangeFilters,
  priceRangeFiltersEnabled,

  // Callbacks
  onGroupByChange,
  onMetricsChange,
  onSectorsChange,
  onIndustriesChange,
  onOnlyCompleteMetricsChange,
  onShowDimensionsChange,
  onShowFiltersChange,
  onShowOptimumChange,
  onFormulaMethodChange,
  onWeightsChange: _onWeightsChange,
  onPriceRangeFiltersChange,
  onPriceRangeFiltersEnabledChange,
  onLoadHeatmap,
  onApplyFormula,
  onResetPriceRangeFilters,
}) => {
  // Disable all filters when loading or filtering
  const isDisabled = loading || initialDataLoading || isFiltering;
  return (
    <div className="w-80 bg-white dark:bg-surface-dark shadow-lg p-6 flex-shrink-0 h-full flex flex-col">
      {/* Title - Fixed at top */}
      <h2 className="text-2xl font-bold mb-6 flex-shrink-0 dark:text-white">
        📊 Heat Map
      </h2>
      {/* Scrollable content wrapper */}
      <div className="flex-1 overflow-y-auto">
        {/* Dimensions Section */}
        <div className="mb-6">
          <button
            onClick={() => onShowDimensionsChange(!showDimensions)}
            className="flex items-center justify-between w-full mb-4 p-2 -m-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
            title={showDimensions ? 'Hide Dimensions' : 'Show Dimensions'}
          >
            <h3 className="text-lg font-semibold dark:text-white group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
              Dimensions
            </h3>
            <svg
              className={`w-4 h-4 transform transition-transform text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 ${
                showDimensions ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showDimensions && (
            <div className="space-y-4">
              {/* Group By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Group By
                </label>
                <Select
                  value={selectedGroupBy}
                  onChange={onGroupByChange}
                  options={[
                    { value: 'sector', label: 'Sector' },
                    { value: 'industry', label: 'Industry' },
                  ]}
                  disabled={isDisabled}
                />
              </div>

              {/* Metrics */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Metrics
                  </h4>
                  {Array.isArray(availableMetrics) &&
                    availableMetrics.length > 0 && (
                      <button
                        onClick={() => {
                          const allMetricKeys = availableMetrics.map(
                            (m) => m.key,
                          );
                          const allSelected =
                            allMetricKeys.length === selectedMetrics.length &&
                            allMetricKeys.every((key) =>
                              selectedMetrics.includes(key),
                            );
                          if (allSelected) {
                            onMetricsChange([]);
                          } else {
                            onMetricsChange(allMetricKeys);
                          }
                        }}
                        disabled={isDisabled}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {(() => {
                          const allMetricKeys = availableMetrics.map(
                            (m) => m.key,
                          );
                          const allSelected =
                            allMetricKeys.length === selectedMetrics.length &&
                            allMetricKeys.every((key) =>
                              selectedMetrics.includes(key),
                            );
                          return allSelected ? 'Unselect all' : 'Select all';
                        })()}
                      </button>
                    )}
                </div>
                <div className="max-h-[332px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800/50">
                  {Array.isArray(availableMetrics) &&
                  availableMetrics.length > 0 ? (
                    Object.entries(
                      availableMetrics.reduce((acc, metric) => {
                        const category = metric.category || 'Other';
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(metric);
                        return acc;
                      }, {}),
                    ).map(([category, metrics]) => {
                      const categoryMetricKeys = metrics.map((m) => m.key);
                      const selectedInCategory = categoryMetricKeys.filter(
                        (key) => selectedMetrics.includes(key),
                      );
                      const allSelected =
                        selectedInCategory.length === categoryMetricKeys.length;
                      const someSelected =
                        selectedInCategory.length > 0 && !allSelected;

                      const handleCategoryToggle = () => {
                        if (allSelected) {
                          // Deselect all metrics in this category
                          onMetricsChange(
                            selectedMetrics.filter(
                              (key) => !categoryMetricKeys.includes(key),
                            ),
                          );
                        } else {
                          // Select all metrics in this category
                          const newSelected = [
                            ...selectedMetrics.filter(
                              (key) => !categoryMetricKeys.includes(key),
                            ),
                            ...categoryMetricKeys,
                          ];
                          onMetricsChange(newSelected);
                        }
                      };

                      return (
                        <div key={category} className="mb-4 last:mb-0">
                          <CategoryCheckbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onChange={handleCategoryToggle}
                            disabled={isDisabled}
                            label={category}
                          />
                          <div className="space-y-1">
                            {metrics.map((metric) => (
                              <label
                                key={metric.key}
                                className="flex items-center space-x-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedMetrics.includes(metric.key)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      onMetricsChange([
                                        ...selectedMetrics,
                                        metric.key,
                                      ]);
                                    } else {
                                      onMetricsChange(
                                        selectedMetrics.filter(
                                          (m) => m !== metric.key,
                                        ),
                                      );
                                    }
                                  }}
                                  disabled={isDisabled}
                                  className="form-checkbox h-4 w-4 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                />
                                <span className="text-gray-700 dark:text-gray-300">
                                  {metric.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                      No metrics available
                    </div>
                  )}
                </div>
              </div>

              {/* Only show companies with valid percentiles toggle */}
              <label
                className={`flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={onlyCompleteMetrics}
                  onChange={(e) =>
                    onOnlyCompleteMetricsChange(e.target.checked)
                  }
                  disabled={isDisabled}
                  className="h-4 w-4 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  All metrics only
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Visual Separator */}
        <hr className="my-6 border-gray-200 dark:border-gray-700" />

        {/* Filters Section - Only show after heatmap is loaded */}
        <div className="mb-6">
          <button
            onClick={() => onShowFiltersChange(!showFilters)}
            className="flex items-center justify-between w-full mb-4 p-2 -m-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
            title={showFilters ? 'Hide Filters' : 'Show Filters'}
          >
            <h3 className="text-lg font-semibold dark:text-white group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
              Filters
            </h3>
            <svg
              className={`w-4 h-4 transform transition-transform text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 ${
                showFilters ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showFilters && (
            <div className="space-y-4">
              {/* Sectors Multi-Select */}
              <SectorFilter
                sectors={sectors}
                selectedSectors={selectedSectors}
                onChange={onSectorsChange}
                label="Sectors"
                searchPlaceholder="Search sectors..."
                displayMode="single-line"
                className="mb-4"
                disabled={isDisabled}
              />

              {/* Industries Multi-Select */}
              <IndustryFilter
                industries={industries}
                selectedIndustries={selectedIndustries}
                onChange={onIndustriesChange}
                label="Industries"
                searchPlaceholder="Search industries..."
                displayMode="single-line"
                className="mb-4"
                disabled={isDisabled}
              />

              {/* Price Range Filters */}
              <div>
                <PriceRangeFilters
                  filters={priceRangeFilters}
                  onChange={onPriceRangeFiltersChange}
                  onReset={onResetPriceRangeFilters}
                  enabled={priceRangeFiltersEnabled}
                  onEnabledChange={onPriceRangeFiltersEnabledChange}
                  isFiltering={isFiltering}
                />
              </div>
            </div>
          )}
        </div>

        {/* Ranking Section - Only enabled after heatmap is loaded */}
        <div className="mb-6">
          <button
            onClick={() => onShowOptimumChange(!showOptimum)}
            disabled={!heatmapLoaded}
            className={`flex items-center justify-between w-full mb-4 p-2 -m-2 rounded transition-colors group ${
              !heatmapLoaded
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={showOptimum ? 'Hide Ranking' : 'Show Ranking'}
          >
            <h3 className="text-lg font-semibold dark:text-white group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
              Ranking
            </h3>
            <svg
              className={`w-4 h-4 transform transition-transform text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 ${
                showOptimum ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showOptimum && (
            <div
              className={`space-y-4 ${
                !heatmapLoaded ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {/* Ranking Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ranking Method
                </label>
                <Select
                  value={formulaMethod}
                  onChange={onFormulaMethodChange}
                  options={[
                    { value: 'weighted', label: 'Weighted Average' },
                    { value: 'geometric', label: 'Geometric Mean' },
                  ]}
                  disabled={isDisabled || !heatmapLoaded}
                />
              </div>

              <Button
                onClick={onApplyFormula}
                disabled={
                  !selectedMetrics.length || !heatmapLoaded || isDisabled
                }
                variant="success"
                className="w-full"
              >
                Calculate
              </Button>
            </div>
          )}
        </div>
      </div>{' '}
      {/* End scrollable content wrapper */}
      {/* Load Heatmap Button - Fixed at bottom */}
      <div className="mt-auto pt-4">
        <Button
          onClick={onLoadHeatmap}
          disabled={
            loading || initialDataLoading || selectedMetrics.length === 0
          }
          className={`w-full flex items-center justify-center space-x-2 ${
            loading || initialDataLoading || selectedMetrics.length === 0
              ? 'opacity-50 cursor-not-allowed bg-gray-400'
              : ''
          }`}
        >
          {(loading || initialDataLoading) && (
            <svg
              className="animate-spin h-4 w-4"
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
          )}
          <span>
            {loading
              ? 'Loading...'
              : initialDataLoading
              ? 'Loading data...'
              : 'Load Heatmap'}
          </span>
        </Button>
      </div>
    </div>
  );
};

export default HeatMapSidebar;
