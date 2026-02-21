import axios from "axios";

let singletonInstance = null;

function createAxiosInstance({ baseURL, timeout = 30000, defaultParams = {}, headers = {}, axiosConfig = {} } = {}) {
  const instance = axios.create({
    baseURL,
    timeout,
    headers,
    params: {
      ...defaultParams,
    },
    ...axiosConfig,
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(error)
  );

  return instance;
}

export function getHttpClientSingleton(options = {}) {
  if (!singletonInstance) {
    singletonInstance = createAxiosInstance(options);
  }
  return singletonInstance;
}

export function createHttpClient(options = {}) {
  return createAxiosInstance(options);
}

export default {
  getHttpClientSingleton,
  createHttpClient,
};


