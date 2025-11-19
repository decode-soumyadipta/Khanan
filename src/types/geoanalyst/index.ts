// Geo-analyst specific types (from old frontend)

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

export interface SearchLocation {
  name: string;
  displayName: string;
  coordinates: Coordinates;
  boundingBox: BoundingBox;
  type: string;
}

export interface MineBlock {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][];
  };
  properties: {
    block_id: number;
    name: string;
    area_px: number;
    area_m2?: number;
    avg_confidence: number;
    label_position?: [number, number];
    crs?: string;
    pixel_coords?: number[][];
    is_merged?: boolean;
    source_blocks?: string[];
    spanning_tiles?: (string | number)[];
    contributing_details?: Array<{
      tile_id: string;
      tile_index: number | string;
      block_name: string;
      block_number: number | string;
      area_ha: number;
      confidence: number;
    }>;
  };
}

export interface TileData {
  id: string | number;
  tile_id?: string;  // Backend uses both id and tile_id
  index: number;
  row?: number;
  col?: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  bounds?: number[][];  // Array of [lon, lat] coordinates defining tile corners
  bands: string[];
  bands_used?: string[];  // Backend returns this
  cloudCoverage: number;
  cloud_coverage?: number;  // Backend returns this
  timestamp: string;
  size: string;
  status?: string;
  error?: string | null;
  miningDetected: boolean;
  mining_detected?: boolean;  // Backend returns this
  miningPercentage?: number;
  mining_percentage?: number;  // Backend returns this
  confidence: number;
  image_base64?: string;
  mine_blocks?: MineBlock[];
  num_mine_blocks?: number;
  total_area_m2?: number;
  mask_shape?: [number, number];
  probability_map_base64?: string;
}

export interface AnalysisData {
  analysis_id: string;
  aoi_id?: string;
  status: string;
  progress: number;
  current_step: string;
  message?: string;
  results_url?: string;
  tiles_fetched?: number;
  total_tiles?: number;
  ml_progress?: {
    current: number;
    total: number;
    currentTileId?: string;
  };
  tiles?: TileData[];
  imagery_data?: any;
  detections?: any[];
  detection_count?: number;
  area_km2?: number;
  merged_blocks?: any;
}
