/**
 * Analysis History Service
 * Client-side API for managing analysis history records
 */

import apiClient from './apiClient';

export interface ProcessingLog {
  step: string;
  message: string;
  progress: number;
  timestamp: Date;
}

export interface TileResult {
  tileId: string;
  lat: number;
  lng: number;
  detectionCount: number;
  confidence: number;
  imageUrl?: string;
  mineBlocks?: any[];
}

export interface AnalysisResults {
  tiles: TileResult[];
  detections: any[];
  mergedBlocks: any;
  totalTiles: number;
  tilesProcessed: number;
  tilesWithMining: number;
  detectionCount: number;
  totalMiningArea?: {
    m2: number;
    hectares: number;
    km2: number;
  };
  statistics: {
    totalTiles: number;
    processedTiles: number;
    tilesWithDetections: number;
    totalDetections: number;
    averageConfidence: number;
    avgConfidence?: number;
    maxConfidence?: number;
    minConfidence?: number;
    coveragePercentage?: number;
  };
}

export interface AnalysisHistoryRecord {
  _id: string;
  analysisId: string;
  userId: string;
  aoiGeometry: any;
  aoiBounds?: any;
  aoiArea?: {
    km2: number;
    hectares: number;
  };
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  processingLogs: ProcessingLog[];
  results?: AnalysisResults;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  userNotes?: string;
  tags?: string[];
  isArchived: boolean;
  viewUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoryStats {
  totalAnalyses: number;
  completedAnalyses: number;
  failedAnalyses: number;
  processingAnalyses: number;
  averageDuration: number;
  totalDetections: number;
}

export interface HistoryListParams {
  page?: number;
  limit?: number;
  status?: 'processing' | 'completed' | 'failed' | 'cancelled';
  search?: string;
  sortBy?: 'startTime' | 'duration' | 'detectionCount';
  sortOrder?: 'asc' | 'desc';
}

export interface HistoryListResponse {
  analyses: AnalysisHistoryRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Get paginated list of analysis history
 */
export const getAnalysisHistory = async (
  params: HistoryListParams = {}
): Promise<HistoryListResponse> => {
  const response = await apiClient.get('/history', { params });
  return response.data;
};

/**
 * Get user statistics
 */
export const getAnalysisStats = async (): Promise<HistoryStats> => {
  const response = await apiClient.get('/history/stats');
  return response.data;
};

/**
 * Get single analysis record by ID
 */
export const getAnalysisById = async (
  analysisId: string,
  includeTileImages: boolean = false
): Promise<AnalysisHistoryRecord> => {
  const response = await apiClient.get(`/history/${analysisId}`, {
    params: { includeTileImages }
  });
  return response.data;
};

/**
 * Save completed analysis to database
 */
export const saveAnalysis = async (
  analysisData: {
    analysisId: string;
    aoiGeometry?: any;
    aoiBounds?: any;
    results: any;
    logs?: any[];
    metadata?: any;
    force?: boolean; // Allow force parameter to overwrite existing
  }
): Promise<{ message: string; analysisId: string; analysis: AnalysisHistoryRecord }> => {
  const response = await apiClient.post('/history', analysisData);
  return response.data;
};

/**
 * Update analysis notes and tags
 */
export const updateAnalysis = async (
  analysisId: string,
  updates: {
    userNotes?: string;
    tags?: string[];
    isArchived?: boolean;
  }
): Promise<AnalysisHistoryRecord> => {
  const response = await apiClient.put(`/history/${analysisId}`, updates);
  return response.data;
};

/**
 * Delete single analysis
 */
export const deleteAnalysis = async (analysisId: string): Promise<void> => {
  await apiClient.delete(`/history/${analysisId}`);
};

/**
 * Bulk delete analyses
 */
export const bulkDeleteAnalyses = async (analysisIds: string[]): Promise<{ deletedCount: number }> => {
  const response = await apiClient.post('/history/bulk-delete', { analysisIds });
  return response.data;
};

/**
 * Stop/Cancel an ongoing analysis
 */
export const stopAnalysis = async (analysisId: string): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post(`/python/analysis/${analysisId}/stop`);
  return response.data;
};

export default {
  getAnalysisHistory,
  getAnalysisStats,
  getAnalysisById,
  saveAnalysis,
  updateAnalysis,
  deleteAnalysis,
  bulkDeleteAnalyses,
  stopAnalysis
};
