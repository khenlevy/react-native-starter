import { useState, useEffect } from 'react';
import { apiUtils } from '../services/api';

/**
 * API Statistics Monitor Component
 * Displays real-time statistics for the QueuedHttpClient
 */
export function ApiStatsMonitor() {
  const [stats, setStats] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    // Update stats every second
    const interval = setInterval(() => {
      const currentStats = apiUtils.getStats();
      setStats(currentStats);
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors z-50"
      >
        Show API Stats
      </button>
    );
  }

  if (!stats) return null;

  const memoryCacheHitRate =
    stats.totalRequests > 0
      ? ((stats.memoryCacheHits / stats.totalRequests) * 100).toFixed(1)
      : 0;

  const localStorageCacheHitRate =
    stats.totalRequests > 0
      ? ((stats.localStorageCacheHits / stats.totalRequests) * 100).toFixed(1)
      : 0;

  const successRate =
    stats.totalRequests > 0
      ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)
      : 0;

  const deduplicationRate =
    stats.totalRequests > 0
      ? ((stats.deduplicatedRequests / stats.totalRequests) * 100).toFixed(1)
      : 0;

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 w-96 z-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          API Monitor
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Queue Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">Queue Status</span>
          <span className="text-green-600 font-semibold">
            {stats.queue.running} / {stats.queue.maxConcurrency || 6} Running
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Queued: {stats.queue.queued}</span>
          <span>•</span>
          <span>Completed: {stats.queue.completed}</span>
          <span>•</span>
          <span>Failed: {stats.queue.failed}</span>
        </div>
      </div>

      {/* Request Statistics */}
      <div className="space-y-2 mb-4">
        <StatRow
          label="Total Requests"
          value={stats.totalRequests}
          color="blue"
        />
        <StatRow
          label="Successful"
          value={stats.successfulRequests}
          badge={`${successRate}%`}
          color="green"
        />
        <StatRow label="Failed" value={stats.failedRequests} color="red" />
        <StatRow label="Retried" value={stats.retriedRequests} color="yellow" />
      </div>

      {/* Optimization Stats */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
        <StatRow
          label="Memory Cache"
          value={stats.memoryCacheHits}
          badge={`${memoryCacheHitRate}%`}
          color="purple"
        />
        <StatRow
          label="LS Cache"
          value={stats.localStorageCacheHits}
          badge={`${localStorageCacheHitRate}%`}
          color="indigo"
        />
        <StatRow
          label="Deduplicated"
          value={stats.deduplicatedRequests}
          badge={`${deduplicationRate}%`}
          color="cyan"
        />
      </div>

      {/* Cache Details */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
        <StatRow
          label="Memory Cache"
          value={`${stats.memoryCache?.size || 0} entries`}
          color="gray"
        />
        <StatRow
          label="LocalStorage"
          value={`${stats.localStorage?.entries || 0} / ${
            stats.localStorage?.maxEntries || 0
          }`}
          badge={
            stats.localStorage?.available
              ? `${stats.localStorage?.usage || 0}%`
              : 'N/A'
          }
          color="gray"
        />
        <StatRow label="Pending" value={stats.pendingRequests} color="gray" />
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => apiUtils.clearMemoryCache()}
            className="flex-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-3 py-1.5 rounded text-sm hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
            title="Clear in-memory cache only"
          >
            Clear Memory
          </button>
          <button
            onClick={() => apiUtils.clearLocalStorageCache()}
            className="flex-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded text-sm hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
            title="Clear localStorage cache only"
          >
            Clear LS
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => apiUtils.clearAllCaches()}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={() => apiUtils.cancelAll()}
            className="flex-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1.5 rounded text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, badge, color = 'gray' }) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    purple: 'text-purple-600 dark:text-purple-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    cyan: 'text-cyan-600 dark:text-cyan-400',
    gray: 'text-gray-600 dark:text-gray-400',
  };

  const badgeColorClasses = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    green:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    yellow:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    purple:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    indigo:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${colorClasses[color]}`}>{value}</span>
        {badge && (
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${badgeColorClasses[color]}`}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
