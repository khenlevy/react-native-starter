import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Trash2,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { useJobHistory } from '../hooks/useJobs';
import { jobsApi } from '../services/api';
import JsonViewer from '../components/JsonViewer';

const JobHistory = () => {
  const { jobName } = useParams();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [sortBy, setSortBy] = useState('scheduledAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [limit, setLimit] = useState(50);
  const [jsonViewerOpen, setJsonViewerOpen] = useState(false);
  const [selectedErrorData, setSelectedErrorData] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { jobs, loading, error, refetch } = useJobHistory(jobName, limit);

  // Filter and sort jobs client-side for better UX
  const filteredJobs = jobs
    .filter((job) => {
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;
      if (dateRange !== 'all') {
        const jobDate = new Date(job.scheduledAt);
        const cutoffDate = getDateRangeFilter(dateRange);
        if (jobDate < cutoffDate) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (
        sortBy === 'scheduledAt' ||
        sortBy === 'startedAt' ||
        sortBy === 'endedAt'
      ) {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });

  function getDateRangeFilter(range) {
    const now = new Date();
    switch (range) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '3months':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'status-running';
      case 'completed':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'skipped':
        return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700';
      case 'scheduled':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return Clock;
      case 'completed':
        return CheckCircle;
      case 'failed':
        return XCircle;
      case 'skipped':
        return Minus; // Using Minus icon for skipped
      case 'scheduled':
        return AlertCircle;
      default:
        return AlertCircle;
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

  const formatDuration = (startDate, endDate) => {
    if (!startDate) return 'N/A';
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '< 1m';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const formatProgress = (progress) => {
    return Math.round((progress || 0) * 100);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleErrorClick = (job) => {
    if (job.errorDetails) {
      setSelectedErrorData(job.errorDetails);
      setJsonViewerOpen(true);
    } else if (job.error) {
      // Fallback to simple error message if no detailed error data
      setSelectedErrorData({ message: job.error });
      setJsonViewerOpen(true);
    }
  };

  const closeJsonViewer = () => {
    setJsonViewerOpen(false);
    setSelectedErrorData(null);
  };

  const handleDeleteClick = (job) => {
    setJobToDelete(job);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;

    setIsDeleting(true);
    try {
      await jobsApi.delete(jobToDelete._id);
      // Refresh the job history after successful deletion
      refetch();
      setDeleteConfirmOpen(false);
      setJobToDelete(null);
    } catch (error) {
      console.error('Failed to delete job:', error);
      // You could add a toast notification here
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setJobToDelete(null);
  };

  // Calculate statistics
  const stats = {
    total: filteredJobs.length,
    completed: filteredJobs.filter((j) => j.status === 'completed').length,
    failed: filteredJobs.filter((j) => j.status === 'failed').length,
    running: filteredJobs.filter((j) => j.status === 'running').length,
    scheduled: filteredJobs.filter((j) => j.status === 'scheduled').length,
  };

  const successRate =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/jobs')}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Job History
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              All executions of &ldquo;{jobName}&rdquo;
            </p>
          </div>
        </div>
        <button onClick={refetch} disabled={loading} className="btn-secondary">
          <RefreshCw
            size={16}
            className={`mr-2 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Runs
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {stats.total}
              </p>
            </div>
            <BarChart3 className="text-gray-400 dark:text-gray-500" size={20} />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Success Rate
              </p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {Math.round(successRate)}%
              </p>
            </div>
            <TrendingUp
              className="text-green-400 dark:text-green-500"
              size={20}
            />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Completed
              </p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {stats.completed}
              </p>
            </div>
            <CheckCircle
              className="text-green-400 dark:text-green-500"
              size={20}
            />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Failed
              </p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {stats.failed}
              </p>
            </div>
            <XCircle className="text-red-400 dark:text-red-500" size={20} />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Running
              </p>
              <p
                className={`text-xl font-bold ${
                  stats.running > 0
                    ? 'running-count'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {stats.running}
              </p>
            </div>
            <Clock className="text-blue-400 dark:text-blue-500" size={20} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex gap-4">
            <div className="w-40">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="w-40">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="3months">Last 3 Months</option>
              </select>
            </div>

            <div className="w-32">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark focus:border-transparent"
              >
                <option value={20}>20 results</option>
                <option value={50}>50 results</option>
                <option value={100}>100 results</option>
                <option value={200}>200 results</option>
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
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                API Error
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Jobs History Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('scheduledAt')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Scheduled</span>
                    {sortBy === 'scheduledAt' && (
                      <span className="text-primary-600 dark:text-accent-dark">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cycle
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {sortBy === 'status' && (
                      <span className="text-primary-600 dark:text-accent-dark">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ended
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Error
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw
                        className="animate-spin text-gray-400 dark:text-gray-500 mr-2"
                        size={20}
                      />
                      <span className="text-gray-600 dark:text-gray-400">
                        Loading job history...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <AlertCircle
                        className="text-gray-400 dark:text-gray-500 mb-2"
                        size={32}
                      />
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        No job history found
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {statusFilter !== 'all' || dateRange !== 'all'
                          ? 'Try adjusting your filter criteria.'
                          : `No executions found for "${jobName}".`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const StatusIcon = getStatusIcon(job.status);
                  const cycleValue =
                    job.cycleNumber ?? job.metadata?.cycleNumber ?? null;

                  return (
                    <tr
                      key={job._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div>
                          <div>{formatTimeAgo(job.scheduledAt)}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {formatDate(job.scheduledAt)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {cycleValue !== null && cycleValue !== undefined ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            {cycleValue}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            job.status,
                          )}`}
                        >
                          <StatusIcon size={12} className="mr-1" />
                          {job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {job.status === 'running' || job.progress > 0 ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`bg-blue-600 dark:bg-accent-dark h-2 rounded-full transition-all duration-300 ${
                                  job.status === 'running'
                                    ? 'progress-bar-animated progress-bar-pulse'
                                    : ''
                                }`}
                                style={{
                                  width: `${formatProgress(job.progress)}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {formatProgress(job.progress)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDuration(job.startedAt, job.endedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {job.startedAt ? (
                          <div>
                            <div>{formatTimeAgo(job.startedAt)}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {formatDate(job.startedAt)}
                            </div>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {job.endedAt ? (
                          <div>
                            <div>{formatTimeAgo(job.endedAt)}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {formatDate(job.endedAt)}
                            </div>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {job.error ? (
                          <div className="max-w-xs">
                            <button
                              onClick={() => handleErrorClick(job)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:underline truncate text-left cursor-pointer"
                              title="Click to view detailed error information"
                            >
                              {job.error}
                            </button>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleDeleteClick(job)}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete this job execution"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Summary */}
      {filteredJobs.length > 0 && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredJobs.length} of {jobs.length} job executions
          {statusFilter !== 'all' && ` (filtered by status: ${statusFilter})`}
          {dateRange !== 'all' && ` (filtered by date: ${dateRange})`}
        </div>
      )}

      {/* JSON Viewer Modal */}
      <JsonViewer
        data={selectedErrorData}
        title="Error Details"
        isOpen={jsonViewerOpen}
        onClose={closeJsonViewer}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-10 h-10 mx-auto flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Delete Job Execution
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Are you sure you want to delete this job execution? This
                  action cannot be undone.
                </p>
                {jobToDelete && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Job: {jobToDelete.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Scheduled: {formatDate(jobToDelete.scheduledAt)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Status:{' '}
                      <span
                        className={`font-medium ${getStatusColor(
                          jobToDelete.status,
                        )}`}
                      >
                        {jobToDelete.status}
                      </span>
                    </p>
                  </div>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="animate-spin mr-2" size={16} />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobHistory;
