// Cron expression parser and human-readable converter
export const parseCronExpression = (cronExpr) => {
  const parts = cronExpr.split(' ');
  if (parts.length !== 5) {
    return { error: 'Invalid cron expression' };
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Parse the expression
  const result = {
    minute: minute,
    hour: hour,
    dayOfMonth: dayOfMonth,
    month: month,
    dayOfWeek: dayOfWeek,
    description: '',
    nextRun: null,
  };

  // Generate human-readable description
  if (dayOfWeek === '0' && hour === '5' && minute === '0') {
    result.description = 'Every Sunday at 05:00 UTC';
  } else if (dayOfWeek === '*' && hour === '6' && minute === '0') {
    result.description = 'Daily at 06:00 UTC';
  } else if (dayOfWeek === '*' && hour === '6' && minute === '30') {
    result.description = 'Daily at 06:30 UTC';
  } else if (dayOfWeek === '*' && hour === '7' && minute === '0') {
    result.description = 'Daily at 07:00 UTC';
  } else if (dayOfWeek === '*' && hour === '7' && minute === '30') {
    result.description = 'Daily at 07:30 UTC';
  } else if (dayOfWeek === '*' && hour === '8' && minute === '0') {
    result.description = 'Daily at 08:00 UTC';
  } else {
    // Generic parser
    let desc = '';

    if (dayOfWeek !== '*') {
      const days = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      desc = `Every ${days[parseInt(dayOfWeek)]}`;
    } else {
      desc = 'Daily';
    }

    desc += ` at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')} UTC`;
    result.description = desc;
  }

  return result;
};

// Calculate next run time (simplified)
export const getNextRunTime = (cronExpr) => {
  const now = new Date();
  const parts = cronExpr.split(' ');
  const [minute, hour, , , dayOfWeek] = parts;

  // Simple calculation for common patterns
  if (dayOfWeek === '0' && hour === '5' && minute === '0') {
    // Sunday 05:00 UTC
    const nextSunday = new Date(now);
    const daysUntilSunday = (7 - now.getDay()) % 7;
    nextSunday.setDate(
      now.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday),
    );
    nextSunday.setHours(5, 0, 0, 0);
    return nextSunday;
  } else if (dayOfWeek === '*' && hour && minute) {
    // Daily schedule
    const nextRun = new Date(now);
    nextRun.setHours(parseInt(hour), parseInt(minute), 0, 0);

    // If time has passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }

  return null;
};

// Note: Job schedules are now provided by the API from the centralized job types system
// This eliminates the need for hardcoded schedule definitions in the frontend

// Format time until next run
export const formatTimeUntilNext = (nextRun) => {
  if (!nextRun) return 'Unknown';

  const now = new Date();
  const diffMs = nextRun - now;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Starting soon';
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  return `in ${diffDays}d`;
};
