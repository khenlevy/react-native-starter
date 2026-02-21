import { useState, useEffect, useCallback } from 'react';
import { jobsApi } from '../services/api';

// Custom hook for jobs data management
export const useJobs = (initialParams = {}) => {
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJobs = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);

      try {
        const response = await jobsApi.getAll({ ...initialParams, ...params });
        setJobs(response.jobs || []);
        setPagination(response.pagination || null);
      } catch (err) {
        setError(err.message);
        setJobs([]);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [initialParams],
  );

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    pagination,
    loading,
    error,
    refetch: fetchJobs,
  };
};

// Hook for job statistics
export const useJobStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await jobsApi.getStats();
      setStats(response);
    } catch (err) {
      setError(err.message);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
};

// Hook for running jobs (for real-time updates)
export const useRunningJobs = (interval = 5000) => {
  const [runningJobs, setRunningJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRunningJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await jobsApi.getRunning();
      setRunningJobs(response.jobs || []);
    } catch (err) {
      setError(err.message);
      setRunningJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRunningJobs();

    const intervalId = setInterval(fetchRunningJobs, interval);

    return () => clearInterval(intervalId);
  }, [fetchRunningJobs, interval]);

  return {
    runningJobs,
    loading,
    error,
    refetch: fetchRunningJobs,
  };
};

// Hook for recent jobs
export const useRecentJobs = (limit = 20) => {
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRecentJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await jobsApi.getRecent(limit);
      setRecentJobs(response.jobs || []);
    } catch (err) {
      setError(err.message);
      setRecentJobs([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchRecentJobs();
  }, [fetchRecentJobs]);

  return {
    recentJobs,
    loading,
    error,
    refetch: fetchRecentJobs,
  };
};

// Hook for single job
export const useJob = (id) => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJob = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await jobsApi.getById(id);
      setJob(response.job);
    } catch (err) {
      setError(err.message);
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  return {
    job,
    loading,
    error,
    refetch: fetchJob,
  };
};

// Hook for job history
export const useJobHistory = (jobName, limit = 50) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJobHistory = useCallback(async () => {
    if (!jobName) return;

    setLoading(true);
    setError(null);

    try {
      const response = await jobsApi.getHistory(jobName, limit);
      setJobs(response.jobs || []);
    } catch (err) {
      setError(err.message);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [jobName, limit]);

  useEffect(() => {
    fetchJobHistory();
  }, [fetchJobHistory]);

  // Set up polling every 5 seconds for real-time updates (only for running jobs)
  useEffect(() => {
    if (!jobName) return;

    const interval = setInterval(() => {
      // Only poll if there are running jobs to avoid unnecessary requests
      const hasRunningJobs = jobs.some((job) => job.status === 'running');

      if (hasRunningJobs) {
        fetchJobHistory();
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [fetchJobHistory, jobName, jobs]);

  return {
    jobs,
    loading,
    error,
    refetch: fetchJobHistory,
  };
};

// Hook for jobs grouped by type
export const useJobsByType = (params = {}) => {
  const [jobTypes, setJobTypes] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchJobsByType = useCallback(async (queryParams) => {
    setLoading(true);
    setError(null);

    try {
      const response = await jobsApi.getJobsByType(queryParams);
      setJobTypes(response.jobTypes || []);
      setPagination(response.pagination);
    } catch (err) {
      setError(err.message);
      setJobTypes([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array is correct - this function doesn't depend on any external values

  useEffect(() => {
    fetchJobsByType(params);
  }, [fetchJobsByType, params]); // Include fetchJobsByType and params

  // Set up polling every 5 seconds for real-time updates (only for running jobs)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only poll if there are running jobs to avoid unnecessary requests
      const hasRunningJobs = jobTypes.some(
        (jobType) =>
          jobType.latestJob?.status === 'running' || jobType.runningCount > 0,
      );

      if (hasRunningJobs) {
        fetchJobsByType(params);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jobTypes omitted to prevent infinite loop
  }, [fetchJobsByType, params]);

  return {
    jobTypes,
    pagination,
    loading,
    error,
    refetch: () => fetchJobsByType(params),
  };
};
