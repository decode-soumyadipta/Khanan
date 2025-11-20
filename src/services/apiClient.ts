// services/apiClient.ts
import axios from "axios";

// Track if token refresh is in progress
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any | null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

// Log API URL configuration for debugging
const DEFAULT_API_URL = 'https://khananapi.jambagrad.com/api';
const apiBaseURL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
console.log('📍 API Base URL:', apiBaseURL);

// Create axios instance with cookies enabled
const apiClient = axios.create({
  baseURL: apiBaseURL,
  timeout: 30000,
  withCredentials: true, // This sends cookies automatically
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp for GET requests to prevent caching
    if (config.method === "get") {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }
    
    // If data is FormData, let browser set Content-Type header automatically
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Only log non-401 errors, or 401 errors from non-auth/analysis endpoints
    // 401 on auth endpoints is expected when user is not logged in
    // 401 on analysis endpoints is expected to trigger token refresh
    const isAuthEndpoint = error.config?.url?.includes('/auth/');
    const isAnalysisEndpoint = error.config?.url?.includes('/python/analysis/');
    const is401 = error.response?.status === 401;
    
    if (!is401 || (!isAuthEndpoint && !isAnalysisEndpoint)) {
      console.error(`❌ API Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
    }

    // Handle 401 errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('🔄 Token expired, attempting refresh...');
      
      if (isRefreshing) {
        // If refresh is already in progress, add to queue
        console.log('⏳ Refresh in progress, queuing request...');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        console.log('🔄 Refreshing token...');
        await apiClient.post('/auth/refresh-token', {}, { withCredentials: true });
        
        console.log('✅ Token refreshed successfully');
        // Process queued requests
        processQueue(null);
        
        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        // Refresh failed - clear queue and don't redirect immediately
        processQueue(refreshError);
        
        // Clear cookies
        if (typeof document !== 'undefined') {
          document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';
          document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';
        }
        
        // Dispatch auth expired event to notify AuthContext
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        
        // Don't redirect here - let the component handle it
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 429 (Too Many Requests) with exponential backoff
    if (error.response?.status === 429 && !originalRequest._retryCount) {
      originalRequest._retryCount = originalRequest._retryCount || 0;
      
      if (originalRequest._retryCount < 3) {
        originalRequest._retryCount += 1;
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, originalRequest._retryCount - 1) * 1000;
        
        console.log(`⏱️ Rate limited, retrying in ${delay}ms (attempt ${originalRequest._retryCount}/3)`);
        
        return new Promise((resolve) => setTimeout(resolve, delay))
          .then(() => apiClient(originalRequest));
      }
    }

    // Handle other errors
    const message = error.response?.data?.message || 
                   error.response?.data?.error?.message || 
                   error.message || 
                   'An unexpected error occurred';
    
    return Promise.reject({
      message,
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);

export default apiClient;