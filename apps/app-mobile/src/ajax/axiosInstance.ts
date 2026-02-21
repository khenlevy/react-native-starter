import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { setupAxiosMocks } from './mocks';
import { URL_API, URL_DOMAIN, PORT_API, MOCK } from '@env';
import { registerApiInterceptors } from './interceptors/apiInterceptors';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = `${URL_DOMAIN}:${PORT_API}${URL_API}`;

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // ✅ Set up mock API if enabled
    if (MOCK === 'true') {
      setupAxiosMocks(this.client);
    }

    // ✅ Register API interceptors
    registerApiInterceptors(this.client);
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
