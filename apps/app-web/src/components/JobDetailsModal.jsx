import { useNavigate } from 'react-router-dom';
import {
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Timer,
  FileText,
  Settings,
  RefreshCw,
  History,
  Minus,
} from 'lucide-react';
import { useJob } from '../hooks/useJobs';

const JobDetailsModal = ({ jobId, isOpen, onClose }) => {
  const navigate = useNavigate();
  const { job, loading, error, refetch } = useJob(jobId);

  if (!isOpen) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'status-running';
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'skipped':
        return 'text-gray-500 bg-gray-100 border border-gray-300';
      case 'scheduled':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
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

  const formatDuration = (startDate, endDate) => {
    if (!startDate) return 'N/A';
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Less than 1 minute';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  };

  const formatProgress = (progress) => {
    return Math.round((progress || 0) * 100);
  };

  const getLogLevelColor = (level) => {
    switch (level) {
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'warn':
        return 'text-yellow-600 bg-yellow-100';
      case 'info':
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-900">Job Details</h2>
            {job && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                  job.status,
                )}`}
              >
                {(() => {
                  const StatusIcon = getStatusIcon(job.status);
                  return <StatusIcon size={12} className="mr-1" />;
                })()}
                {job.status}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {job && (
              <button
                onClick={() => {
                  onClose();
                  navigate(`/jobs/history/${encodeURIComponent(job.name)}`);
                }}
                className="p-2 text-blue-400 hover:text-blue-600"
                title="View all runs of this job type"
              >
                <History size={16} />
              </button>
            )}
            <button
              onClick={refetch}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw
                className="animate-spin text-gray-400 mr-2"
                size={24}
              />
              <span className="text-gray-600">Loading job details...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <XCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Error loading job
              </h3>
              <p className="text-gray-600">{error}</p>
            </div>
          ) : job ? (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <FileText size={20} className="mr-2" />
                    Basic Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Job Name
                      </label>
                      <p className="text-sm text-gray-900">{job.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Status
                      </label>
                      <p className="text-sm text-gray-900 capitalize">
                        {job.status}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Progress
                      </label>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`bg-blue-600 h-2 rounded-full transition-all duration-300 ${
                              job.status === 'running' ? 'progress-running' : ''
                            }`}
                            style={{
                              width: `${formatProgress(job.progress)}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {formatProgress(job.progress)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Timer size={20} className="mr-2" />
                    Timing Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Scheduled At
                      </label>
                      <p className="text-sm text-gray-900">
                        {formatDate(job.scheduledAt)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Started At
                      </label>
                      <p className="text-sm text-gray-900">
                        {formatDate(job.startedAt)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Ended At
                      </label>
                      <p className="text-sm text-gray-900">
                        {formatDate(job.endedAt)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Duration
                      </label>
                      <p className="text-sm text-gray-900">
                        {formatDuration(job.startedAt, job.endedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Information */}
              {job.error && (
                <div className="card p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <XCircle size={20} className="mr-2 text-red-600" />
                    Error Information
                  </h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{job.error}</p>
                  </div>
                </div>
              )}

              {/* Result Information */}
              {job.result && (
                <div className="card p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <CheckCircle size={20} className="mr-2 text-green-600" />
                    Result Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                      {JSON.stringify(job.result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Metadata */}
              {job.metadata && Object.keys(job.metadata).length > 0 && (
                <div className="card p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Settings size={20} className="mr-2" />
                    Metadata
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                      {JSON.stringify(job.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Logs */}
              {job.logs && job.logs.length > 0 && (
                <div className="card p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <FileText size={20} className="mr-2" />
                    Execution Logs ({job.logs.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {job.logs.map((log, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLogLevelColor(
                            log.level,
                          )}`}
                        >
                          {log.level}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{log.msg}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(log.ts)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Job not found
              </h3>
              <p className="text-gray-600">
                The requested job could not be found.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobDetailsModal;
