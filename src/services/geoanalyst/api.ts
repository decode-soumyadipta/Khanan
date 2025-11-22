// Geo-analyst API service (integrated with Python backend through Node.js proxy)
import axios from 'axios';
import type { Polygon, MultiPolygon } from 'geojson';
import { SearchLocation } from '@/types/geoanalyst';

// Use Node.js backend as proxy to Python
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes timeout for long-running analysis operations
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include credentials for auth
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`🌐 Geo-Analyst API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ Geo-Analyst API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  (error) => {
    console.error('❌ Geo-Analyst API Response Error:', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      code: error.code
    });
    
    // Provide user-friendly error messages
    if (error.code === 'ECONNABORTED') {
      error.userMessage = 'Request timed out. The analysis may be taking longer than expected.';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      error.userMessage = 'Lost connection to analysis service. Please check if the backend is running.';
    } else if (error.response?.status >= 500) {
      error.userMessage = 'Server error occurred. Please try again later.';
    } else if (error.response?.status === 404) {
      error.userMessage = 'Analysis not found. It may have been completed or cancelled.';
    }
    
    return Promise.reject(error);
  }
);

// Check backend connection
export const checkBackendConnection = async () => {
  try {
    const response = await api.get('/python/health', { timeout: 5000 });
    return {
      connected: true,
      message: 'Python backend is online',
      data: response.data
    };
  } catch (error: any) {
    return {
      connected: false,
      message: error.userMessage || 'Python backend connection failed'
    };
  }
};

// Create AOI
export const createAOI = async (geometry: any, properties: any) => {
  const response = await api.post('/python/aoi/create', {
    geometry,
    properties
  });
  return response.data;
};

// Start analysis
export const startAnalysis = async (aoiId: string, geometry?: Polygon | MultiPolygon) => {
  const payload: Record<string, unknown> = { aoi_id: aoiId };

  if (geometry) {
    payload.geometry = geometry;
  }

  const response = await api.post('/python/analysis/start', payload);
  return response.data;
};

// Get analysis status
export const getAnalysisStatus = async (analysisId: string) => {
  const response = await api.get(`/python/analysis/${analysisId}`);
  return response.data;
};

// Search location using Nominatim API
export const searchLocation = async (query: string): Promise<SearchLocation[]> => {
  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: query,
        format: 'json',
        limit: 5,
        addressdetails: 1
      },
      timeout: 10000
    });

    return response.data.map((result: any) => ({
      name: result.name || result.display_name.split(',')[0],
      displayName: result.display_name,
      coordinates: {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      },
      boundingBox: {
        south: parseFloat(result.boundingbox[0]),
        north: parseFloat(result.boundingbox[1]),
        west: parseFloat(result.boundingbox[2]),
        east: parseFloat(result.boundingbox[3])
      },
      type: result.type
    }));
  } catch (error) {
    console.error('Location search error:', error);
    throw error;
  }
};

export default api;
