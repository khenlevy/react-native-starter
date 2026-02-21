import mockStocksService from './mockStocksService';

const API_BASE_URL = 'http://localhost:3001/api/v1';

class StocksService {
  async getLargeCapStocks(params = {}) {
    try {
      const queryParams = new URLSearchParams();

      // Add all parameters to query string
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value);
        }
      });

      const response = await fetch(
        `${API_BASE_URL}/stocks/large-cap?${queryParams}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.warn('API not available, using mock data:', error.message);
      return mockStocksService.getLargeCapStocks(params);
    }
  }

  async getFilterOptions() {
    try {
      const response = await fetch(`${API_BASE_URL}/stocks/large-cap/filters`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.warn('API not available, using mock data:', error.message);
      return mockStocksService.getFilterOptions();
    }
  }

  async getAutocompleteSuggestions(query) {
    if (!query || query.length < 2) {
      return { data: { suggestions: [] } };
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/stocks/autocomplete?q=${encodeURIComponent(query)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.warn('API not available, using mock data:', error.message);
      return mockStocksService.getAutocompleteSuggestions(query);
    }
  }

  async getStockStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/stocks/large-cap/stats`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.warn('API not available, using mock data:', error.message);
      return mockStocksService.getStockStats();
    }
  }
}

export default new StocksService();
