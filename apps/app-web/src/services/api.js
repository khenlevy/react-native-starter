import { QueuedHttpClient } from '@buydy/cl-http-priority-queue-client';

// API Base URL
// Priority: Vite env var -> dev proxy relative path -> production relative path -> localhost fallback
const API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
    ? '/api/v1'
    : '/api/v1') ||
  'http://localhost:3001/api/v1';

// Custom API Error class
class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// Create global QueuedHttpClient instance with optimized settings for web UI
const apiClient = new QueuedHttpClient({
  baseURL: API_BASE_URL,
  timeout: 30000,
  maxConcurrency: 6, // Max 6 simultaneous requests (browser default)
  name: 'Stocks API',

  // Disable caching for web UI to ensure fresh data
  enableMemoryCache: false,
  enableLocalStorageCache: false,

  // Enable request deduplication for efficiency
  enableDeduplication: true,

  // Enable automatic retry with exponential backoff
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,

  // Request lifecycle callbacks
  onProgress: (completed, total) => {
    console.log(`[API] Progress: ${completed}/${total} requests completed`);
  },
  onRequestComplete: (_result, _index) => {
    const stats = apiClient.getStats();
    if (stats.totalRequests % 10 === 0) {
      // Log stats every 10 requests
      console.log('[API] Stats:', stats);
    }
  },
  onRequestError: (error, _index) => {
    console.error(`[API] Request failed:`, error.message);
  },
});

// Export the client for direct access if needed
export { apiClient };

/**
 * Helper function to handle API responses and errors
 */
async function handleApiRequest(requestPromise) {
  try {
    return await requestPromise;
  } catch (error) {
    // Handle axios errors
    if (error.response) {
      // Server responded with error status
      throw new ApiError(
        error.response.data?.error || `HTTP ${error.response.status}`,
        error.response.status,
        error.response.data,
      );
    } else if (error.request) {
      // Request was made but no response received
      throw new ApiError('Network error or server unavailable', 0, {
        originalError: error.message,
      });
    } else {
      // Something else happened
      throw new ApiError(error.message, 0, { originalError: error.message });
    }
  }
}

// Jobs API
export const jobsApi = {
  // Get all jobs with filtering and pagination
  getAll: async (params = {}) => {
    return handleApiRequest(
      apiClient.get('/jobs', {
        params,
        priority: 50, // Normal priority
      }),
    );
  },

  // Get job by ID
  getById: async (id) => {
    return handleApiRequest(
      apiClient.get(`/jobs/${id}`, {
        priority: 10, // High priority for single job view
      }),
    );
  },

  // Create new job
  create: async (jobData) => {
    return handleApiRequest(
      apiClient.post('/jobs', jobData, {
        priority: 5, // High priority for user actions
      }),
    );
  },

  // Update job
  update: async (id, updateData) => {
    return handleApiRequest(
      apiClient.put(`/jobs/${id}`, updateData, {
        priority: 5, // High priority for user actions
      }),
    );
  },

  // Delete job
  delete: async (id) => {
    return handleApiRequest(
      apiClient.delete(`/jobs/${id}`, {
        priority: 5, // High priority for user actions
      }),
    );
  },

  // Run job (create new job with same name and trigger execution)
  runJob: async (id) => {
    return handleApiRequest(
      apiClient.post(`/jobs/${id}/run`, null, {
        priority: 1, // Critical priority for job execution
        retry: true,
        maxRetries: 2,
      }),
    );
  },

  // Get job statistics
  getStats: async () => {
    return handleApiRequest(
      apiClient.get('/jobs/stats', {
        priority: 20, // Medium-high priority
      }),
    );
  },

  // Get recent jobs
  getRecent: async (limit = 20) => {
    return handleApiRequest(
      apiClient.get('/jobs/recent', {
        params: { limit },
        priority: 30,
      }),
    );
  },

  // Get running jobs
  getRunning: async () => {
    return handleApiRequest(
      apiClient.get('/jobs/running', {
        priority: 10, // High priority for real-time data
      }),
    );
  },

  // Get failed jobs
  getFailed: async (since = null) => {
    return handleApiRequest(
      apiClient.get('/jobs/failed', {
        params: since ? { since } : {},
        priority: 40,
      }),
    );
  },

  // Get job history
  getHistory: async (name, limit = 20) => {
    return handleApiRequest(
      apiClient.get(`/jobs/history/${encodeURIComponent(name)}`, {
        params: { limit },
        priority: 50,
      }),
    );
  },

  // Get jobs grouped by type/name
  getJobsByType: async (params = {}) => {
    return handleApiRequest(
      apiClient.get('/jobs/types', {
        params,
        priority: 50,
      }),
    );
  },

  // Get cycled list status
  getCycledListStatus: async () => {
    return handleApiRequest(
      apiClient.get('/jobs/cycled-list-status', {
        priority: 10, // High priority for real-time status
      }),
    );
  },

  // Pause cycled list manually
  pauseCycledList: async () => {
    return handleApiRequest(
      apiClient.post(
        '/jobs/cycled-list-status/pause',
        {},
        {
          priority: 10,
        },
      ),
    );
  },

  // Resume cycled list manually
  resumeCycledList: async () => {
    return handleApiRequest(
      apiClient.post(
        '/jobs/cycled-list-status/resume',
        {},
        {
          priority: 10,
        },
      ),
    );
  },
};

// Stocks API
export const stocksApi = {
  // Get heatmap data
  getHeatmap: async (params = {}) => {
    return handleApiRequest(
      apiClient.get('/stocks/heatmap', {
        params,
        priority: 1, // Critical priority for main feature
      }),
    );
  },

  // Get stock details
  getDetails: async (symbol) => {
    return handleApiRequest(
      apiClient.get(`/stocks/${symbol}`, {
        priority: 10,
      }),
    );
  },

  // Search stocks
  search: async (query) => {
    return handleApiRequest(
      apiClient.get('/stocks/search', {
        params: { q: query },
        priority: 5, // High priority for user search
      }),
    );
  },
};

// Health check
export const healthApi = {
  check: async () => {
    return handleApiRequest(
      apiClient.get('/health', {
        priority: 100, // Low priority
        retry: false, // Don't retry health checks
      }),
    );
  },
};

// Utility functions
export const apiUtils = {
  // Get current API statistics
  getStats: () => {
    return apiClient.getStats();
  },

  // Wait for all pending requests to complete
  waitForCompletion: async () => {
    return apiClient.waitForCompletion();
  },

  // Cancel all pending requests
  cancelAll: () => {
    apiClient.cancel();
  },
};

export { ApiError };
