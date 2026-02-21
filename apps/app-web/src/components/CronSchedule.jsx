import { useState, useEffect } from 'react';
import { Clock, Info, ChevronDown, ChevronUp } from 'lucide-react';
import {
  parseCronExpression,
  getNextRunTime,
  formatTimeUntilNext,
} from '../utils/cronUtils';

const CronSchedule = ({ schedule, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [nextRun, setNextRun] = useState(null);
  const [timeUntilNext, setTimeUntilNext] = useState('');

  useEffect(() => {
    if (schedule) {
      const nextRunTime = getNextRunTime(schedule.cron);
      setNextRun(nextRunTime);

      // Update time until next run every minute
      const updateTime = () => {
        setTimeUntilNext(formatTimeUntilNext(nextRunTime));
      };

      updateTime();
      const interval = setInterval(updateTime, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [schedule]);

  if (!schedule) {
    return (
      <div className={`text-xs text-gray-500 ${className}`}>
        <Info size={12} className="inline mr-1" />
        Schedule not defined
      </div>
    );
  }

  const cronInfo = parseCronExpression(schedule.cron);

  return (
    <div className={`${className}`}>
      <div
        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Clock size={14} className="text-gray-400" />
        <div className="flex-1">
          <div className="text-xs font-medium text-gray-700">
            {cronInfo.description}
          </div>
          {nextRun && (
            <div className="text-xs text-gray-500">Next: {timeUntilNext}</div>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={14} className="text-gray-400" />
        ) : (
          <ChevronDown size={14} className="text-gray-400" />
        )}
      </div>

      {isExpanded && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">
                Cron Expression:
              </span>
              <code className="text-xs bg-white px-2 py-1 rounded border font-mono">
                {schedule.cron}
              </code>
            </div>

            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-gray-600">
                Description:
              </span>
              <span className="text-xs text-gray-700 text-right max-w-xs">
                {schedule.description}
              </span>
            </div>

            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-gray-600">
                Dependencies:
              </span>
              <span className="text-xs text-gray-700 text-right max-w-xs">
                {schedule.dependencies}
              </span>
            </div>

            {nextRun && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">
                  Next Run:
                </span>
                <div className="text-xs text-gray-700 text-right">
                  <div>{nextRun.toLocaleString()}</div>
                  <div className="text-blue-600">{timeUntilNext}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CronSchedule;
