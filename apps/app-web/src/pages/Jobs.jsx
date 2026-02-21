import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  History,
  BarChart3,
  Play,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { useJobsByType } from '../hooks/useJobs';
import { jobsApi } from '../services/api';
import CronSchedule from '../components/CronSchedule';
import CycledListStatus from '../components/CycledListStatus';

const Jobs = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [runConfirmOpen, setRunConfirmOpen] = useState(false);
  const [jobToRun, setJobToRun] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [recentlyStartedJobs, setRecentlyStartedJobs] = useState(new Set());

  // Memoize params to prevent infinite re-renders
  const params = useMemo(
    () => ({
      limit: pageSize,
      skip: currentPage * pageSize,
    }),
    [pageSize, currentPage],
  );

  const { jobTypes, pagination, loading, error, refetch } =
    useJobsByType(params);

  // Filter job types client-side for search
  const filteredJobTypes = jobTypes.filter((jobType) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      jobType.name.toLowerCase().includes(searchLower) ||
      (jobType.latestJob.metadata?.description &&
        jobType.latestJob.metadata.description
          .toLowerCase()
          .includes(searchLower))
    );
  });

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm]);

  const aggregatedStats = useMemo(() => {
    const totalRuns = jobTypes.reduce((sum, type) => sum + type.totalRuns, 0);
    const totalCompleted = jobTypes.reduce(
      (sum, type) => sum + type.completedCount,
      0,
    );
    const totalRunning = jobTypes.reduce(
      (sum, type) => sum + type.runningCount,
      0,
    );
    const totalFailed = jobTypes.reduce(
      (sum, type) => sum + type.failedCount,
      0,
    );

    return {
      jobTypes: jobTypes.length,
      totalRuns,
      successRate:
        totalRuns > 0 ? Math.round((totalCompleted / totalRuns) * 100) : 0,
      totalRunning,
      totalFailed,
    };
  }, [jobTypes]);

  const handleRunClick = (jobType) => {
    setJobToRun(jobType);
    setRunConfirmOpen(true);
  };

  const handleRunConfirm = async () => {
    if (!jobToRun) return;

    setIsRunning(true);
    try {
      // Use the latest job ID to run the job
      const response = await jobsApi.runJob(jobToRun.latestJob._id);
      console.log('Job execution triggered:', response);

      // Mark this job as recently started for visual feedback
      setRecentlyStartedJobs((prev) => new Set([...prev, jobToRun.name]));

      // Remove the "recently started" indicator after 10 seconds
      setTimeout(() => {
        setRecentlyStartedJobs((prev) => {
          const newSet = new Set(prev);
          newSet.delete(jobToRun.name);
          return newSet;
        });
      }, 10000);

      // Immediately refresh to show the new job status
      refetch();

      // Set up a more frequent polling for the next 30 seconds to track progress
      const progressInterval = setInterval(() => {
        refetch();
      }, 2000); // Poll every 2 seconds for 30 seconds

      setTimeout(() => {
        clearInterval(progressInterval);
      }, 30000);

      setRunConfirmOpen(false);
      setJobToRun(null);
      // You could add a success toast notification here
    } catch (error) {
      console.error('Failed to run job:', error);
      // You could add an error toast notification here
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunCancel = () => {
    setRunConfirmOpen(false);
    setJobToRun(null);
  };

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

  const formatProgress = (progress) => {
    return Math.round((progress || 0) * 100);
  };

  const totalPages = pagination ? Math.ceil(pagination.total / pageSize) : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Job Types
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and manage your stocks scanning job types
          </p>
          {pagination && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Showing {filteredJobTypes.length} of {pagination.total} job types
            </p>
          )}
        </div>
        <div className="flex space-x-3">
          <button
            onClick={refetch}
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

      {/* Cycled List Status */}
      <CycledListStatus />

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

      {/* Summary Metrics + Search */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {loading ? (
            <div className="flex-1 flex flex-wrap gap-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className="card p-3 flex-1 min-w-[120px] animate-pulse"
                >
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-6 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Job Types
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {aggregatedStats.jobTypes}
                    </p>
                  </div>
                  <BarChart3
                    className="text-gray-400 dark:text-gray-500"
                    size={16}
                  />
                </div>
              </div>

              <div className="card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Total Runs
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {aggregatedStats.totalRuns.toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp
                    className="text-gray-400 dark:text-gray-500"
                    size={16}
                  />
                </div>
              </div>

              <div className="card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Success Rate
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {aggregatedStats.successRate}%
                    </p>
                  </div>
                  <CheckCircle
                    className="text-green-400 dark:text-green-500"
                    size={16}
                  />
                </div>
              </div>

              <div className="card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Running
                    </p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400 running-count">
                      {aggregatedStats.totalRunning}
                    </p>
                  </div>
                  <Clock
                    className="text-blue-400 dark:text-blue-500"
                    size={16}
                  />
                </div>
              </div>

              <div className="card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Failed
                    </p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {aggregatedStats.totalFailed}
                    </p>
                  </div>
                  <XCircle
                    className="text-red-400 dark:text-red-500"
                    size={16}
                  />
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="w-full lg:w-auto flex gap-4">
              <div className="card p-3 flex-1 min-w-[200px] animate-pulse">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="card p-3 w-28 animate-pulse">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[200px] lg:w-80">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search job types by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-h-[40px] pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark focus:border-transparent"
                />
              </div>
              <div className="w-28">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-dark text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark focus:border-transparent"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Job Types Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cycle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Machine
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Run
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Runs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Running
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schedule
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-6 bg-gray-200 rounded-full w-12"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-2 bg-gray-200 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-8"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-12"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-8"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-gray-200 rounded w-6"></div>
                    </td>
                  </tr>
                ))
              ) : filteredJobTypes.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <AlertCircle
                        className="text-gray-400 dark:text-gray-500 mb-2"
                        size={32}
                      />
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        No job types found
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {searchTerm
                          ? 'Try adjusting your search criteria.'
                          : 'No job types have been created yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredJobTypes.map((jobType) => {
                  const StatusIcon = getStatusIcon(jobType.latestJob.status);
                  const isRunning = jobType.runningCount > 0;

                  return (
                    <tr
                      key={jobType.name}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                      onClick={() =>
                        navigate(
                          `/jobs/history/${encodeURIComponent(jobType.name)}`,
                        )
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {jobType.cycleNumber !== null &&
                        jobType.cycleNumber !== undefined ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            {jobType.cycleNumber}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {jobType.name}
                          </div>
                          {jobType.latestJob.metadata?.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {jobType.latestJob.metadata.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {jobType.latestJob.machineName || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              jobType.latestJob.status,
                            )}`}
                          >
                            <StatusIcon size={12} className="mr-1" />
                            {jobType.latestJob.status}
                          </span>
                          {recentlyStartedJobs.has(jobType.name) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 animate-pulse">
                              Just Started
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {jobType.latestJob.status === 'running' ||
                        jobType.latestJob.progress > 0 ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`bg-blue-600 dark:bg-accent-dark h-2 rounded-full transition-all duration-300 ${
                                  jobType.latestJob.status === 'running'
                                    ? 'progress-bar-animated progress-bar-pulse'
                                    : ''
                                }`}
                                style={{
                                  width: `${formatProgress(
                                    jobType.latestJob.progress,
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {formatProgress(jobType.latestJob.progress)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {jobType.latestJob?.status === 'running' &&
                        jobType.lastFinishedJob?.endedAt
                          ? formatTimeAgo(jobType.lastFinishedJob.endedAt)
                          : formatTimeAgo(
                              jobType.latestJob?.endedAt ||
                                jobType.latestJob?.scheduledAt,
                            )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm font-medium ${
                            isRunning
                              ? 'running-count'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {jobType.totalRuns}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {jobType.completedCount} done, {jobType.failedCount}{' '}
                          failed
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {Math.round(jobType.successRate)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isRunning ? (
                          <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                            <Clock size={14} className="mr-1" />
                            <span className="running-count">
                              {jobType.runningCount}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <CronSchedule
                          jobName={jobType.name}
                          schedule={jobType.schedule}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunClick(jobType);
                            }}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title="Run this job"
                          >
                            <Play size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(
                                `/jobs/history/${encodeURIComponent(
                                  jobType.name,
                                )}`,
                              );
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1"
                            title="View all runs"
                          >
                            <History size={16} />
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

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Showing {currentPage * pageSize + 1} to{' '}
              {Math.min((currentPage + 1) * pageSize, pagination.total)} of{' '}
              {pagination.total} job types
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
              }
              disabled={currentPage >= totalPages - 1}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Run Job Confirmation Modal */}
      {runConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-surface-dark rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Run Job
              </h3>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Are you sure you want to run the job:
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {jobToRun?.name}
              </p>
              {jobToRun?.latestJob.metadata?.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {jobToRun.latestJob.metadata.description}
                </p>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleRunCancel}
                disabled={isRunning}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRunConfirm}
                disabled={isRunning}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="animate-spin mr-2" size={16} />
                    Running...
                  </>
                ) : (
                  'Run Job'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Jobs;
