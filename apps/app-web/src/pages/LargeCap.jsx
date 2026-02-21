import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, BarChart3, Users, DollarSign, Search } from 'lucide-react';
import StockAutocomplete from '../components/StockAutocomplete';
import StockFilters from '../components/StockFilters';
import StocksTable from '../components/StocksTable';
import stocksService from '../services/stocksService';

const LargeCap = () => {
  const [stocks, setStocks] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    exchange: '',
    sector: '',
    industry: '',
    country: '',
    minCap: '',
    maxCap: '',
    hasFundamentals: '',
    hasDividends: '',
    hasTechnicals: '',
  });

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 6,
    total: 0,
    pages: 0,
  });

  // Sorting state
  const [sorting, setSorting] = useState({
    sortBy: 'marketCap',
    sortOrder: 'desc',
  });

  // UI state
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Load stock statistics
  const loadStats = useCallback(async () => {
    try {
      setIsLoadingStats(true);
      const response = await stocksService.getStockStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Load stocks with current filters and pagination
  const loadStocks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        ...filters,
        sortBy: sorting.sortBy,
        sortOrder: sorting.sortOrder,
        limit: pagination.limit,
        skip: (pagination.currentPage - 1) * pagination.limit,
      };

      // Remove empty filters
      Object.keys(params).forEach((key) => {
        if (
          params[key] === '' ||
          params[key] === null ||
          params[key] === undefined
        ) {
          delete params[key];
        }
      });

      const response = await stocksService.getLargeCapStocks(params);

      setStocks(response.data.stocks);
      setPagination((prev) => ({
        ...prev,
        total: response.data.pagination.total,
        pages: response.data.pagination.pages,
      }));
    } catch (error) {
      console.error('Error loading stocks:', error);
      setError('Failed to load stocks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, sorting, pagination.currentPage, pagination.limit]);

  // Load data on component mount
  useEffect(() => {
    loadStats();
    loadStocks();
  }, [loadStats, loadStocks]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, []);

  // Handle stock selection from autocomplete
  const handleStockSelect = useCallback((stock) => {
    if (stock) {
      setFilters((prev) => ({
        ...prev,
        search: stock.displayText,
      }));
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    } else {
      setFilters((prev) => ({
        ...prev,
        search: '',
      }));
    }
  }, []);

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      exchange: '',
      sector: '',
      industry: '',
      country: '',
      minCap: '',
      maxCap: '',
    });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, []);

  // Handle sorting
  const handleSort = useCallback((sortBy, sortOrder) => {
    setSorting({ sortBy, sortOrder });
  }, []);

  // Handle pagination
  const handlePageChange = useCallback((newPage) => {
    setPagination((prev) => ({ ...prev, currentPage: newPage }));
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <TrendingUp className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              <span>Large Cap Stocks</span>
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Discover and analyze large capitalization stocks from around the
              world
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {!isLoadingStats && stats && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Total Stocks
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                    {stats.totalStocks?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Total Fundamentals
                  </p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-300">
                    {stats.totalFundamentals?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    Total Dividends
                  </p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                    {stats.totalDividends?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    Total Technicals
                  </p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">
                    {stats.totalTechnicals?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Search Stocks
            </h3>
          </div>
          <button
            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
          >
            {isSearchExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {isSearchExpanded && (
          <StockAutocomplete
            onStockSelect={handleStockSelect}
            placeholder="Search by symbol (e.g., AAPL) or company name (e.g., Apple)"
          />
        )}
      </div>

      {/* Filters */}
      <StockFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
      />

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                Error
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {!isLoading && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {stocks.length} of {pagination.total.toLocaleString()}{' '}
            stocks
          </div>
        </div>
      )}

      {/* Stocks Table */}
      <StocksTable
        stocks={stocks}
        isLoading={isLoading}
        onSort={handleSort}
        sortBy={sorting.sortBy}
        sortOrder={sorting.sortOrder}
      />

      {/* Pagination */}
      {!isLoading && pagination.pages > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {pagination.currentPage} of {pagination.pages}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.pages}
                className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LargeCap;
