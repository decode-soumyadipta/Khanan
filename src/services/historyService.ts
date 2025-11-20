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

export interface AnalysisResults {
  tiles: any[];
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
  summary?: {
    total_tiles?: number;
    tiles_with_detections?: number;
    mine_block_count?: number;
    mining_percentage?: number;
    mining_area_m2?: number;
    confidence?: number;
    [key: string]: unknown;
  };
  blockTracking?: {
    summary?: {
      total?: number;
      withPersistentIds?: number;
    };
    blocks: any[];
  };
}

export interface QuantitativeVisualizationGrid {
  x: number[];
  y: number[];
  elevation: (number | null)[][];
  depth: (number | null)[][];
  rimElevation?: number | null;
  resolutionX?: number | null;
  resolutionY?: number | null;
  unit?: string;
}

export interface QuantitativeBlockVisualization {
  grid?: QuantitativeVisualizationGrid;
  stats?: Record<string, any> | null;
  extentUTM?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface QuantitativeBlockRecord {
  blockId: string;
  blockLabel: string;
  persistentId?: string | null;
  source?: string | null;
  areaSquareMeters?: number | null;
  areaHectares?: number | null;
  rimElevationMeters?: number | null;
  maxDepthMeters?: number | null;
  meanDepthMeters?: number | null;
  medianDepthMeters?: number | null;
  volumeCubicMeters?: number | null;
  volumeTrapezoidalCubicMeters?: number | null;
  pixelCount?: number | null;
  centroid?: {
    lon: number;
    lat: number;
  } | null;
  visualization?: QuantitativeBlockVisualization | null;
  computedAt?: string | Date | null;
}

export interface QuantitativeAnalysisSnapshot {
  status?: string;
  executedAt?: string | Date;
  steps?: Array<{
    name: string;
    status: string;
    durationMs?: number | null;
    details?: string[];
  }>;
  summary?: Record<string, any>;
  executiveSummary?: Record<string, any>;
  blocks?: QuantitativeBlockRecord[];
  dem?: Record<string, any>;
  source?: Record<string, any>;
  metadata?: Record<string, any>;
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
  quantitativeAnalysis?: QuantitativeAnalysisSnapshot;
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

export const saveQuantitativeAnalysis = async (
  analysisId: string,
  quantitativeData: QuantitativeAnalysisSnapshot
): Promise<{ message: string; analysisId: string; quantitativeAnalysis: QuantitativeAnalysisSnapshot }> => {
  const response = await apiClient.put(`/history/${analysisId}/quantitative`, quantitativeData);
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
export interface DeleteAnalysisResult {
  deleted: boolean;
  notFound?: boolean;
}

export const deleteAnalysis = async (analysisId: string): Promise<DeleteAnalysisResult> => {
  try {
    await apiClient.delete(`/history/${analysisId}`);
    return { deleted: true };
  } catch (error: any) {
    if (error?.status === 404) {
      console.warn(`⚠️ Analysis ${analysisId} already missing, treating as deleted.`);
      return { deleted: false, notFound: true };
    }
    throw error;
  }
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
  saveQuantitativeAnalysis,
  updateAnalysis,
  deleteAnalysis,
  bulkDeleteAnalyses,
  stopAnalysis
};
