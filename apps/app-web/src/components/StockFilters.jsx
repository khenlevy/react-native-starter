import { useState, useEffect } from 'react';
import {
  Filter,
  X,
  DollarSign,
  Building2,
  Globe,
  TrendingUp,
  Factory,
  Database,
  BarChart3,
  TrendingDown,
} from 'lucide-react';
import stocksService from '../services/stocksService';
import { Select } from '@buydy/cl-select';
import { DualSlider } from '@buydy/cl-slider';

const StockFilters = ({ filters, onFiltersChange, onClearFilters }) => {
  const [filterOptions, setFilterOptions] = useState({
    exchanges: [],
    sectors: [],
    industries: [],
    countries: [],
    marketCapRange: { min: 1000000000, max: 100000000000 }, // Default values
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        setIsLoading(true);
        const response = await stocksService.getFilterOptions();
        setFilterOptions(response.data);
      } catch (error) {
        console.error('Error loading filter options:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  const handleFilterChange = (filterKey, value) => {
    onFiltersChange({
      ...filters,
      [filterKey]: value,
    });
  };

  const handleSliderChange = (values) => {
    onFiltersChange({
      ...filters,
      minCap: values[0],
      maxCap: values[1],
    });
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toLocaleString()}`;
  };

  const activeFiltersCount = Object.values(filters).filter(
    (value) => value !== undefined && value !== null && value !== '',
  ).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Filters
            </h3>
            {activeFiltersCount > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium px-2 py-1 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {activeFiltersCount > 0 && (
              <button
                onClick={onClearFilters}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center space-x-1"
              >
                <X className="h-4 w-4" />
                <span>Clear all</span>
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`transition-all duration-200 ${
          isExpanded ? 'max-h-screen' : 'max-h-0 overflow-hidden'
        }`}
      >
        <div className="p-4">
          {/* First Row - 4 components */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Exchange Filter */}
            <Select
              label="Exchange"
              icon={Building2}
              value={filters.exchange || ''}
              onChange={(e) => handleFilterChange('exchange', e.target.value)}
              options={filterOptions.exchanges}
              placeholder="All Exchanges"
              isLoading={isLoading}
            />

            {/* Sector Filter */}
            <Select
              label="Sector"
              icon={TrendingUp}
              value={filters.sector || ''}
              onChange={(e) => handleFilterChange('sector', e.target.value)}
              options={filterOptions.sectors}
              placeholder="All Sectors"
              isLoading={isLoading}
            />

            {/* Industry Filter */}
            <Select
              label="Industry"
              icon={Factory}
              value={filters.industry || ''}
              onChange={(e) => handleFilterChange('industry', e.target.value)}
              options={filterOptions.industries}
              placeholder="All Industries"
              isLoading={isLoading}
            />

            {/* Country Filter */}
            <Select
              label="Country"
              icon={Globe}
              value={filters.country || ''}
              onChange={(e) => handleFilterChange('country', e.target.value)}
              options={filterOptions.countries}
              placeholder="All Countries"
              isLoading={isLoading}
            />
          </div>

          {/* Second Row - 4 components */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Market Cap Range Slider */}
            <DualSlider
              label="Market Cap Range"
              icon={DollarSign}
              value={[
                filters.minCap || filterOptions.marketCapRange.min,
                filters.maxCap || filterOptions.marketCapRange.max,
              ]}
              onChange={handleSliderChange}
              min={filterOptions.marketCapRange.min}
              max={filterOptions.marketCapRange.max}
              step={1000000000}
              formatValue={formatCurrency}
              showResetButton={true}
              onReset={() =>
                handleSliderChange([
                  filterOptions.marketCapRange.min,
                  filterOptions.marketCapRange.max,
                ])
              }
              className="col-span-2"
            />

            {/* Fundamentals Filter */}
            <Select
              label="Fundamentals"
              icon={Database}
              value={filters.hasFundamentals || ''}
              onChange={(e) =>
                handleFilterChange('hasFundamentals', e.target.value)
              }
              options={[
                { value: 'true', label: 'With Fundamentals' },
                { value: 'false', label: 'Without Fundamentals' },
              ]}
              placeholder="All Companies"
            />

            {/* Dividends Filter */}
            <Select
              label="Dividends"
              icon={TrendingDown}
              value={filters.hasDividends || ''}
              onChange={(e) =>
                handleFilterChange('hasDividends', e.target.value)
              }
              options={[
                { value: 'true', label: 'With Dividends' },
                { value: 'false', label: 'Without Dividends' },
              ]}
              placeholder="All Companies"
            />
          </div>

          {/* Third Row - Technicals Filter (centered) */}
          <div className="flex justify-center">
            <Select
              label="Technicals"
              icon={BarChart3}
              value={filters.hasTechnicals || ''}
              onChange={(e) =>
                handleFilterChange('hasTechnicals', e.target.value)
              }
              options={[
                { value: 'true', label: 'With Technicals' },
                { value: 'false', label: 'Without Technicals' },
              ]}
              placeholder="All Companies"
              className="w-full max-w-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockFilters;
