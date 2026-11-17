// ─────────────────────────────────────────────
//  FeeVault Parent App — API Client
//  Connected directly to Render Production API
// ─────────────────────────────────────────────

import axios from 'axios';

export const API_BASE_URL = 'https://feevault-backend.onrender.com/api/v1';

// In-memory token cache for authenticated requests
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Auto-attach bearer token to every request
apiClient.interceptors.request.use(
  async (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      authToken = null;
    }
    return Promise.reject(error);
  },
);

export default apiClient;
