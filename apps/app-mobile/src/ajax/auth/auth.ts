import { apiClient } from '../axiosInstance';
import { ENDPOINTS } from '../endpointsConfig';

interface AuthResponse {
  token: string;
  user: {
    id: string;
    phone?: string;
    email?: string;
    name?: string;
  };
}

interface VerificationResponse {
  message: string;
  expires_at: string;
}

const authApi = {
  googleLogin: async (token: string): Promise<AuthResponse> => {
    try {
      const url = ENDPOINTS.AUTH.GOOGLE_LOGIN;
      return await apiClient.post<AuthResponse>(url, { token });
    } catch (error) {
      throw new Error('Google login failed');
    }
  },

  appleLogin: async (token: string): Promise<AuthResponse> => {
    try {
      const url = ENDPOINTS.AUTH.APPLE_LOGIN;
      return await apiClient.post<AuthResponse>(url, { token });
    } catch (error) {
      throw new Error('Apple login failed');
    }
  },

  phoneLogin: async (phone: string): Promise<VerificationResponse> => {
    try {
      const url = ENDPOINTS.AUTH.PHONE_LOGIN;
      return await apiClient.post<VerificationResponse>(url, { phone });
    } catch (error) {
      throw new Error('Phone login failed');
    }
  },

  verifyCode: async (phone: string, code: string): Promise<AuthResponse> => {
    try {
      const url = ENDPOINTS.AUTH.VERIFY_CODE;
      return await apiClient.post<AuthResponse>(url, { phone, code });
    } catch (error) {
      throw new Error('Code verification failed');
    }
  },
};

export { authApi }; 