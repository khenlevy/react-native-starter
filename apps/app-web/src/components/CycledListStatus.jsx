import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Activity,
  Zap,
  BarChart3,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { jobsApi } from '../services/api';

const CycledListStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setLastUpdated] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await jobsApi.getCycledListStatus();
      setStatus(response);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Refresh every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-6">
        <div className="flex items-center text-red-600 dark:text-red-400">
          <XCircle className="h-5 w-5 mr-2" />
          <span className="font-medium">Error loading cycled list status</span>
        </div>
        <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>
        <button
          onClick={fetchStatus}
          className="mt-3 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center text-gray-500 dark:text-gray-400">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>No cycled list status available</span>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (status.overallStatus) {
      case 'running':
        return <Play className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'paused':
        return (
          <Pause className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        );
      case 'stopped':
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'completed':
        return (
          <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        );
      default:
        return (
          <AlertCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        );
    }
  };

  const getStatusBadgeColor = () => {
    switch (status.overallStatus) {
      case 'running':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700';
      case 'paused':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
      case 'stopped':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700';
      case 'completed':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  const handlePause = async () => {
    try {
      setActionLoading(true);
      await jobsApi.pauseCycledList();
      // Refresh status after action
      await fetchStatus();
    } catch (err) {
      setError(err.message || 'Failed to pause cycle list');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await jobsApi.resumeCycledList();
      // Refresh status after action
      await fetchStatus();
    } catch (err) {
      setError(err.message || 'Failed to resume cycle list');
    } finally {
      setActionLoading(false);
    }
  };

  const formatJobStatusDetails = (job) => {
    if (!job) {
      return 'No job data available yet';
    }

    const statusText = job.status ? job.status.replace(/_/g, ' ') : 'pending';
    const capitalizedStatus =
      statusText.charAt(0).toUpperCase() + statusText.slice(1);
    const progressSegment =
      typeof job.progressPercentage === 'number' &&
      (job.status === 'running' || job.status === 'retrying')
        ? ` • ${job.progressPercentage}%`
        : '';

    const timestamp = job.endedAt || job.startedAt || job.scheduledAt;
    const timestampLabel = job.endedAt
      ? 'Finished'
      : job.startedAt
      ? 'Started'
      : job.scheduledAt
      ? 'Scheduled'
      : null;
    const timestampSegment =
      timestamp && timestampLabel
        ? ` • ${timestampLabel} ${new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : '';

    const machineSegment = job.machineName ? ` • ${job.machineName}` : '';

    return `${capitalizedStatus}${progressSegment}${timestampSegment}${machineSegment}`;
  };

  const formatJobDisplayName = (job) => {
    if (!job) return 'None';
    return job.displayName || job.name || 'None';
  };

  const renderJobCard = (title, job, IconComponent, accentClasses) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <div className="flex items-center">
        <IconComponent className={`h-5 w-5 mr-2 ${accentClasses}`} />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {title}
          </p>
          <p className={`text-sm font-bold ${accentClasses} truncate`}>
            {formatJobDisplayName(job)}
          </p>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {formatJobStatusDetails(job)}
      </p>
    </div>
  );

  const previousJob = status.previousAsyncFn || null;
  const currentJob = status.currentAsyncFn || null;
  const nextJob = status.nextAsyncFn || null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Cycled List Status
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {status.name || 'Stocks Scanner Daily Sync'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusBadgeColor()}`}
          >
            {getStatusIcon()}
            <span className="ml-2">{status.statusText}</span>
          </span>
          <button
            onClick={fetchStatus}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Refresh status"
            disabled={actionLoading}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Manual Pause/Resume Controls */}
      <div className="mb-6 flex items-center justify-center space-x-3">
        {status.isPaused && !status.manualPause ? (
          // EODHD limit pause - show info but allow manual resume
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Auto-paused due to EODHD limit
            </span>
            <button
              onClick={handleResume}
              disabled={actionLoading}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="h-4 w-4 mr-2" />
              Resume Manually
            </button>
          </div>
        ) : status.manualPause ? (
          // Manually paused - show resume button
          <button
            onClick={handleResume}
            disabled={actionLoading}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="h-4 w-4 mr-2" />
            {actionLoading ? 'Resuming...' : 'Resume'}
          </button>
        ) : status.isRunning ? (
          // Running - show pause button
          <button
            onClick={handlePause}
            disabled={actionLoading}
            className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Pause className="h-4 w-4 mr-2" />
            {actionLoading ? 'Pausing...' : 'Pause'}
          </button>
        ) : (
          // Stopped - show resume button
          <button
            onClick={handleResume}
            disabled={actionLoading}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="h-4 w-4 mr-2" />
            {actionLoading ? 'Starting...' : 'Start'}
          </button>
        )}
      </div>

      {/* Metrics + Job Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Current Cycle */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center">
            <RotateCcw className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Current Cycle
              </p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {status.currentCycle || 0}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Total: {status.totalCycles || 0} cycles
          </p>
        </div>

        {/* Progress Overview */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center">
            <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Progress
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {status.progressPercentage || 0}%
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {status.cycleProgress?.completed || 0} of{' '}
            {status.cycleProgress?.total || 0} jobs
          </p>
        </div>

        {renderJobCard(
          'Previous Job',
          previousJob,
          SkipBack,
          'text-purple-600 dark:text-purple-400',
        )}
        {renderJobCard(
          'Current Job',
          currentJob,
          Zap,
          'text-orange-600 dark:text-orange-400',
        )}
        {renderJobCard(
          'Next Job',
          nextJob,
          SkipForward,
          'text-blue-600 dark:text-blue-400',
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Job Progress</span>
          <span>
            {status.cycleProgress?.current || 0} /{' '}
            {status.cycleProgress?.total || 0}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${status.progressPercentage || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Pause Reason Alert */}
      {status.isPaused && status.pauseReason && (
        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Cycle List Paused
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                {status.pauseReason}
              </p>
              {status.nextCycleScheduled && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Resuming:{' '}
                  {new Date(status.nextCycleScheduled).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="flex items-center text-gray-600 dark:text-gray-400">
          <Clock className="h-4 w-4 mr-2" />
          <span>
            {status.isRunning
              ? 'Running'
              : status.isPaused
              ? 'Paused'
              : 'Stopped'}
          </span>
        </div>
        <div className="flex items-center text-gray-600 dark:text-gray-400">
          <CheckCircle className="h-4 w-4 mr-2" />
          <span>{status.completedAsyncFns || 0} completed</span>
        </div>
        <div className="flex items-center text-gray-600 dark:text-gray-400">
          <XCircle className="h-4 w-4 mr-2" />
          <span>{status.failedAsyncFns || 0} failed</span>
        </div>
      </div>
    </div>
  );
};

export default CycledListStatus;
