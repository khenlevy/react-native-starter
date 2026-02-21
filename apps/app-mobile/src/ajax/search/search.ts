import { apiClient } from '../axiosInstance';
import { ENDPOINTS } from '../endpointsConfig';

export type SearchResultType = 'business' | 'gift_card' | 'coupon';

export interface SearchResult {
  id: string;
  name: string;
  desc: string;
  type: SearchResultType;
}

const searchApi = {
  searchItems: async (query: string): Promise<SearchResult[]> => {
    try {
      return await apiClient.get<SearchResult[]>(ENDPOINTS.SEARCH.SEARCH, { params: { query } });
    } catch (error) {
      throw new Error('Search results failed');
    }
  }
};

export { searchApi }; 