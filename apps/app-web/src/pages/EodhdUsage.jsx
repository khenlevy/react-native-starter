import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Database,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { eodhdUsageApi } from '../services/eodhdUsageApi';

const EodhdUsage = () => {
  const [stats, setStats] = useState(null);
  const [endpointStats, setEndpointStats] = useState([]);
  const [availableEndpoints, setAvailableEndpoints] = useState([]);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [endpointTypes, setEndpointTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Drill-down state
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [endpointRequests, setEndpointRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Filters
  const [endpointFilter, setEndpointFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [limit, setLimit] = useState(100);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build filters
      const filters = {};
      if (endpointFilter !== 'all') filters.endpoint = endpointFilter;
      if (jobFilter !== 'all') filters.jobName = jobFilter;
      if (dateRange !== 'all') {
        const since = getDateRangeFilter(dateRange);
        if (since) filters.since = since.toISOString();
      }

      // Load all data in parallel
      const [
        statsData,
        endpointStatsData,
        endpointsData,
        jobsData,
        endpointTypesData,
      ] = await Promise.all([
        eodhdUsageApi.getStats(filters),
        eodhdUsageApi.getEndpointStats(filters),
        eodhdUsageApi.getAvailableEndpoints(),
        eodhdUsageApi.getAvailableJobs(),
        eodhdUsageApi.getEndpointTypes(),
      ]);

      console.log('📊 API Response Data:', {
        stats: statsData,
        endpointStats: endpointStatsData,
        endpoints: endpointsData,
        jobs: jobsData,
        endpointTypes: endpointTypesData,
      });

      setStats(statsData.stats);
      setEndpointStats(endpointStatsData.endpointStats);
      setAvailableEndpoints(endpointsData.endpoints);
      setAvailableJobs(jobsData.jobs);
      setEndpointTypes(endpointTypesData.endpointTypes);
    } catch (err) {
      console.error('Failed to load EODHD usage data:', err);

      // Check if it's a network error (backend not running)
      if (
        err.message.includes('Network error') ||
        err.message.includes('Failed to fetch')
      ) {
        setError(
          'Backend server is not running. Please start the API server on port 3001.',
        );
      } else {
        setError(err.message);
      }

      // Set empty data to prevent UI crashes
      setStats({
        totalRequests: 0,
        cacheHitRate: 0,
        successRate: 0,
        avgResponseTime: 0,
      });
      setEndpointStats([]);
      setAvailableEndpoints([]);
      setAvailableJobs([]);
      setEndpointTypes([]);
    } finally {
      setLoading(false);
    }
  }, [endpointFilter, jobFilter, dateRange]);

  // Load data on component mount and when filters change
  useEffect(() => {
    loadData();
  }, [loadData, endpointFilter, jobFilter, dateRange]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData, endpointFilter, jobFilter, dateRange]);

  // Load endpoint requests when an endpoint is selected
  const loadEndpointRequests = async (endpoint) => {
    setLoadingRequests(true);
    setSelectedEndpoint(endpoint);

    try {
      const filters = {};
      if (dateRange !== 'all') {
        const since = getDateRangeFilter(dateRange);
        if (since) filters.since = since.toISOString();
      }
      if (jobFilter !== 'all') filters.jobName = jobFilter;

      const recentUsageData = await eodhdUsageApi.getRecentUsage({
        ...filters,
        endpoint: endpoint,
        limit: 100,
      });

      setEndpointRequests(recentUsageData.usage);
    } catch (err) {
      console.error('Failed to load endpoint requests:', err);
      setEndpointRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Handle endpoint row click
  const handleEndpointClick = (endpoint) => {
    loadEndpointRequests(endpoint);
  };

  const getDateRangeFilter = (range) => {
    const now = new Date();
    switch (range) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h':
        return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatResponseTime = (ms) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusColor = (isSuccess) => {
    return isSuccess
      ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
      : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
  };

  const getStatusIcon = (isSuccess) => {
    return isSuccess ? CheckCircle : XCircle;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            EODHD API Usage
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and analyze EODHD API requests and performance
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw
              size={16}
              className={`mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex gap-4">
            <div className="w-48">
              <select
                value={endpointFilter}
                onChange={(e) => setEndpointFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark focus:border-transparent"
              >
                <option value="all">All Endpoints</option>
                {availableEndpoints.map((endpoint) => (
                  <option key={endpoint} value={endpoint}>
                    {endpoint}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-48">
              <select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark focus:border-transparent"
              >
                <option value="all">All Jobs</option>
                {availableJobs.map((job) => (
                  <option key={job} value={job}>
                    {job}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-32">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark focus:border-transparent"
              >
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div className="w-32">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark focus:border-transparent"
              >
                <option value={50}>50 results</option>
                <option value={100}>100 results</option>
                <option value={200}>200 results</option>
                <option value={500}>500 results</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle
              className="text-red-600 dark:text-red-400 mr-2"
              size={20}
            />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                API Error
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {error}
              </p>
              {error.includes('Backend server is not running') && (
                <div className="mt-3">
                  <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                    To fix this issue:
                  </p>
                  <ol className="text-sm text-red-600 dark:text-red-400 list-decimal list-inside space-y-1">
                    <li>Open a terminal in the project root</li>
                    <li>
                      Run:{' '}
                      <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">
                        cd apps/app-stocks-api && npm start
                      </code>
                    </li>
                    <li>Wait for the server to start on port 3001</li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
              )}
            </div>
            <button
              onClick={loadData}
              className="ml-4 px-3 py-1 bg-red-600 dark:bg-red-500 text-white text-sm rounded hover:bg-red-700 dark:hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3 animate-pulse"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                </div>
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Requests
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {stats.totalRequests?.toLocaleString() || 0}
                </p>
              </div>
              <BarChart3
                className="text-gray-400 dark:text-gray-500"
                size={20}
              />
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Cache Hit Rate
                </p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {stats.cacheHitRate?.toFixed(1) || 0}%
                </p>
              </div>
              <Database
                className="text-green-400 dark:text-green-500"
                size={20}
              />
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Success Rate
                </p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.successRate?.toFixed(1) || 0}%
                </p>
              </div>
              <CheckCircle
                className="text-blue-400 dark:text-blue-500"
                size={20}
              />
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Avg Response Time
                </p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {formatResponseTime(stats.avgResponseTime || 0)}
                </p>
              </div>
              <Clock
                className="text-purple-400 dark:text-purple-500"
                size={20}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Endpoint Performance Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedEndpoint
                  ? `Requests for ${selectedEndpoint}`
                  : 'Endpoint Performance'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {selectedEndpoint
                  ? `Individual API requests for ${selectedEndpoint} endpoint`
                  : 'Click on any row to view detailed requests for that endpoint'}
              </p>
            </div>
            {selectedEndpoint && (
              <button
                onClick={() => {
                  setSelectedEndpoint(null);
                  setEndpointRequests([]);
                }}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                ← Back to Overview
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          {selectedEndpoint ? (
            // Detailed requests view
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Response Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cached
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Job
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                {loadingRequests ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <RefreshCw
                          className="animate-spin text-gray-400 dark:text-gray-500 mr-2"
                          size={20}
                        />
                        <span className="text-gray-600 dark:text-gray-400">
                          Loading requests...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : endpointRequests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <AlertCircle
                          className="text-gray-400 dark:text-gray-500 mb-2"
                          size={32}
                        />
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          No requests found
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          No API requests found for this endpoint in the
                          selected time range.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  endpointRequests.map((request) => {
                    const StatusIcon = getStatusIcon(request.isSuccess);

                    return (
                      <tr
                        key={request._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <div>
                            <div>{formatTimeAgo(request.requestedAt)}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {formatDate(request.requestedAt)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              request.isSuccess,
                            )}`}
                          >
                            <StatusIcon size={12} className="mr-1" />
                            {request.statusCode}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatResponseTime(request.responseTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {request.isCached ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30">
                              <Database size={12} className="mr-1" />
                              Cached
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">
                              -
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {request.jobName || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {request.error ? (
                            <span
                              className="text-red-600 dark:text-red-400 text-xs"
                              title={request.error}
                            >
                              {request.error.length > 50
                                ? request.error.substring(0, 50) + '...'
                                : request.error}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : loading ? (
            // Loading skeleton for endpoint overview table
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cache Hit Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Response Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Request
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            // Endpoint overview table
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cache Hit Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Response Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Request
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                {endpointStats.filter((stats) => stats.totalRequests > 0)
                  .length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <AlertCircle
                          className="text-gray-400 dark:text-gray-500 mb-2"
                          size={32}
                        />
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          No API usage data found
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          No EODHD API endpoints have been used yet. Start using
                          the API to see usage statistics here.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  endpointStats
                    .filter((stats) => stats.totalRequests > 0) // Only show used endpoints
                    .sort((a, b) => b.totalRequests - a.totalRequests) // Sort by request count
                    .map((stats) => {
                      // Find matching endpoint type by displayName, name, or path
                      const endpointType = endpointTypes.find(
                        (et) =>
                          et.displayName === stats.endpoint ||
                          et.name === stats.endpoint ||
                          et.path === stats.endpoint,
                      );

                      // Get the API URL path (without query params)
                      const getApiUrl = () => {
                        const path = endpointType?.path || stats.endpoint;
                        return `https://eodhistoricaldata.com/api/${path}`;
                      };

                      return (
                        <tr
                          key={stats.endpoint}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                          onClick={() => handleEndpointClick(stats.endpoint)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            <div>
                              <div className="flex items-center">
                                <span>{stats.endpoint}</span>
                                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                                  👁️
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                {getApiUrl()}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {stats.totalRequests?.toLocaleString() || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                (stats.cacheHitRate || 0) > 50
                                  ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
                                  : 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
                              }`}
                            >
                              {stats.cacheHitRate?.toFixed(1) || 0}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                (stats.successRate || 0) > 90
                                  ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
                                  : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                              }`}
                            >
                              {stats.successRate?.toFixed(1) || 0}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatResponseTime(stats.avgResponseTime || 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {stats.lastRequest
                              ? formatTimeAgo(stats.lastRequest)
                              : 'Never'}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default EodhdUsage;
