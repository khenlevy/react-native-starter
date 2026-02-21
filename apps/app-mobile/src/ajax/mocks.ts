import { AxiosInstance } from 'axios';
import { ENDPOINTS } from './endpointsConfig';
import { MOCK_DATA } from './search/search.mock';

export const setupAxiosMocks = (client: AxiosInstance) => {
  client.interceptors.request.use(request => {
    const sharedResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      config: request,
    };

    const searchUrl = ENDPOINTS.SEARCH.SEARCH;
    const phoneLoginUrl = ENDPOINTS.AUTH.PHONE_LOGIN;
    const verifyCodeUrl = ENDPOINTS.AUTH.VERIFY_CODE;

    console.log(`[MOCK] Intercepted ${request.method?.toUpperCase()} ${request.url}`);

    if (request.url === searchUrl && request.method === 'get') {
      request.adapter = async () => {
        try {      
          const query = request.params?.query;
          if (!query) return {
            data: [],
            ...sharedResponse,
          };
        
          const normalizedQuery = query.toLowerCase();
          const results = MOCK_DATA.filter(
            item => 
              item.name.toLowerCase().includes(normalizedQuery) ||
              item.desc.toLowerCase().includes(normalizedQuery)
          );
          
          return {
            data: results,
            ...sharedResponse,
          };
        } catch (error) {
          console.error('Search failed:', error);
          throw new Error('Search failed');
        }
      };
    }

    if (request.url === phoneLoginUrl && request.method === 'post') {
      request.adapter = async () => {
        return {
          data: {
            message: 'Verification code sent successfully',
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
          },
          ...sharedResponse,
        };
      };
    }

    if(request.url === verifyCodeUrl && request.method === 'post') {
      request.adapter = async () => {
        return {
          data: {
            token: 'mock-jwt-token-123',
            user: {
              id: 'mock-user-id-123',
              phone: request.data?.phone,
            }
          },
          ...sharedResponse,
        };
      };
    }

    return request;
  });
};
