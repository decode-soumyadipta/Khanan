export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface AOIGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][];
}

export interface AOIProperties {
  name?: string;
  description?: string;
  created_at: string;
  area_km2?: number;
}

export interface AOI {
  id: string;
  geometry: AOIGeometry;
  properties: AOIProperties;
  bounding_box: BoundingBox;
}

export type LoadingStep = 
  | 'idle'
  | 'validating'
  | 'connecting' 
  | 'requesting'
  | 'preprocessing'
  | 'processing'
  | 'completed';

export type AnalysisStatus = 
  | 'pending'
  | 'validating'
  | 'connecting'
  | 'requesting'
  | 'preprocessing'
  | 'processing'
  | 'completed'
  | 'failed';

export interface AnalysisJob {
  analysis_id: string;
  aoi_id: string;
  status: AnalysisStatus;
  progress: number;
  current_step?: string;
  estimated_completion?: string;
  results_url?: string;
}

export interface SearchLocation {
  name: string;
  coordinates: Coordinates;
  bounding_box?: BoundingBox;
  bbox?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  country?: string;
  admin_area?: string;
}

export interface FileUpload {
  file: File;
  type: 'kml' | 'geojson' | 'shapefile';
}