import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  History,
  Minus,
} from 'lucide-react';
import { useJobStats, useRecentJobs, useRunningJobs } from '../hooks/useJobs';

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useJobStats();
  const {
    recentJobs,
    loading: recentLoading,
    error: recentError,
  } = useRecentJobs(10);
  const { runningJobs } = useRunningJobs(5000); // Poll every 5 seconds

  // Format stats for display
  const statsCards = stats
    ? [
        {
          title: 'Total Jobs',
          value: stats.stats.total.toLocaleString(),
          change: `+${stats.recentActivity}`,
          changeType: 'positive',
          icon: Activity,
        },
        {
          title: 'Running Jobs',
          value: stats.stats.running.toString(),
          change:
            runningJobs.length > 0 ? `${runningJobs.length} active` : 'None',
          changeType: runningJobs.length > 0 ? 'positive' : 'neutral',
          icon: Clock,
        },
        {
          title: 'Completed Jobs',
          value: stats.stats.completed.toLocaleString(),
          change: `${Math.round(
            (stats.stats.completed / stats.stats.total) * 100,
          )}%`,
          changeType: 'positive',
          icon: CheckCircle,
        },
        {
          title: 'Failed Jobs',
          value: stats.stats.failed.toString(),
          change:
            stats.stats.failed > 0
              ? `${Math.round((stats.stats.failed / stats.stats.total) * 100)}%`
              : '0%',
          changeType: stats.stats.failed > 0 ? 'negative' : 'positive',
          icon: XCircle,
        },
      ]
    : [];

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

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor your stocks scanning jobs and system performance
          </p>
        </div>
        <button
          onClick={refetchStats}
          disabled={statsLoading}
          className="btn-secondary flex items-center space-x-2"
        >
          <RefreshCw size={16} className={statsLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error States */}
      {(statsError || recentError) && (
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
                {statsError || recentError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.title}
                  </p>
                  <p
                    className={`text-2xl font-bold text-gray-900 dark:text-white ${
                      stat.title === 'Running Jobs' && stat.value !== '0'
                        ? 'running-count'
                        : ''
                    }`}
                  >
                    {statsLoading ? '...' : stat.value}
                  </p>
                </div>
                <div className="p-3 bg-primary-100 dark:bg-accent-dark/20 rounded-full">
                  <Icon
                    className="text-primary-600 dark:text-accent-dark"
                    size={24}
                  />
                </div>
              </div>
              <div className="mt-4">
                <span
                  className={`text-sm font-medium ${
                    stat.changeType === 'positive'
                      ? 'text-green-600 dark:text-green-400'
                      : stat.changeType === 'negative'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {stat.change}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                  {stat.title === 'Total Jobs'
                    ? 'recent activity'
                    : stat.title === 'Running Jobs'
                    ? 'currently active'
                    : 'success rate'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Jobs */}
      <div className="card">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Jobs
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Latest job executions and their status
          </p>
        </div>
        <div className="p-6">
          {recentLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw
                className="animate-spin text-gray-400 dark:text-gray-500"
                size={24}
              />
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                Loading recent jobs...
              </span>
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No recent jobs
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No jobs have been executed recently.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentJobs.map((job) => {
                const StatusIcon = getStatusIcon(job.status);
                return (
                  <div
                    key={job._id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`p-2 rounded-full ${getStatusColor(
                          job.status,
                        )}`}
                      >
                        <StatusIcon size={16} />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {job.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {job.status === 'running' && job.startedAt
                            ? `Started ${formatTimeAgo(job.startedAt)}`
                            : job.status === 'completed' && job.endedAt
                            ? `Completed ${formatTimeAgo(job.endedAt)}`
                            : job.status === 'failed' && job.endedAt
                            ? `Failed ${formatTimeAgo(job.endedAt)}`
                            : `Scheduled ${formatTimeAgo(job.scheduledAt)}`}
                        </p>
                        {job.metadata && job.metadata.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {job.metadata.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {(job.status === 'running' || job.progress > 0) && (
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`bg-blue-600 dark:bg-accent-dark h-2 rounded-full transition-all duration-300 ${
                              job.status === 'running' ? 'progress-running' : ''
                            }`}
                            style={{
                              width: `${formatProgress(job.progress)}%`,
                            }}
                          />
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            job.status,
                          )}`}
                        >
                          {job.status}
                        </span>
                        <button
                          onClick={() =>
                            navigate(
                              `/jobs/history/${encodeURIComponent(job.name)}`,
                            )
                          }
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-accent-dark"
                          title="View all runs of this job type"
                        >
                          <History size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
