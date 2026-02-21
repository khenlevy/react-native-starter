// API service for EODHD Usage tracking
const API_BASE_URL = 'http://localhost:3001/api/v1';

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  console.log(`🌐 Making API request to: ${url}`);

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    console.log(`📡 API Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ API Error:`, errorData);
      throw new ApiError(
        errorData.error || `HTTP ${response.status}`,
        response.status,
        errorData,
      );
    }

    const data = await response.json();
    console.log(`✅ API Success:`, data);
    return data;
  } catch (error) {
    console.error(`💥 API Request Failed:`, error);
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or other errors
    throw new ApiError('Network error or server unavailable', 0, {
      originalError: error.message,
    });
  }
}

// EODHD Usage API
export const eodhdUsageApi = {
  // Get usage statistics
  getStats: async (params = {}) => {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const endpoint = `/eodhd-usage/stats${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;
    return apiRequest(endpoint);
  },

  // Get endpoint-specific statistics
  getEndpointStats: async (params = {}) => {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const endpoint = `/eodhd-usage/endpoints${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;
    return apiRequest(endpoint);
  },

  // Get recent usage records
  getRecentUsage: async (params = {}) => {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const endpoint = `/eodhd-usage/recent${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;
    return apiRequest(endpoint);
  },

  // Get available endpoints for filtering
  getAvailableEndpoints: async () => {
    return apiRequest('/eodhd-usage/available-endpoints');
  },

  // Get available job names for filtering
  getAvailableJobs: async () => {
    return apiRequest('/eodhd-usage/available-jobs');
  },

  // Get endpoint types with categories
  getEndpointTypes: async () => {
    return apiRequest('/eodhd-usage/endpoint-types');
  },

  // Get usage trends over time
  getUsageTrends: async (params = {}) => {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const endpoint = `/eodhd-usage/trends${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;
    return apiRequest(endpoint);
  },

  // Delete old usage records
  deleteOldRecords: async (olderThan = 30) => {
    return apiRequest(`/eodhd-usage/cleanup?olderThan=${olderThan}`, {
      method: 'DELETE',
    });
  },
};

export { ApiError };
