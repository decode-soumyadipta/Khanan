"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import dynamic from 'next/dynamic';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  ArrowBack,
  Autorenew,
  CheckCircleOutline,
  ErrorOutline,
  Pending,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAnalysisById,
  saveQuantitativeAnalysis,
} from '@/services/historyService';
import type {
  AnalysisHistoryRecord,
  QuantitativeAnalysisSnapshot,
  QuantitativeBlockRecord,
} from '@/services/historyService';
import {
  deriveConfidenceMetrics,
  deriveTileAreaMetrics,
  normalizeConfidenceValue,
  parseNumeric,
} from '@/lib/analysisMetrics';
import { MineBlockTable } from '@/components/geoanalyst/MineBlockTable';

const GoldenText = styled(Typography)({
  background: 'linear-gradient(to right, #fbbf24, #fcd34d, #fbbf24)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 2px 4px rgba(251, 191, 36, 0.3))',
});

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const PYTHON_API_BASE = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

const Plot = dynamic<any>(() => import('react-plotly.js'), { ssr: false });
const plotConfig = { displayModeBar: false, responsive: true } as const;

const formatNumber = (value: number | null | undefined, fractionDigits = 2): string => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--';
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) {
    return '--';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString();
};

const formatDurationMs = (value?: number | null): string => {
  if (!value || !Number.isFinite(value)) {
    return '--';
  }
  if (value < 1000) {
    return `${value.toFixed(0)} ms`;
  }
  const seconds = value / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining.toFixed(1)}s`;
};

const formatVolume = (value?: number | null): string => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--';
  }

  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)} km³`;
  }
  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)} Mm³`;
  }
  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(2)}k m³`;
  }
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} m³`;
};

const firstNumeric = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    const parsed = parseNumeric(value);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
};

interface MineBlockRow {
  id: string;
  label: string;
  tileId: string;
  areaHa: number;
  confidencePct: number | null;
  source: 'Merged' | 'Tile';
  isMerged?: boolean;
  persistentId?: string;
  blockIndex?: number;
  centroidLat?: number;
  centroidLon?: number;
  bounds?: [number, number, number, number];
  rimElevationMeters?: number | null;
  maxDepthMeters?: number | null;
  meanDepthMeters?: number | null;
  volumeCubicMeters?: number | null;
}

interface QuantitativeStep {
  name: string;
  status: 'completed' | 'failed';
  durationMs: number;
  details: string[];
}

interface QuantitativeVisualizationGridNormalized {
  x: number[];
  y: number[];
  elevation: (number | null)[][];
  depth: (number | null)[][];
  rimElevation?: number | null;
  resolutionX?: number | null;
  resolutionY?: number | null;
  unit?: string;
}

interface QuantitativeBlockVisualizationNormalized {
  grid?: QuantitativeVisualizationGridNormalized | null;
  stats?: Record<string, any> | null;
  extentUTM?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

interface QuantitativeBlockMetric {
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
  visualization?: QuantitativeBlockVisualizationNormalized | null;
  computedAt?: string | null;
}

interface QuantitativeSummary {
  totalVolumeCubicMeters: number;
  totalAreaSquareMeters: number;
  totalAreaHectares?: number;
  averageMaxDepthMeters: number;
  averageMeanDepthMeters?: number | null;
  blockCount?: number;
  deepestBlock?: {
    label: string;
    maxDepthMeters: number;
    volumeCubicMeters: number;
  } | null;
  largestBlock?: {
    label: string;
    volumeCubicMeters: number;
    areaHectares?: number | null;
  } | null;
}

interface QuantitativeExecutiveSummary {
  headline?: {
    totalVolumeCubicMeters?: number;
    totalAreaHectares?: number;
    blockCount?: number;
  };
  priorityBlocks?: Array<{
    label?: string;
    blockId?: string;
    source?: string;
    volumeCubicMeters?: number;
    maxDepthMeters?: number;
    areaHectares?: number;
  }>;
  insights?: {
    averageMeanDepthMeters?: number;
    averageMaxDepthMeters?: number;
    deepestBlock?: {
      label?: string;
      maxDepthMeters?: number;
    };
    largestBlock?: {
      label?: string;
      volumeCubicMeters?: number;
    };
  };
  policyFlags?: Record<string, any>;
  updatedAt?: string;
}

interface QuantitativeResponse {
  analysisId: string;
  status: string;
  blockCount: number;
  steps: QuantitativeStep[];
  summary: QuantitativeSummary;
  executiveSummary?: QuantitativeExecutiveSummary | null;
  blocks: QuantitativeBlockMetric[];
  dem?: {
    crs: string;
    resolutionMeters: number;
    tileCount: number;
    boundsUTM: [number, number, number, number];
    boundsWGS84: [number, number, number, number];
  };
  source?: {
    blockCollection?: string;
  };
  metadata?: Record<string, any>;
  executedAt?: string | null;
  isPersisted?: boolean;
}

const toNumberOrNull = (value: any): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNumber = (value: any, fallback = 0): number => {
  const parsed = toNumberOrNull(value);
  return parsed ?? fallback;
};

const toDateISOString = (value: any): string | null => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeAxisArray = (input: any): number[] => {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((value) => toNumber(value, 0));
};

const normalizeMatrix = (input: any): (number | null)[][] => {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((row) => (
    Array.isArray(row)
      ? row.map((value) => toNumberOrNull(value))
      : []
  ));
};

const normalizeBlockVisualization = (raw: any): QuantitativeBlockVisualizationNormalized | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const gridRaw = raw.grid;
  const grid = gridRaw && typeof gridRaw === 'object'
    ? {
        x: normalizeAxisArray(gridRaw.x),
        y: normalizeAxisArray(gridRaw.y),
        elevation: normalizeMatrix(gridRaw.elevation),
        depth: normalizeMatrix(gridRaw.depth),
        rimElevation: toNumberOrNull(gridRaw.rimElevation),
        resolutionX: toNumberOrNull(gridRaw.resolutionX),
        resolutionY: toNumberOrNull(gridRaw.resolutionY),
        unit: typeof gridRaw.unit === 'string' ? gridRaw.unit : 'meters',
      }
    : null;

  return {
    grid,
    stats: raw.stats ?? null,
    extentUTM: raw.extentUTM ?? null,
    metadata: raw.metadata ?? null,
  };
};

const normalizeSummary = (summary: any): QuantitativeSummary => {
  if (!summary || typeof summary !== 'object') {
    return {
      totalVolumeCubicMeters: 0,
      totalAreaSquareMeters: 0,
      averageMaxDepthMeters: 0,
    };
  }

  const deepest = summary.deepestBlock;
  const largest = summary.largestBlock;

  return {
    totalVolumeCubicMeters: toNumber(summary.totalVolumeCubicMeters, 0),
    totalAreaSquareMeters: toNumber(summary.totalAreaSquareMeters, 0),
    totalAreaHectares: toNumber(summary.totalAreaHectares, toNumber(summary.totalAreaSquareMeters, 0) / 10_000),
    averageMaxDepthMeters: toNumber(summary.averageMaxDepthMeters, 0),
    averageMeanDepthMeters: toNumberOrNull(summary.averageMeanDepthMeters ?? summary.averageMeanDepth),
    blockCount: typeof summary.blockCount === 'number' ? summary.blockCount : undefined,
    deepestBlock: deepest && typeof deepest === 'object'
      ? {
          label: typeof deepest.label === 'string' ? deepest.label : 'Deepest Block',
          maxDepthMeters: toNumber(deepest.maxDepthMeters, 0),
          volumeCubicMeters: toNumber(deepest.volumeCubicMeters, 0),
        }
      : null,
    largestBlock: largest && typeof largest === 'object'
      ? {
          label: typeof largest.label === 'string' ? largest.label : 'Largest Block',
          volumeCubicMeters: toNumber(largest.volumeCubicMeters, 0),
          areaHectares: toNumberOrNull(largest.areaHectares),
        }
      : null,
  };
};

const normalizeBlock = (block: any): QuantitativeBlockMetric => {
  const label = block?.blockLabel || block?.label || block?.block_id || 'Mine Block';
  const blockId = block?.blockId || block?.block_id || label;

  return {
    blockId,
    blockLabel: label,
    persistentId: block?.persistentId ?? block?.persistent_id ?? null,
    source: block?.source ?? null,
    areaSquareMeters: toNumberOrNull(block?.areaSquareMeters ?? block?.area_sq_m),
    areaHectares: toNumberOrNull(block?.areaHectares ?? block?.area_ha ?? (block?.areaSquareMeters ? block.areaSquareMeters / 10_000 : null)),
    rimElevationMeters: toNumberOrNull(block?.rimElevationMeters ?? block?.rim_elevation),
    maxDepthMeters: toNumberOrNull(block?.maxDepthMeters ?? block?.max_depth),
    meanDepthMeters: toNumberOrNull(block?.meanDepthMeters ?? block?.mean_depth),
    medianDepthMeters: toNumberOrNull(block?.medianDepthMeters ?? block?.median_depth),
    volumeCubicMeters: toNumberOrNull(block?.volumeCubicMeters ?? block?.volume_m3),
    volumeTrapezoidalCubicMeters: toNumberOrNull(block?.volumeTrapezoidalCubicMeters ?? block?.volume_trapezoidal),
    pixelCount: typeof block?.pixelCount === 'number' ? block.pixelCount : toNumberOrNull(block?.pixels) ?? null,
    centroid: block?.centroid && typeof block.centroid === 'object'
      ? {
          lon: toNumber(block.centroid.lon, 0),
          lat: toNumber(block.centroid.lat, 0),
        }
      : null,
    visualization: normalizeBlockVisualization(block?.visualization),
    computedAt: toDateISOString(block?.computedAt ?? block?.computed_at),
  };
};

const normalizeSteps = (steps: any): QuantitativeStep[] => {
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps.map((step) => ({
    name: typeof step?.name === 'string' ? step.name : 'Processing Step',
    status: step?.status === 'failed' ? 'failed' : 'completed',
    durationMs: toNumber(step?.durationMs ?? step?.duration_ms, 0),
    details: Array.isArray(step?.details)
      ? step.details.slice(0, 25).map((detail: unknown) => String(detail))
      : [],
  }));
};

const normalizeQuantitativeResponse = (
  analysisId: string,
  payload: any,
  persisted: boolean,
): QuantitativeResponse => {
  const blocksRaw = Array.isArray(payload?.blocks) ? payload.blocks : [];
  const blocks = blocksRaw.map(normalizeBlock);

  const summary = normalizeSummary(payload?.summary);
  if (!summary.blockCount) {
    summary.blockCount = blocks.length;
  }

  const executedAt = toDateISOString(payload?.executedAt ?? payload?.metadata?.generatedAt);
  const rawMetadata = payload?.metadata;
  const metadata = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
    ? rawMetadata
    : {};

  return {
    analysisId,
    status: typeof payload?.status === 'string' ? payload.status : 'completed',
    blockCount: typeof payload?.blockCount === 'number' ? payload.blockCount : blocks.length,
    steps: normalizeSteps(payload?.steps),
    summary,
    executiveSummary: payload?.executiveSummary ?? null,
    blocks,
    dem: payload?.dem,
    source: payload?.source,
    metadata,
    executedAt,
    isPersisted: persisted,
  };
};

const StepStatusIcon = ({ status }: { status: QuantitativeStep['status'] }) => {
  if (status === 'completed') {
    return <CheckCircleOutline sx={{ color: '#22c55e' }} fontSize="small" />;
  }
  if (status === 'failed') {
    return <ErrorOutline sx={{ color: '#f97316' }} fontSize="small" />;
  }
  return <Pending sx={{ color: '#facc15' }} fontSize="small" />;
};

const ContourPlot = memo(({ grid }: { grid: QuantitativeVisualizationGridNormalized }) => {
  const hasData = grid?.elevation?.length && grid?.elevation[0]?.length;
  const data = useMemo(() => {
    if (!hasData) {
      return [];
    }
    return [
      {
        type: 'contour',
        x: grid.x,
        y: grid.y,
        z: grid.elevation,
        colorscale: 'Portland',
        reversescale: false,
        ncontours: 25,
        line: { smoothing: 0.6, color: 'rgba(15, 23, 42, 0.45)' },
        contours: {
          coloring: 'heatmap',
          showlabels: true,
          labelfont: {
            family: 'Inter, sans-serif',
            size: 10,
            color: '#0f172a',
          },
        },
        hovertemplate: 'Easting: %{x:.1f} m<br>Northing: %{y:.1f} m<br>Elevation: %{z:.2f} m<extra></extra>',
        colorbar: {
          title: 'Elevation (m)',
          tickfont: { color: '#e2e8f0' },
          titlefont: { color: '#e2e8f0' },
        },
      },
    ];
  }, [grid, hasData]);

  const layout = useMemo(
    () => ({
      autosize: true,
      height: 280,
      margin: { l: 46, r: 12, t: 32, b: 42 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#e2e8f0', family: 'Inter, sans-serif' },
      xaxis: {
        title: 'Easting (m)',
        color: '#e2e8f0',
        showgrid: true,
        gridcolor: 'rgba(148, 163, 184, 0.25)',
      },
      yaxis: {
        title: 'Northing (m)',
        color: '#e2e8f0',
        showgrid: true,
        gridcolor: 'rgba(148, 163, 184, 0.25)',
        scaleanchor: 'x',
      },
    }),
    [],
  );

  if (!hasData) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
        <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.85rem' }}>
          Contour view unavailable for this block
        </Typography>
      </Box>
    );
  }

  return (
    <Plot
      data={data as any}
      layout={layout as any}
      config={plotConfig}
      style={{ width: '100%', height: '280px' }}
    />
  );
});
ContourPlot.displayName = 'ContourPlot';

const SurfacePlot = memo(({ grid }: { grid: QuantitativeVisualizationGridNormalized }) => {
  const hasData = grid?.elevation?.length && grid?.elevation[0]?.length;
  const depthValues = grid?.depth && grid.depth.length ? grid.depth : undefined;

  const data = useMemo(() => {
    if (!hasData) {
      return [];
    }
    return [
      {
        type: 'surface',
        x: grid.x,
        y: grid.y,
        z: grid.elevation,
        surfacecolor: depthValues || grid.elevation,
        colorscale: 'Viridis',
        reversescale: true,
        showscale: true,
        colorbar: {
          title: depthValues ? 'Depth (m)' : 'Elevation (m)',
          tickfont: { color: '#e2e8f0' },
          titlefont: { color: '#e2e8f0' },
        },
        opacity: 0.95,
        hovertemplate: 'Easting: %{x:.1f} m<br>Northing: %{y:.1f} m<br>Elevation: %{z:.2f} m<extra></extra>',
      },
    ];
  }, [grid, hasData, depthValues]);

  const layout = useMemo(
    () => ({
      autosize: true,
      height: 280,
      margin: { l: 0, r: 0, t: 36, b: 0 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#e2e8f0', family: 'Inter, sans-serif' },
      scene: {
        xaxis: {
          title: 'Easting (m)',
          color: '#e2e8f0',
          gridcolor: 'rgba(148, 163, 184, 0.35)',
          zerolinecolor: 'rgba(148, 163, 184, 0.45)',
        },
        yaxis: {
          title: 'Northing (m)',
          color: '#e2e8f0',
          gridcolor: 'rgba(148, 163, 184, 0.35)',
          zerolinecolor: 'rgba(148, 163, 184, 0.45)',
        },
        zaxis: {
          title: depthValues ? 'Elevation (m)' : 'Elevation (m)',
          color: '#e2e8f0',
          gridcolor: 'rgba(148, 163, 184, 0.35)',
          zerolinecolor: 'rgba(148, 163, 184, 0.45)',
        },
        camera: {
          eye: { x: 1.6, y: -1.6, z: 1.15 },
        },
        aspectmode: 'data',
      },
    }),
    [depthValues],
  );

  if (!hasData) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
        <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.85rem' }}>
          3D terrain view unavailable for this block
        </Typography>
      </Box>
    );
  }

  return (
    <Plot
      data={data as any}
      layout={layout as any}
      config={{ ...plotConfig, displayModeBar: false }}
      style={{ width: '100%', height: '280px' }}
    />
  );
});
SurfacePlot.displayName = 'SurfacePlot';

const QuantitativeResultsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisId = searchParams.get('id');

  const { isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyRecord, setHistoryRecord] = useState<AnalysisHistoryRecord | null>(null);
  const [results, setResults] = useState<any>(null);
  const [quantitativeLoading, setQuantitativeLoading] = useState(false);
  const [quantitativeError, setQuantitativeError] = useState<string | null>(null);
  const [quantitativeResult, setQuantitativeResult] = useState<QuantitativeResponse | null>(null);
  const [shouldRecompute, setShouldRecompute] = useState(false);
  const [persistState, setPersistState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persistedAt, setPersistedAt] = useState<string | null>(null);
  const bootstrapQuantTriggeredRef = useRef(false);
  const requiresFreshQuantitative = useMemo(() => {
    if (!quantitativeResult) {
      return true;
    }

    const blocks = quantitativeResult.blocks ?? [];
    if (!blocks.length) {
      return true;
    }

    if (!quantitativeResult.dem) {
      return true;
    }

    const hasVisualization = blocks.some((block) => {
      const grid = block.visualization?.grid;
      return Array.isArray(grid?.elevation) && grid.elevation.length > 0 && Array.isArray(grid.elevation[0]) && grid.elevation[0].length > 0;
    });

    return !hasVisualization;
  }, [quantitativeResult]);
  
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!analysisId) {
      setError('No analysis ID provided');
      setLoading(false);
      return;
    }

    if (authLoading || !isAuthenticated) {
      return;
    }

    let isMounted = true;

    const fetchQuantitativeData = async () => {
      setLoading(true);
      setError(null);

      try {
        const record = await getAnalysisById(analysisId, true);
        if (!isMounted) {
          return;
        }

        setHistoryRecord(record);
        if (record?.results) {
          setResults(record.results);
        }

        if (record?.quantitativeAnalysis) {
          const normalizedStored = normalizeQuantitativeResponse(
            analysisId,
            record.quantitativeAnalysis,
            true,
          );
          setQuantitativeResult(normalizedStored);
          setPersistState('saved');
          const storedExecutedAt = normalizedStored.executedAt
            ?? toDateISOString(record.quantitativeAnalysis?.executedAt)
            ?? toDateISOString(record.updatedAt);
          setPersistedAt(storedExecutedAt);
        }

        if (record?.results) {
          setLoading(false);
          return;
        }
      } catch (apiError) {
        console.warn('⚠️  History lookup failed, falling back to live pipeline', apiError);
      }

      try {
        let response = await fetch(`${PYTHON_API_BASE}/api/v1/analysis/${analysisId}`);
        if (!response.ok) {
          response = await fetch(`${API_BASE_URL}/python/analysis/${analysisId}`);
        }

        if (!response.ok) {
          throw new Error(`Failed to retrieve analysis ${analysisId}`);
        }

        const data = await response.json();
        if (!isMounted) {
          return;
        }

        setResults(data);
      } catch (liveError: any) {
        console.error('❌ Unable to load quantitative data', liveError);
        if (isMounted) {
          setError(liveError.message ?? 'Unable to load quantitative analysis');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchQuantitativeData();

    return () => {
      isMounted = false;
    };
  }, [analysisId, authLoading, isAuthenticated]);

  const handleRecompute = () => {
    if (quantitativeLoading) {
      return;
    }

    if (!results) {
      setQuantitativeError('Baseline detections are not available yet. Reload the page once detections finish.');
      return;
    }

    setQuantitativeError(null);
    setPersistError(null);
    setPersistState('idle');
    setPersistedAt(null);
    bootstrapQuantTriggeredRef.current = true;
    setShouldRecompute(true);
  };

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    if (!results) {
      if (shouldRecompute || quantitativeLoading) {
        setQuantitativeLoading(false);
        setShouldRecompute(false);
      }
      return;
    }

    if (quantitativeLoading && !shouldRecompute) {
      return;
    }

    if (!shouldRecompute && quantitativeResult) {
      if (requiresFreshQuantitative && !bootstrapQuantTriggeredRef.current) {
        bootstrapQuantTriggeredRef.current = true;
        setShouldRecompute(true);
      } else if (!requiresFreshQuantitative && bootstrapQuantTriggeredRef.current) {
        bootstrapQuantTriggeredRef.current = false;
      }
      return;
    }

    let isMounted = true;

    const runQuantitativeAnalysis = async () => {
      setQuantitativeLoading(true);
      setQuantitativeError(null);
      setPersistError(null);
      setPersistState('idle');
      setPersistedAt(null);

      try {
        const response = await fetch(`${PYTHON_API_BASE}/api/v1/analysis/${analysisId}/quantitative`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ results }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.detail ?? 'Failed to compute volumetric metrics');
        }

        const normalized = normalizeQuantitativeResponse(analysisId, payload, false);

        if (isMounted) {
          setQuantitativeResult(normalized);
          setPersistedAt(normalized.executedAt ?? toDateISOString(new Date()));
        }
      } catch (quantError: any) {
        console.error('❌ Quantitative analysis failed', quantError);
        if (isMounted) {
          const message = quantError?.message ?? 'Unable to compute volumetric metrics';
          setQuantitativeError(message);
          setPersistState('error');
          setPersistError(message);
        }
      } finally {
        if (isMounted) {
          setQuantitativeLoading(false);
          setShouldRecompute(false);
        }
      }
    };

    runQuantitativeAnalysis();

    return () => {
      isMounted = false;
    };
  }, [analysisId, results, shouldRecompute, quantitativeResult, quantitativeLoading, requiresFreshQuantitative]);

  useEffect(() => {
    if (!analysisId || !quantitativeResult) {
      return;
    }

    if (quantitativeResult.isPersisted) {
      setPersistState((state) => (state === 'saved' ? state : 'saved'));
      if (!persistedAt) {
        setPersistedAt(quantitativeResult.executedAt ?? toDateISOString(new Date()));
      }
      return;
    }

    let cancelled = false;

    const persist = async () => {
      try {
        setPersistState('saving');
        setPersistError(null);

        const payload: QuantitativeAnalysisSnapshot = {
          status: quantitativeResult.status,
          executedAt: quantitativeResult.executedAt ?? quantitativeResult.metadata?.generatedAt ?? new Date().toISOString(),
          steps: quantitativeResult.steps,
          summary: quantitativeResult.summary,
          executiveSummary: quantitativeResult.executiveSummary ?? undefined,
          blocks: quantitativeResult.blocks as QuantitativeBlockRecord[],
          dem: quantitativeResult.dem,
          source: quantitativeResult.source,
          metadata: {
            ...(quantitativeResult.metadata || {}),
            blockCount: quantitativeResult.blockCount,
          },
        };

        await saveQuantitativeAnalysis(analysisId, payload);

        if (!cancelled) {
          setPersistState('saved');
          setPersistedAt(toDateISOString(payload.executedAt ?? new Date()));
          setQuantitativeResult((prev) => (prev ? { ...prev, isPersisted: true } : prev));
        }
      } catch (error: any) {
        if (!cancelled) {
          const message = error?.message ?? 'Failed to store quantitative analysis';
          setPersistState('error');
          setPersistError(message);
        }
      }
    };

    persist();

    return () => {
      cancelled = true;
    };
  }, [analysisId, quantitativeResult, persistedAt]);

  const tileAreaMetrics = useMemo(() => {
    const derived = deriveTileAreaMetrics(results?.tiles);
    let { totalTileAreaM2, totalMiningAreaM2, coveragePct } = derived;

    const summary = (results?.summary ?? {}) as Record<string, unknown>;
    const statistics = (results?.statistics ?? {}) as Record<string, unknown>;
    const detectionSummary = (results?.detectionSummary ?? results?.detection_summary ?? {}) as Record<string, unknown>;

    const fallbackTileArea = firstNumeric(
      summary.total_tile_area_m2,
      summary.totalAreaM2,
      summary.total_area_m2,
      summary.total_processed_area_m2,
      summary.processedAreaM2,
      statistics.total_tile_area_m2,
      statistics.totalTileAreaM2,
      statistics.total_area_m2,
      statistics.total_processed_area_m2,
      statistics.processed_area_m2,
      detectionSummary.total_tile_area_m2,
      detectionSummary.totalAreaM2,
      detectionSummary.total_processed_area_m2,
      detectionSummary.processed_area_m2,
      (results as any)?.area_m2,
      (results as any)?.areaM2,
      quantitativeResult?.summary?.totalAreaSquareMeters,
    );

    if ((!totalTileAreaM2 || totalTileAreaM2 <= 0) && fallbackTileArea !== undefined && fallbackTileArea > 0) {
      totalTileAreaM2 = fallbackTileArea;
    }

    const fallbackMiningArea = firstNumeric(
      summary.detected_mining_area_m2,
      summary.total_mining_area_m2,
      summary.miningAreaM2,
      summary.detectedMiningAreaM2,
      summary.detected_area_m2,
      summary.mining_area_m2,
      statistics.total_mining_area_m2,
      statistics.totalMiningAreaM2,
      statistics.mining_area_m2,
      statistics.detected_area_m2,
      detectionSummary.total_mining_area_m2,
      detectionSummary.mining_area_m2,
      detectionSummary.detected_area_m2,
      quantitativeResult?.summary?.totalAreaSquareMeters,
    );

    if ((totalMiningAreaM2 === undefined || totalMiningAreaM2 <= 0) && fallbackMiningArea !== undefined && fallbackMiningArea >= 0) {
      totalMiningAreaM2 = totalTileAreaM2 > 0 ? Math.min(fallbackMiningArea, totalTileAreaM2) : fallbackMiningArea;
    }

    if (totalTileAreaM2 > 0 && totalMiningAreaM2 > totalTileAreaM2) {
      totalMiningAreaM2 = totalTileAreaM2;
    }

    if (coveragePct === null) {
      const coverageFromSummary = firstNumeric(
        summary.coverage_pct,
        summary.coverage,
        summary.miningCoverage,
        summary.miningCoveragePct,
        summary.mining_percentage,
        summary.miningPercentage,
        statistics.coverage_pct,
        statistics.coveragePct,
        statistics.miningCoveragePct,
        statistics.mining_percentage,
        statistics.miningPercentage,
        detectionSummary.coverage_pct,
        detectionSummary.miningCoveragePct,
        detectionSummary.mining_percentage,
        detectionSummary.miningPercentage,
      );

      if (coverageFromSummary !== undefined) {
        const normalized = coverageFromSummary > 1 ? coverageFromSummary : coverageFromSummary * 100;
        coveragePct = Math.max(0, Math.min(normalized, 100));
      } else if (totalTileAreaM2 > 0) {
        coveragePct = Math.max(0, Math.min((totalMiningAreaM2 / totalTileAreaM2) * 100, 100));
      }
    }

    return {
      totalTileAreaM2,
      totalMiningAreaM2,
      coveragePct,
    };
  }, [results, quantitativeResult?.summary]);
  const confidenceMetrics = useMemo(() => deriveConfidenceMetrics(results), [results]);

  const quantitativeMetricMap = useMemo(() => {
    const map = new Map<string, QuantitativeBlockMetric>();
    quantitativeResult?.blocks.forEach((block) => {
      if (block.persistentId) {
        map.set(block.persistentId, block);
      }
      map.set(block.blockId, block);
      map.set(block.blockLabel, block);
    });
    return map;
  }, [quantitativeResult]);

  const mineBlockRows: MineBlockRow[] = useMemo(() => {
    const fallbackQuantitativeBlocks = (quantitativeResult?.blocks ?? []).map((block, index) => {
      const areaHa = typeof block.areaHectares === 'number'
        ? block.areaHectares
        : typeof block.areaSquareMeters === 'number'
          ? block.areaSquareMeters / 10_000
          : 0;

      return {
        id: block.blockId ?? `quant-block-${index}`,
        label: block.blockLabel ?? block.blockId ?? `Block ${index + 1}`,
        tileId: block.source ?? 'quantitative',
        areaHa,
        confidencePct: null,
        source: (block.source === 'merged' ? 'Merged' : 'Tile') as MineBlockRow['source'],
        persistentId: block.persistentId ?? block.blockId ?? `quant-block-${index}`,
        rimElevationMeters: block.rimElevationMeters ?? null,
        maxDepthMeters: block.maxDepthMeters ?? null,
        meanDepthMeters: block.meanDepthMeters ?? null,
        volumeCubicMeters: block.volumeCubicMeters ?? null,
      } satisfies MineBlockRow;
    });

    if (!results) {
      return fallbackQuantitativeBlocks;
    }

    const mergedFeatures = Array.isArray(results?.merged_blocks?.features)
      ? results.merged_blocks.features
      : [];

    const mergedRows = mergedFeatures.map((feature: any, index: number) => {
      const props = feature?.properties || {};
      const blockId = props.block_id || props.id || `merged-${index}`;
      const name = props.name || `Merged Block ${index + 1}`;
      const tileId = props.tile_id !== undefined && props.tile_id !== null
        ? String(props.tile_id)
        : 'mosaic';
      const centroidArray = Array.isArray(props.label_position) && props.label_position.length >= 2
        ? props.label_position.map((value: any) => (typeof value === 'number' ? value : Number(value)))
        : undefined;
      const boundsArray = Array.isArray(props.bbox) && props.bbox.length === 4
        ? (props.bbox as any[]).map((value) => (typeof value === 'number' ? value : Number(value))) as [number, number, number, number]
        : undefined;

      const metrics = quantitativeMetricMap.get(props.persistent_id || blockId) || quantitativeMetricMap.get(name);

      return {
        id: `merged-${blockId}`,
        label: name,
        tileId,
        areaHa: (props.area_m2 || 0) / 10_000,
        confidencePct: normalizeConfidenceValue(props.avg_confidence ?? props.confidence ?? props.mean_confidence),
        source: 'Merged' as const,
        isMerged: true,
        persistentId: props.persistent_id || blockId,
        blockIndex: props.block_index,
        centroidLat: centroidArray?.[1],
        centroidLon: centroidArray?.[0],
        bounds: boundsArray,
        rimElevationMeters: metrics?.rimElevationMeters ?? null,
        maxDepthMeters: metrics?.maxDepthMeters ?? null,
        meanDepthMeters: metrics?.meanDepthMeters ?? null,
        volumeCubicMeters: metrics?.volumeCubicMeters ?? null,
      } satisfies MineBlockRow;
    });

    const tileRows = Array.isArray(results?.tiles)
      ? results.tiles.flatMap((tile: any, tileIdx: number) => {
          const tileBlocks = Array.isArray(tile.mine_blocks) ? tile.mine_blocks : [];
          if (!tileBlocks.length) {
            return [];
          }

          const tileLabel = tile.tile_label
            ?? tile.tile_id
            ?? (typeof tile.tile_index === 'number' ? `tile_${tile.tile_index}` : `Tile ${tileIdx + 1}`);
          const displayTileId = tile.tile_id ? String(tile.tile_id) : tileLabel;

          return tileBlocks.map((block: any, blockIdx: number) => {
            const props = block?.properties || {};
            const blockId = props.block_id || `${displayTileId}-block-${blockIdx + 1}`;
            const displayLabel = props.name || `${tileLabel} · Block ${blockIdx + 1}`;
            const centroidArray = Array.isArray(props.label_position) && props.label_position.length >= 2
              ? props.label_position.map((value: any) => (typeof value === 'number' ? value : Number(value)))
              : undefined;
            const boundsArray = Array.isArray(props.bbox) && props.bbox.length === 4
              ? (props.bbox as any[]).map((value) => (typeof value === 'number' ? value : Number(value))) as [number, number, number, number]
              : undefined;

            const metrics = quantitativeMetricMap.get(props.persistent_id || blockId) || quantitativeMetricMap.get(displayLabel);

            return {
              id: `tile-${blockId}`,
              label: displayLabel,
              tileId: displayTileId,
              areaHa: (props.area_m2 || 0) / 10_000,
              confidencePct: normalizeConfidenceValue(props.avg_confidence ?? props.confidence ?? props.mean_confidence),
              source: 'Tile' as const,
              isMerged: !!props.is_merged,
              persistentId: props.persistent_id || blockId,
              blockIndex: props.block_index,
              centroidLat: centroidArray?.[1],
              centroidLon: centroidArray?.[0],
              bounds: boundsArray,
              rimElevationMeters: metrics?.rimElevationMeters ?? null,
              maxDepthMeters: metrics?.maxDepthMeters ?? null,
              meanDepthMeters: metrics?.meanDepthMeters ?? null,
              volumeCubicMeters: metrics?.volumeCubicMeters ?? null,
            } satisfies MineBlockRow;
          });
        })
      : [];

    const combined = [...mergedRows, ...tileRows];
    if (!combined.length) {
      return fallbackQuantitativeBlocks;
    }

    combined.sort((a, b) => {
      if (a.blockIndex !== undefined && b.blockIndex !== undefined) {
        return a.blockIndex - b.blockIndex;
      }
      if (a.source !== b.source) {
        return a.source === 'Merged' ? -1 : 1;
      }
      return b.areaHa - a.areaHa;
    });
    return combined;
  }, [results, quantitativeMetricMap, quantitativeResult?.blocks]);

  const blockAnalytics = useMemo(() => {
    if (!mineBlockRows.length) {
      return {
        count: 0,
        totalAreaHa: 0,
        averageBlockAreaHa: 0,
        averageConfidence: null as number | null,
        maxConfidence: null as number | null,
        minConfidence: null as number | null,
        averageMaxDepth: null as number | null,
        averageMeanDepth: null as number | null,
        totalVolumeCubicMeters: null as number | null,
      };
    }

    const totalAreaHa = mineBlockRows.reduce((sum, row) => sum + (Number.isFinite(row.areaHa) ? row.areaHa : 0), 0);
    const confidenceValues = mineBlockRows
      .map((row) => row.confidencePct)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const volumetricBlocks = quantitativeResult?.blocks ?? [];
    const maxDepthValues = volumetricBlocks
      .map((block) => (typeof block.maxDepthMeters === 'number' && Number.isFinite(block.maxDepthMeters) ? block.maxDepthMeters : null))
      .filter((value): value is number => value !== null);
    const meanDepthValues = volumetricBlocks
      .map((block) => (typeof block.meanDepthMeters === 'number' && Number.isFinite(block.meanDepthMeters) ? block.meanDepthMeters : null))
      .filter((value): value is number => value !== null);
    const volumeValues = volumetricBlocks
      .map((block) => (typeof block.volumeCubicMeters === 'number' && Number.isFinite(block.volumeCubicMeters) ? block.volumeCubicMeters : null))
      .filter((value): value is number => value !== null);

    const averageMaxDepth = maxDepthValues.length > 0
      ? maxDepthValues.reduce((sum, value) => sum + value, 0) / maxDepthValues.length
      : null;
    const averageMeanDepth = meanDepthValues.length > 0
      ? meanDepthValues.reduce((sum, value) => sum + value, 0) / meanDepthValues.length
      : null;

    let totalVolumeCubicMeters: number | null = typeof quantitativeResult?.summary?.totalVolumeCubicMeters === 'number'
      ? quantitativeResult.summary.totalVolumeCubicMeters
      : null;
    if (totalVolumeCubicMeters === null && volumeValues.length > 0) {
      totalVolumeCubicMeters = volumeValues.reduce((sum, value) => sum + value, 0);
    }

    return {
      count: mineBlockRows.length,
      totalAreaHa,
      averageBlockAreaHa: mineBlockRows.length > 0 ? totalAreaHa / mineBlockRows.length : 0,
      averageConfidence: confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : null,
      maxConfidence: confidenceValues.length > 0 ? Math.max(...confidenceValues) : null,
      minConfidence: confidenceValues.length > 0 ? Math.min(...confidenceValues) : null,
      averageMaxDepth,
      averageMeanDepth,
      totalVolumeCubicMeters,
    };
  }, [mineBlockRows, quantitativeResult?.blocks, quantitativeResult?.summary]);

  const miningAreaHa = tileAreaMetrics.totalMiningAreaM2 / 10_000;
  const totalTileAreaHa = tileAreaMetrics.totalTileAreaM2 / 10_000;

  const volumetricSummary = quantitativeResult?.summary ?? null;
  const volumetricAreaHa = volumetricSummary ? volumetricSummary.totalAreaSquareMeters / 10_000 : null;
  const demInfo = quantitativeResult?.dem;
  const quantitativeSteps = quantitativeResult?.steps ?? [];
  const visualizationBlocks = useMemo(
    () =>
      (quantitativeResult?.blocks ?? []).filter(
        (block) => {
          const grid = block.visualization?.grid;
          if (!grid || !Array.isArray(grid.elevation) || !grid.elevation.length) {
            return false;
          }
          const firstRow = grid.elevation[0];
          return Array.isArray(firstRow) && firstRow.length > 0;
        },
      ),
    [quantitativeResult?.blocks],
  );
  const executiveSummary = quantitativeResult?.executiveSummary ?? null;
  const headline = executiveSummary?.headline ?? null;
  const priorityBlocks = executiveSummary?.priorityBlocks ?? [];
  const insights = executiveSummary?.insights ?? null;
  const topPriorityBlocks = priorityBlocks.slice(0, 4);
  const headlineVolume = headline?.totalVolumeCubicMeters ?? volumetricSummary?.totalVolumeCubicMeters ?? 0;
  const headlineAreaHa = headline?.totalAreaHectares
    ?? (volumetricSummary ? volumetricSummary.totalAreaSquareMeters / 10_000 : null);
  const headlineBlockCount = headline?.blockCount ?? quantitativeResult?.blockCount ?? quantitativeResult?.blocks.length ?? null;

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(to right, #1a1a2e, #16213e, #0f3460)' }}>
        <CircularProgress sx={{ color: '#fcd34d' }} size={60} />
      </Box>
    );
  }

  if (error || !results) {
    return (
      <Box sx={{ p: 4, background: 'linear-gradient(to right, #1a1a2e, #16213e, #0f3460)', minHeight: '100vh' }}>
        <Alert severity="error">{error || 'No results found'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(to right, #1a1a2e, #16213e, #0f3460)' }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: 4, py: 5 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.push(`/geoanalyst-dashboard/results?id=${analysisId ?? ''}`)}
            sx={{ color: '#fcd34d', textTransform: 'none' }}
          >
            Back to Results Explorer
          </Button>
        </Stack>

        <GoldenText variant="h4" fontWeight="bold" gutterBottom>
          Quantitative Analysis
        </GoldenText>
        <Typography sx={{ color: 'rgba(252, 211, 77, 0.6)', fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          Analysis ID: {analysisId}
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
          <Chip
            label={historyRecord?.status ? historyRecord.status.toUpperCase() : 'COMPLETED'}
            sx={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#93c5fd',
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          />
          <Chip
            label={`Blocks: ${blockAnalytics.count}`}
            sx={{
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              color: '#fde68a',
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          />
          <Chip
            label={`Coverage: ${formatNumber(tileAreaMetrics.coveragePct ?? null, 1)}%`}
            sx={{
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              color: '#67e8f9',
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          />
          {volumetricSummary && (
            <Chip
              label={`Volume: ${formatVolume(volumetricSummary.totalVolumeCubicMeters)}`}
              sx={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#6ee7b7',
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            />
          )}
          {persistState === 'saving' && (
            <Chip
              label="Saving to history…"
              sx={{
                backgroundColor: 'rgba(37, 99, 235, 0.18)',
                border: '1px dashed rgba(96, 165, 250, 0.45)',
                color: '#bfdbfe',
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            />
          )}
          {persistState === 'saved' && (
            <Chip
              label={`Stored${persistedAt ? ` · ${formatDate(persistedAt)}` : ''}`}
              sx={{
                backgroundColor: 'rgba(34, 197, 94, 0.18)',
                border: '1px solid rgba(74, 222, 128, 0.35)',
                color: '#bbf7d0',
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            />
          )}
          {persistState === 'error' && (
            <Chip
              label="Save to history failed"
              sx={{
                backgroundColor: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid rgba(248, 113, 113, 0.45)',
                color: '#fecaca',
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            />
          )}
        </Stack>

        {quantitativeError && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {quantitativeError}
          </Alert>
        )}
        {persistError && persistState === 'error' && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {persistError}
          </Alert>
        )}

        <Grid container spacing={3} sx={{ mt: 3 }}>
          {executiveSummary && (
            <Grid size={{ xs: 12 }}>
              <Paper
                sx={{
                  p: 3,
                  background: 'rgba(15, 52, 96, 0.65)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                }}
                elevation={0}
              >
                <Stack spacing={2.5}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ color: '#fbbf24', fontWeight: 700, mb: 1 }}>
                        Executive Summary
                      </Typography>
                      <Stack spacing={1.25}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Total Extracted Volume</Typography>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                            {formatVolume(headlineVolume)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Excavated Footprint</Typography>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                            {formatNumber(headlineAreaHa, 2)} ha
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Blocks Analysed</Typography>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                            {headlineBlockCount ?? '--'}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ color: '#fbbf24', fontWeight: 700, mb: 1 }}>
                        Priority Blocks (Top {topPriorityBlocks.length})
                      </Typography>
                      {topPriorityBlocks.length ? (
                        <Stack spacing={1}>
                          {topPriorityBlocks.map((block, index) => (
                            <Box
                              key={`${block.blockId ?? block.label ?? index}`}
                              sx={{
                                p: 1.5,
                                borderRadius: 1.5,
                                background: 'rgba(30, 58, 138, 0.45)',
                                border: '1px solid rgba(96, 165, 250, 0.25)',
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                                  {index + 1}. {block.label ?? block.blockId ?? 'Block'}
                                </Typography>
                                <Chip
                                  label={`${formatVolume(block.volumeCubicMeters ?? 0)}`}
                                  size="small"
                                  sx={{
                                    backgroundColor: 'rgba(250, 204, 21, 0.16)',
                                    border: '1px solid rgba(250, 204, 21, 0.35)',
                                    color: '#fde68a',
                                    fontWeight: 600,
                                  }}
                                />
                              </Stack>
                              <Typography sx={{ color: 'rgba(148, 163, 184, 0.8)', fontSize: '0.75rem', mt: 0.5 }}>
                                Max depth {formatNumber(block.maxDepthMeters, 1)} m · Area {formatNumber(block.areaHectares, 2)} ha
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.85rem' }}>
                          No blocks exceeded the defined depth/volume thresholds.
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ color: '#fbbf24', fontWeight: 700, mb: 1 }}>
                        Governance Insights
                      </Typography>
                      <Stack spacing={1.25}>
                        <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)', fontSize: '0.85rem' }}>
                          Average mean depth across blocks: <Box component="span" sx={{ color: '#fcd34d', fontWeight: 600 }}>
                            {formatNumber(insights?.averageMeanDepthMeters ?? volumetricSummary?.averageMeanDepthMeters ?? null, 2)} m
                          </Box>
                        </Typography>
                        {insights?.deepestBlock && (
                          <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)', fontSize: '0.85rem' }}>
                            Deepest excavation:
                            <Box component="span" sx={{ color: '#fcd34d', fontWeight: 600, ml: 0.5 }}>
                              {insights.deepestBlock.label}
                            </Box>
                            {' '}({formatNumber(insights.deepestBlock.maxDepthMeters, 2)} m)
                          </Typography>
                        )}
                        {insights?.largestBlock && (
                          <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)', fontSize: '0.85rem' }}>
                            Highest volume block:
                            <Box component="span" sx={{ color: '#fcd34d', fontWeight: 600, ml: 0.5 }}>
                              {insights.largestBlock.label}
                            </Box>
                            {' '}({formatVolume(insights.largestBlock.volumeCubicMeters)})
                          </Typography>
                        )}
                        {executiveSummary?.policyFlags && (
                          <Typography sx={{ color: 'rgba(148, 163, 184, 0.7)', fontSize: '0.75rem' }}>
                            Policy flags: {executiveSummary.policyFlags.requiresAttention ? 'Immediate field validation recommended' : 'No critical thresholds exceeded'}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                  <Typography sx={{ color: 'rgba(148, 163, 184, 0.65)', fontSize: '0.75rem' }}>
                    Last updated {formatDate(executiveSummary.updatedAt ?? quantitativeResult?.executedAt ?? persistedAt)}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          )}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper
              sx={{
                p: 3,
                background: 'rgba(26, 26, 46, 0.75)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
              }}
              elevation={0}
            >
              <Typography sx={{ color: '#fcd34d', fontWeight: 700, mb: 1 }}>
                Spatial Footprint Summary
              </Typography>
              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.25)', mb: 2 }} />
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Processed Area</Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                    {formatNumber(totalTileAreaHa, 2)} ha
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Detected Mining Activity</Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                    {formatNumber(miningAreaHa, 2)} ha
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Coverage of Mining</Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                    {formatNumber(tileAreaMetrics.coveragePct ?? null, 1)}%
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper
              sx={{
                p: 3,
                background: 'rgba(26, 26, 46, 0.75)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
              }}
              elevation={0}
            >
              <Typography sx={{ color: '#fcd34d', fontWeight: 700, mb: 1 }}>
                Confidence Distribution
              </Typography>
              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.25)', mb: 2 }} />
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Average Confidence</Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                    {formatNumber(confidenceMetrics.averagePct, 1)}%
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Peak Confidence</Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                    {formatNumber(confidenceMetrics.maxPct, 1)}%
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Lowest Confidence</Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                    {formatNumber(confidenceMetrics.minPct, 1)}%
                  </Typography>
                </Stack>
                <Typography sx={{ color: 'rgba(148, 163, 184, 0.7)', fontSize: '0.75rem' }}>
                  Samples gathered from {confidenceMetrics.sampleCount} mined blocks with persistent identifiers applied where available.
                </Typography>
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper
              sx={{
                p: 3,
                background: 'rgba(26, 26, 46, 0.75)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                minHeight: 196,
              }}
              elevation={0}
            >
              <Typography sx={{ color: '#fcd34d', fontWeight: 700, mb: 1 }}>
                Volumetric Summary
              </Typography>
              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.25)', mb: 2 }} />
              {quantitativeLoading && !volumetricSummary ? (
                <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ minHeight: 120 }}>
                  <LinearProgress sx={{ width: '100%' }} color="warning" />
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.75)', fontSize: '0.85rem' }}>
                    Generating DEM-aligned volume metrics…
                  </Typography>
                </Stack>
              ) : volumetricSummary ? (
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Total Volume</Typography>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                      {formatVolume(volumetricSummary.totalVolumeCubicMeters)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Excavated Area</Typography>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                      {formatNumber(volumetricAreaHa, 2)} ha
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Avg. Max Depth</Typography>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                      {formatNumber(volumetricSummary.averageMaxDepthMeters, 2)} m
                    </Typography>
                  </Stack>
                  {volumetricSummary.deepestBlock && (
                    <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.8rem' }}>
                      Deepest block <Box component="span" sx={{ color: '#fcd34d', fontWeight: 600 }}>
                        {volumetricSummary.deepestBlock.label}
                      </Box>{' '}
                      reaches {formatNumber(volumetricSummary.deepestBlock.maxDepthMeters, 2)} m with volume{' '}
                      {formatVolume(volumetricSummary.deepestBlock.volumeCubicMeters)}
                    </Typography>
                  )}
                </Stack>
              ) : (
                <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.85rem' }}>
                  Volumetric metrics will appear after the quantitative pipeline completes.
                </Typography>
              )}
            </Paper>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Paper
              sx={{
                p: 3,
                background: 'rgba(26, 26, 46, 0.75)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
              }}
              elevation={0}
            >
              <Typography sx={{ color: '#fcd34d', fontWeight: 700, mb: 1 }}>
                Block Inventory Overview
              </Typography>
              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.25)', mb: 2 }} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.7)' }}>Mean Block Area</Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.15rem' }}>
                    {formatNumber(blockAnalytics.averageBlockAreaHa, 2)} ha
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.7)' }}>Total Detected Area</Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.15rem' }}>
                    {formatNumber(blockAnalytics.totalAreaHa, 2)} ha
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.7)' }}>Average Confidence</Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.15rem' }}>
                    {formatNumber(blockAnalytics.averageConfidence, 1)}%
                  </Typography>
                  <Typography sx={{ color: 'rgba(148, 163, 184, 0.7)', fontSize: '0.75rem', mt: 0.5 }}>
                    Range {formatNumber(blockAnalytics.minConfidence, 1)}% – {formatNumber(blockAnalytics.maxConfidence, 1)}%
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Typography sx={{ color: 'rgba(226, 232, 240, 0.7)' }}>Average Max Depth</Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.15rem' }}>
                    {formatNumber(blockAnalytics.averageMaxDepth, 2)} m
                  </Typography>
                  {blockAnalytics.averageMeanDepth !== null && (
                    <Typography sx={{ color: 'rgba(148, 163, 184, 0.7)', fontSize: '0.75rem', mt: 0.5 }}>
                      Mean depth {formatNumber(blockAnalytics.averageMeanDepth, 2)} m
                    </Typography>
                  )}
                </Grid>
              </Grid>
              {blockAnalytics.totalVolumeCubicMeters !== null && (
                <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.8rem', mt: 2 }}>
                  Aggregate excavated volume {formatVolume(blockAnalytics.totalVolumeCubicMeters)} across analysed blocks
                </Typography>
              )}
            </Paper>
          </Grid>

          {visualizationBlocks.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Paper
                sx={{
                  p: 3,
                  background: 'rgba(15, 52, 96, 0.55)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                }}
                elevation={0}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography sx={{ color: '#fcd34d', fontWeight: 700 }}>
                    DEM Visual Evidence (per block)
                  </Typography>
                  <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.75rem' }}>
                    Drag the 3D surface to inspect slope and volume. Mouse wheel zooms the contour view.
                  </Typography>
                </Stack>
                <TableContainer
                  sx={{
                    borderRadius: 2,
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    maxHeight: '70vh',
                    overflow: 'auto',
                  }}
                >
                  <Table stickyHeader size="small" sx={{ minWidth: 960 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#e2e8f0', backgroundColor: 'rgba(15, 23, 42, 0.8)', fontWeight: 700 }}>Block</TableCell>
                        <TableCell sx={{ color: '#e2e8f0', backgroundColor: 'rgba(15, 23, 42, 0.8)', fontWeight: 700 }}>Volume & Depth</TableCell>
                        <TableCell sx={{ color: '#e2e8f0', backgroundColor: 'rgba(15, 23, 42, 0.8)', fontWeight: 700 }}>
                          2D Elevation Contours
                        </TableCell>
                        <TableCell sx={{ color: '#e2e8f0', backgroundColor: 'rgba(15, 23, 42, 0.8)', fontWeight: 700 }}>
                          3D Terrain Surface
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visualizationBlocks.map((block) => {
                        const grid = block.visualization?.grid;
                        const stats = block.visualization?.stats as Record<string, number | null> | null;
                        return (
                          <TableRow
                            key={block.blockId ?? block.blockLabel}
                            hover
                            sx={{ '&:nth-of-type(even)': { backgroundColor: 'rgba(15, 23, 42, 0.35)' } }}
                          >
                            <TableCell sx={{ color: '#e2e8f0', verticalAlign: 'top', width: 220 }}>
                              <Typography sx={{ fontWeight: 600 }}>{block.blockLabel}</Typography>
                              <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.75rem', mt: 0.5 }}>
                                Source: {block.source ?? 'N/A'} · ID: {block.blockId}
                              </Typography>
                              <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.75rem', mt: 0.5 }}>
                                Area {formatNumber(block.areaHectares, 2)} ha · Rim {formatNumber(block.rimElevationMeters, 1)} m
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ color: '#e2e8f0', verticalAlign: 'top', width: 200 }}>
                              <Stack spacing={0.75}>
                                <Typography sx={{ fontWeight: 600 }}>
                                  {formatVolume(block.volumeCubicMeters ?? null)}
                                </Typography>
                                <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.75rem' }}>
                                  Max depth {formatNumber(block.maxDepthMeters, 2)} m
                                </Typography>
                                <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.75rem' }}>
                                  Mean depth {formatNumber(block.meanDepthMeters, 2)} m
                                </Typography>
                                {stats && (
                                  <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.75rem' }}>
                                    Elevation range {formatNumber(stats.minElevation ?? null, 1)} – {formatNumber(stats.maxElevation ?? null, 1)} m
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ minWidth: 320, verticalAlign: 'top' }}>
                              {grid ? <ContourPlot grid={grid} /> : (
                                <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.8rem' }}>
                                  Not available
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ minWidth: 320, verticalAlign: 'top' }}>
                              {grid ? <SurfacePlot grid={grid} /> : (
                                <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.8rem' }}>
                                  Not available
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <Paper
              sx={{
                p: 3,
                background: 'rgba(26, 26, 46, 0.75)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
              }}
              elevation={0}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ color: '#fcd34d', fontWeight: 700 }}>
                  Quantitative Pipeline
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  {quantitativeLoading && (
                    <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.75rem' }}>
                      Processing…
                    </Typography>
                  )}
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleRecompute}
                    disabled={quantitativeLoading}
                    startIcon={
                      quantitativeLoading
                        ? <CircularProgress size={16} sx={{ color: '#0f172a' }} />
                        : <Autorenew fontSize="small" />
                    }
                    sx={{
                      backgroundColor: 'rgba(59, 130, 246, 0.25)',
                      color: '#dbeafe',
                      textTransform: 'none',
                      borderRadius: 1.5,
                      boxShadow: 'none',
                      transition: 'background-color 0.15s ease',
                      '&:hover': {
                        backgroundColor: 'rgba(59, 130, 246, 0.4)',
                        boxShadow: 'none',
                      },
                      '&.Mui-disabled': {
                        backgroundColor: 'rgba(30, 64, 175, 0.25)',
                        color: 'rgba(191, 219, 254, 0.6)',
                      },
                    }}
                  >
                    {quantitativeLoading ? 'Running…' : 'Re-run analysis'}
                  </Button>
                </Stack>
              </Stack>
              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.25)', mb: 2 }} />
              {quantitativeLoading && (
                <LinearProgress color="warning" sx={{ mb: 2 }} />
              )}
              <Stack spacing={1.25}>
                {quantitativeSteps.map((step) => (
                  <Paper
                    key={step.name}
                    sx={{
                      p: 1.5,
                      background: 'rgba(15, 52, 96, 0.45)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                    }}
                    elevation={0}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <StepStatusIcon status={step.status} />
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                            {step.name}
                          </Typography>
                          <Typography sx={{ color: 'rgba(148, 163, 184, 0.7)', fontSize: '0.75rem' }}>
                            {formatDurationMs(step.durationMs)}
                          </Typography>
                        </Stack>
                        {step.details?.length > 0 && (
                          <Stack component="ul" sx={{ pl: 2.5, mt: 0.75 }} spacing={0.25}>
                            {step.details.map((detail: string, idx: number) => (
                              <Typography component="li" key={`${step.name}-${idx}`} sx={{ color: 'rgba(226, 232, 240, 0.75)', fontSize: '0.75rem' }}>
                                {detail}
                              </Typography>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Stack>
                  </Paper>
                ))}
                {!quantitativeSteps.length && !quantitativeLoading && (
                  <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.85rem' }}>
                    Detailed step logs will appear once the volumetric analysis is executed for this result.
                  </Typography>
                )}
              </Stack>
            </Paper>
          </Grid>

          {demInfo && (
            <Grid size={{ xs: 12 }}>
              <Paper
                sx={{
                  p: 3,
                  background: 'rgba(26, 26, 46, 0.75)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                }}
                elevation={0}
              >
                <Typography sx={{ color: '#fcd34d', fontWeight: 700, mb: 1 }}>
                  DEM Inputs
                </Typography>
                <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.25)', mb: 2 }} />
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>CRS</Typography>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>{demInfo.crs}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Resolution</Typography>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>{formatNumber(demInfo.resolutionMeters, 0)} m</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ color: 'rgba(226, 232, 240, 0.8)' }}>Tiles Fetched</Typography>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>{demInfo.tileCount}</Typography>
                  </Stack>
                  <Typography sx={{ color: 'rgba(148, 163, 184, 0.7)', fontSize: '0.75rem' }}>
                    WGS84 Bounds: {demInfo.boundsWGS84.map((value: number) => value.toFixed(4)).join(', ')}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <MineBlockTable rows={mineBlockRows} />
          </Grid>
        </Grid>

        <Paper
          sx={{
            mt: 4,
            p: 2.5,
            background: 'rgba(26, 26, 46, 0.75)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
          }}
          elevation={0}
        >
          <Typography sx={{ color: '#fcd34d', fontWeight: 700, mb: 1 }}>
            Analysis Metadata
          </Typography>
          <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.25)', mb: 1.5 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography sx={{ color: 'rgba(226, 232, 240, 0.7)' }}>Started</Typography>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                {formatDate(historyRecord?.startTime)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography sx={{ color: 'rgba(226, 232, 240, 0.7)' }}>Completed</Typography>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                {formatDate(historyRecord?.endTime)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography sx={{ color: 'rgba(226, 232, 240, 0.7)' }}>Duration (mins)</Typography>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                {historyRecord?.duration ? formatNumber(historyRecord.duration / 60, 1) : '--'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Box>
  );
};

export default QuantitativeResultsPage;
