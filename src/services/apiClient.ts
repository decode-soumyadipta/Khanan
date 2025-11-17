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

// Create axios instance with cookies enabled
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
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
    
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
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

    console.error(`❌ API Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);

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
        
        // Don't redirect here - let the component handle it
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
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