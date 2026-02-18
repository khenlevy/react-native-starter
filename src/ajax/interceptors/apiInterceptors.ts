import { ENV } from '@env';
import { AxiosInstance } from 'axios';

export function registerApiInterceptors(client: AxiosInstance) {
  if (ENV !== 'production') {
    client.interceptors.request.use(request => {
      console.log('➡️ [API Request]', {
        method: request.method,
        url: `${request.baseURL || ''}${request.url}`,
        data: request.data,
        headers: request.headers,
      });
      return request;
    });

    client.interceptors.response.use(
      response => {
        console.log('✅ [API Response]', {
          url: `${response.config.baseURL || ''}${response.config.url}`,
          status: response.status,
          data: response.data,
        });
        return response;
      },
      error => {
        console.log('❌ [API Error]', {
          url: error.config?.url,
          message: error.message,
          response: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }
} 