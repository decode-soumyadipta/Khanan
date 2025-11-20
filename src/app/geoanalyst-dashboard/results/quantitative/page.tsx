"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import dynamic from 'next/dynamic';
import type { CSSProperties, ReactElement } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  AnalysisResults,
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

type PlotlyDatum = Record<string, unknown>;
type PlotlyLayout = Record<string, unknown>;
type PlotlyConfig = Record<string, unknown>;

type CoordinatePair = [number, number];
type PolygonRing = CoordinatePair[];
type PolygonRings = PolygonRing[];
type BoundsTuple = [number, number, number, number];

type PlotHoverPoint = {
  x: number | string | null;
  y: number | string | null;
  z?: number | string | null;
  customdata?: number | number[] | null;
  surfacecolor?: number | null;
  pointNumber?: number | number[];
  pointNumbers?: number | number[];
  pointIndex?: number | number[];
  pointIndices?: number | number[];
  i?: number;
  j?: number;
};

type PlotHoverEvent = {
  points?: PlotHoverPoint[];
};

type PlotComponentProps = {
  data: PlotlyDatum[];
  layout: PlotlyLayout;
  config?: PlotlyConfig;
  style?: CSSProperties;
  onHover?: (event: PlotHoverEvent) => void;
  onUnhover?: (event: PlotHoverEvent) => void;
  onInitialized?: (figure: any, graphDiv: any) => void;
  onUpdate?: (figure: any, graphDiv: any) => void;
} & Record<string, unknown>;

type PlotComponent = (props: PlotComponentProps) => ReactElement;

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) as unknown as PlotComponent;

const plotConfig: PlotlyConfig = {
  responsive: true,
  displayModeBar: true,
  displaylogo: false,
  scrollZoom: true,
  doubleClick: 'reset',
};

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

const parseNumericValue = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.replace(/,/g, '');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const computeAxisPositions = (
  provided: number[] | undefined,
  count: number,
  options: { min?: number | null; max?: number | null; resolution?: number | null },
): number[] => {
  if (count <= 0) {
    return [];
  }

  const sanitizedProvided = Array.isArray(provided)
    ? provided.map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN))
    : [];

  if (sanitizedProvided.length === count && sanitizedProvided.every((value) => Number.isFinite(value))) {
    return sanitizedProvided;
  }

  const { min, max, resolution } = options;
  const hasMin = typeof min === 'number' && Number.isFinite(min);
  const hasMax = typeof max === 'number' && Number.isFinite(max);
  const normalizedResolution = typeof resolution === 'number' && Number.isFinite(resolution)
    ? Math.abs(resolution)
    : null;

  if (normalizedResolution && normalizedResolution > 0) {
    if (hasMin) {
      return Array.from({ length: count }, (_, idx) => (min as number) + normalizedResolution * idx);
    }
    if (hasMax) {
      const start = (max as number) - normalizedResolution * (count - 1);
      return Array.from({ length: count }, (_, idx) => start + normalizedResolution * idx);
    }
  }

  if (hasMin && hasMax) {
    const start = min as number;
    const end = max as number;
    const step = count > 1 ? (end - start) / (count - 1) : 0;
    return Array.from({ length: count }, (_, idx) => start + step * idx);
  }

  if (sanitizedProvided.length === count) {
    const filled = [...sanitizedProvided];
    let lastFiniteIndex = -1;

    for (let i = 0; i < count; i += 1) {
      if (Number.isFinite(filled[i])) {
        if (lastFiniteIndex >= 0 && i - lastFiniteIndex > 1) {
          const startValue = filled[lastFiniteIndex] as number;
          const endValue = filled[i] as number;
          const gap = i - lastFiniteIndex;
          const step = (endValue - startValue) / gap;
          for (let j = 1; j < gap; j += 1) {
            filled[lastFiniteIndex + j] = startValue + step * j;
          }
        } else if (lastFiniteIndex === -1) {
          for (let j = 0; j < i; j += 1) {
            filled[j] = filled[i];
          }
        }
        lastFiniteIndex = i;
      }
    }

    if (lastFiniteIndex !== -1 && lastFiniteIndex < count - 1) {
      const lastValue = filled[lastFiniteIndex] as number;
      for (let i = lastFiniteIndex + 1; i < count; i += 1) {
        filled[i] = lastValue;
      }
    }

    if (filled.every((value) => Number.isFinite(value))) {
      return filled as number[];
    }
  }

  return Array.from({ length: count }, (_, idx) => idx);
};

const findClosestAxisIndex = (value: number | null, axis: number[]): number | null => {
  if (value === null || !axis.length) {
    return null;
  }
  let closestIndex = -1;
  let minDelta = Number.POSITIVE_INFINITY;

  for (let i = 0; i < axis.length; i += 1) {
    const axisValue = axis[i];
    if (!Number.isFinite(axisValue)) {
      continue;
    }
    const delta = Math.abs(axisValue - value);
    if (delta < minDelta) {
      minDelta = delta;
      closestIndex = i;
    }
  }

  return closestIndex !== -1 ? closestIndex : null;
};

const getMatrixValue = (
  matrix: (number | null)[][] | undefined,
  rowIndex: number | null,
  columnIndex: number | null,
): number | null => {
  if (!Array.isArray(matrix) || rowIndex === null || columnIndex === null) {
    return null;
  }
  const row = matrix[rowIndex];
  if (!Array.isArray(row)) {
    return null;
  }
  const candidate = row[columnIndex];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
};

const inferGridIndices = (
  point: PlotHoverPoint,
  rowCount: number,
  columnCount: number,
  axisX: number[],
  axisY: number[],
  xCandidate: number | null,
  yCandidate: number | null,
): { rowIndex: number | null; columnIndex: number | null } => {
  if (rowCount <= 0 || columnCount <= 0) {
    return { rowIndex: null, columnIndex: null };
  }

  let resolvedRow: number | null = null;
  let resolvedColumn: number | null = null;

  const considerPair = (rowCandidate: unknown, columnCandidate: unknown) => {
    const rowIndex = typeof rowCandidate === 'number' && Number.isFinite(rowCandidate)
      ? Math.round(rowCandidate)
      : null;
    const columnIndex = typeof columnCandidate === 'number' && Number.isFinite(columnCandidate)
      ? Math.round(columnCandidate)
      : null;

    if (
      rowIndex !== null && columnIndex !== null &&
      rowIndex >= 0 && rowIndex < rowCount &&
      columnIndex >= 0 && columnIndex < columnCount
    ) {
      resolvedRow = rowIndex;
      resolvedColumn = columnIndex;
      return true;
    }

    if (rowIndex !== null && rowIndex >= 0 && rowIndex < rowCount && resolvedRow === null) {
      resolvedRow = rowIndex;
    }
    if (columnIndex !== null && columnIndex >= 0 && columnIndex < columnCount && resolvedColumn === null) {
      resolvedColumn = columnIndex;
    }

    return false;
  };

  const rawPointIndex = (point as any).pointIndex ?? (point as any).pointIndices;
  if (Array.isArray(rawPointIndex) && rawPointIndex.length >= 2) {
    if (considerPair(rawPointIndex[0], rawPointIndex[1])) {
      return { rowIndex: resolvedRow, columnIndex: resolvedColumn };
    }
    if (considerPair(rawPointIndex[1], rawPointIndex[0])) {
      return { rowIndex: resolvedRow, columnIndex: resolvedColumn };
    }
  }

  const rawPointNumber = (point as any).pointNumber ?? (point as any).pointNumbers;
  if (Array.isArray(rawPointNumber) && rawPointNumber.length >= 2) {
    if (considerPair(rawPointNumber[0], rawPointNumber[1])) {
      return { rowIndex: resolvedRow, columnIndex: resolvedColumn };
    }
    if (considerPair(rawPointNumber[1], rawPointNumber[0])) {
      return { rowIndex: resolvedRow, columnIndex: resolvedColumn };
    }
  } else if (typeof rawPointNumber === 'number' && Number.isFinite(rawPointNumber) && columnCount > 0) {
    const rowIndex = Math.floor(rawPointNumber / columnCount);
    const columnIndex = rawPointNumber % columnCount;
    if (considerPair(rowIndex, columnIndex)) {
      return { rowIndex: resolvedRow, columnIndex: resolvedColumn };
    }
  }

  const iValue = typeof (point as any).i === 'number' ? (point as any).i : null;
  const jValue = typeof (point as any).j === 'number' ? (point as any).j : null;
  if (considerPair(jValue, iValue)) {
    return { rowIndex: resolvedRow, columnIndex: resolvedColumn };
  }

  if (resolvedColumn === null) {
    const candidate = findClosestAxisIndex(xCandidate, axisX);
    if (candidate !== null && candidate >= 0 && candidate < columnCount) {
      resolvedColumn = candidate;
    }
  }

  if (resolvedRow === null) {
    const candidate = findClosestAxisIndex(yCandidate, axisY);
    if (candidate !== null && candidate >= 0 && candidate < rowCount) {
      resolvedRow = candidate;
    }
  }

  return {
    rowIndex: resolvedRow,
    columnIndex: resolvedColumn,
  };
};

type MatrixStats = {
  min: number;
  max: number;
};

const computeMatrixStats = (matrix: (number | null)[][] | undefined): MatrixStats | null => {
  if (!Array.isArray(matrix)) {
    return null;
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  matrix.forEach((row) => {
    if (!Array.isArray(row)) {
      return;
    }
    row.forEach((value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (value < min) {
          min = value;
        }
        if (value > max) {
          max = value;
        }
      }
    });
  });

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }

  return { min, max };
};

const debugLog = (...args: unknown[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  const shouldLog = process.env.NODE_ENV !== 'production';
  if (shouldLog) {
    console.log('[QuantitativeResults]', ...args);
  }
};

const safeParseJson = <T,>(value: unknown, context: string): T | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    debugLog(`Failed to parse JSON for ${context}`, error);
    return null;
  }
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
  bounds?: BoundsTuple;
  rimElevationMeters?: number | null;
  maxDepthMeters?: number | null;
  meanDepthMeters?: number | null;
  volumeCubicMeters?: number | null;
  imageBase64?: string | null;
  probabilityMapBase64?: string | null;
  tileBounds?: BoundsTuple | null;
  tileTransform?: number[] | null;
  tileCrs?: string | null;
  blockPolygon?: PolygonRings | null;
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

interface QuantitativeVisualizationExtent {
  minX?: number | null;
  maxX?: number | null;
  minY?: number | null;
  maxY?: number | null;
}

interface QuantitativeBlockVisualizationNormalized {
  grid?: QuantitativeVisualizationGridNormalized | null;
  stats?: Record<string, any> | null;
  extentUTM?: QuantitativeVisualizationExtent | null;
  metadata?: Record<string, any> | null;
}

interface BlockImagerySnapshot {
  imageBase64?: string | null;
  probabilityBase64?: string | null;
  tileBounds?: BoundsTuple | null;
  blockBounds?: BoundsTuple | null;
  tileLabel?: string | null;
  transform?: number[] | null;
  crs?: string | null;
  blockPolygon?: PolygonRings | null;
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

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeCoordinate = (value: unknown): CoordinatePair | null => {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  const lon = toFiniteNumber(value[0]);
  const lat = toFiniteNumber(value[1]);
  if (lon === null || lat === null) {
    return null;
  }
  return [lon, lat];
};

const normalizeBoundsTuple = (bounds: unknown): BoundsTuple | null => {
  if (!bounds) {
    return null;
  }

  if (Array.isArray(bounds)) {
    if (bounds.length === 4 && bounds.every((value) => typeof value === 'number' || typeof value === 'string')) {
      const numeric = bounds
        .map((value) => (typeof value === 'number' ? value : Number(value)))
        .filter((value) => Number.isFinite(value)) as number[];
      if (numeric.length === 4) {
        const [minLon, minLat, maxLon, maxLat] = numeric as BoundsTuple;
        return [minLon, minLat, maxLon, maxLat];
      }
    }

    const coordinates = bounds
      .map((entry) => normalizeCoordinate(entry))
      .filter((entry): entry is CoordinatePair => !!entry);

    if (coordinates.length >= 2) {
      const lons = coordinates.map((coord) => coord[0]);
      const lats = coordinates.map((coord) => coord[1]);
      return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    }
  }

  return null;
};

const normalizePolygonRings = (geometry: any): PolygonRings | null => {
  if (!geometry || typeof geometry !== 'object') {
    return null;
  }

  const type = typeof geometry.type === 'string' ? geometry.type : null;
  const coordinates = geometry.coordinates;
  const rings: PolygonRings = [];

  const ingestPolygon = (polygon: unknown) => {
    if (!Array.isArray(polygon)) {
      return;
    }
    polygon.forEach((ringCandidate) => {
      if (!Array.isArray(ringCandidate)) {
        return;
      }
      const ring = ringCandidate
        .map((point) => normalizeCoordinate(point))
        .filter((point): point is CoordinatePair => !!point);
      if (ring.length >= 3) {
        rings.push(ring);
      }
    });
  };

  if (type === 'Polygon') {
    ingestPolygon(coordinates);
  } else if (type === 'MultiPolygon') {
    if (Array.isArray(coordinates)) {
      coordinates.forEach(ingestPolygon);
    }
  } else if (Array.isArray(coordinates)) {
    ingestPolygon(coordinates);
  }

  return rings.length ? rings : null;
};

const normalizeExtentUTM = (raw: any): QuantitativeVisualizationExtent | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const minX = toNumberOrNull(raw.minX ?? raw.min_x);
  const maxX = toNumberOrNull(raw.maxX ?? raw.max_x);
  const minY = toNumberOrNull(raw.minY ?? raw.min_y);
  const maxY = toNumberOrNull(raw.maxY ?? raw.max_y);

  if (minX === null && maxX === null && minY === null && maxY === null) {
    return null;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
  };
};

const boundsFromPolygon = (polygon: PolygonRings | null): BoundsTuple | null => {
  if (!polygon || !polygon.length) {
    return null;
  }
  const points = polygon.flat();
  if (!points.length) {
    return null;
  }
  const lons = points.map((coord) => coord[0]);
  const lats = points.map((coord) => coord[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
};

const parseGeometryCandidate = (candidate: unknown): any | null => {
  if (!candidate) {
    return null;
  }

  if (typeof candidate === 'string') {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      debugLog('Failed to parse geometry JSON', error);
      return null;
    }
  }

  if (typeof candidate === 'object') {
    return candidate;
  }

  return null;
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
    extentUTM: normalizeExtentUTM(raw.extentUTM),
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

const ContourPlot = memo(({
  grid,
  extent,
}: {
  grid: QuantitativeVisualizationGridNormalized;
  extent?: QuantitativeVisualizationExtent | null;
}) => {
  const rowCount = Array.isArray(grid?.elevation) ? grid.elevation.length : 0;
  const columnCount = rowCount > 0 && Array.isArray(grid.elevation?.[0]) ? grid.elevation[0]?.length ?? 0 : 0;
  const hasData = rowCount > 0 && columnCount > 0;

  const minX = extent?.minX ?? null;
  const maxX = extent?.maxX ?? null;
  const minY = extent?.minY ?? null;
  const maxY = extent?.maxY ?? null;

  const axisX = useMemo(
    () => computeAxisPositions(grid.x, columnCount, { min: minX, max: maxX, resolution: grid.resolutionX ?? null }),
    [columnCount, grid.resolutionX, grid.x, maxX, minX],
  );

  const axisY = useMemo(
    () => computeAxisPositions(grid.y, rowCount, { min: minY, max: maxY, resolution: grid.resolutionY ?? null }),
    [grid.resolutionY, grid.y, maxY, minY, rowCount],
  );

  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; z: number | null } | null>(null);
  const [graphInstance, setGraphInstance] = useState<any>(null);
  const graphInstanceRef = useRef<any>(null);

  const syncGraphInstance = useCallback((graphDiv: any) => {
    if (!graphDiv || graphInstanceRef.current === graphDiv) {
      return;
    }
    graphInstanceRef.current = graphDiv;
    setGraphInstance(graphDiv);
    setHoverInfo(null); // Reset to default fallback when plot re-initializes
  }, []);
  const defaultHoverInfo = useMemo(() => {
    if (!hasData) {
      return null;
    }
    const rowIndex = Math.max(0, Math.min(rowCount - 1, Math.floor(rowCount / 2)));
    const columnIndex = Math.max(0, Math.min(columnCount - 1, Math.floor(columnCount / 2)));

    const xCandidate = axisX[columnIndex];
    const yCandidate = axisY[rowIndex];
    const elevationCandidate = getMatrixValue(grid.elevation, rowIndex, columnIndex);

    if (!Number.isFinite(xCandidate) || !Number.isFinite(yCandidate)) {
      return null;
    }

    return {
      x: xCandidate as number,
      y: yCandidate as number,
      z: typeof elevationCandidate === 'number' && Number.isFinite(elevationCandidate) ? elevationCandidate : null,
    } as const;
  }, [axisX, axisY, columnCount, grid.elevation, hasData, rowCount]);

  useEffect(() => {
    if (!defaultHoverInfo) {
      return;
    }

    setHoverInfo((previous) => (previous ?? defaultHoverInfo));
  }, [defaultHoverInfo]);

  const data = useMemo<PlotlyDatum[]>(() => {
    if (!hasData) {
      return [];
    }
    return [
      {
        type: 'contour',
        x: axisX,
        y: axisY,
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
        hovertemplate: 'E: %{x:.2f} m<br>N: %{y:.2f} m<br>Elev: %{z:.2f} m<extra></extra>',
        hoverlabel: {
          bgcolor: 'rgba(0,0,0,0)',
          bordercolor: 'rgba(0,0,0,0)',
          font: { color: 'rgba(0,0,0,0)', size: 1, family: 'Inter, sans-serif' },
        },
        colorbar: {
          title: 'Elevation (m)',
          tickfont: { color: '#e2e8f0' },
          titlefont: { color: '#e2e8f0' },
        },
      },
    ];
  }, [axisX, axisY, grid.elevation, hasData]);

  const plotKey = useMemo(() => (
    `${rowCount}x${columnCount}-${axisX[0] ?? 'n'}-${axisX[axisX.length - 1] ?? 'n'}-${axisY[0] ?? 'n'}-${axisY[axisY.length - 1] ?? 'n'}`
  ), [axisX, axisY, columnCount, rowCount]);

  const handleHover = useCallback((event: PlotHoverEvent) => {
    const point = event.points?.[0];
    if (!point) {
      return;
    }

    const xCandidate = parseNumericValue(point.x as number | string | null | undefined);
    const yCandidate = parseNumericValue(point.y as number | string | null | undefined);
    let elevationCandidate = parseNumericValue(point.z as number | string | null | undefined);

    const { rowIndex, columnIndex } = inferGridIndices(point, rowCount, columnCount, axisX, axisY, xCandidate, yCandidate);

    let xValue: number | null = xCandidate;
    if ((typeof xValue !== 'number' || !Number.isFinite(xValue)) && columnIndex !== null && columnIndex < axisX.length) {
      const candidate = axisX[columnIndex];
      if (Number.isFinite(candidate)) {
        xValue = candidate;
      }
    }

    let yValue: number | null = yCandidate;
    if ((typeof yValue !== 'number' || !Number.isFinite(yValue)) && rowIndex !== null && rowIndex < axisY.length) {
      const candidate = axisY[rowIndex];
      if (Number.isFinite(candidate)) {
        yValue = candidate;
      }
    }

    if (typeof xValue !== 'number' || !Number.isFinite(xValue) || typeof yValue !== 'number' || !Number.isFinite(yValue)) {
      return;
    }

    if ((typeof elevationCandidate !== 'number' || !Number.isFinite(elevationCandidate)) && rowIndex !== null && columnIndex !== null) {
      elevationCandidate = getMatrixValue(grid.elevation, rowIndex, columnIndex);
    }

    const next = {
      x: xValue,
      y: yValue,
      z: typeof elevationCandidate === 'number' && Number.isFinite(elevationCandidate) ? elevationCandidate : null,
    } as const;

    setHoverInfo(next);
  }, [axisX, axisY, columnCount, grid.elevation, rowCount]);

  useEffect(() => {
    if (!graphInstance || typeof graphInstance.on !== 'function') {
      return undefined;
    }

    const hoverListener = (event: PlotHoverEvent) => {
      handleHover(event);
    };

    graphInstance.on('plotly_hover', hoverListener);

    return () => {
      if (typeof graphInstance.removeListener === 'function') {
        graphInstance.removeListener('plotly_hover', hoverListener);
      } else if (typeof graphInstance.off === 'function') {
        graphInstance.off('plotly_hover', hoverListener);
      }
    };
  }, [graphInstance, handleHover]);

  const layout = useMemo<PlotlyLayout>(
    () => ({
      autosize: true,
      height: 280,
      margin: { l: 46, r: 12, t: 32, b: 42 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#e2e8f0', family: 'Inter, sans-serif' },
      dragmode: 'pan',
      hovermode: 'closest',
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

  const displayInfo = hoverInfo ?? defaultHoverInfo ?? { x: null, y: null, z: null };

  const infoItems = [
    { key: 'easting', label: 'E', value: displayInfo.x, unit: 'm', decimals: 2 },
    { key: 'northing', label: 'N', value: displayInfo.y, unit: 'm', decimals: 2 },
    { key: 'elevation', label: 'Elev', value: displayInfo.z, unit: 'm', decimals: 2 },
  ] as const;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ position: 'relative', width: '100%', height: 280 }}>
        <Plot
          key={plotKey}
          data={data}
          layout={layout}
          config={plotConfig}
          style={{ width: '100%', height: '100%' }}
          onHover={handleHover}
          onInitialized={(_, graphDiv) => syncGraphInstance(graphDiv)}
          onUpdate={(_, graphDiv) => syncGraphInstance(graphDiv)}
        />
      </Box>
      <Stack
        direction="row"
        spacing={2.5}
        sx={{
          mt: 1,
          px: 1.75,
          py: 1,
          borderRadius: 1.5,
          background: 'rgba(15, 23, 42, 0.55)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          backdropFilter: 'blur(6px)',
          color: '#f8fafc',
          flexWrap: 'wrap',
          rowGap: 1.25,
        }}
      >
        {infoItems.map((item) => (
          <Stack
            key={item.key}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 120 }}
          >
            <Typography sx={{ fontSize: '0.75rem', letterSpacing: 1.5, textTransform: 'uppercase', color: '#94a3b8' }}>
              {item.label}
            </Typography>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 500 }}>
              {formatNumber(item.value, item.decimals)} {item.unit}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
});
ContourPlot.displayName = 'ContourPlot';

const SurfacePlot = memo(({
  grid,
  extent,
}: {
  grid: QuantitativeVisualizationGridNormalized;
  extent?: QuantitativeVisualizationExtent | null;
}) => {
  const rowCount = Array.isArray(grid?.elevation) ? grid.elevation.length : 0;
  const columnCount = rowCount > 0 && Array.isArray(grid.elevation?.[0]) ? grid.elevation[0]?.length ?? 0 : 0;
  const hasData = rowCount > 0 && columnCount > 0;

  const depthMatrix = Array.isArray(grid?.depth) && grid.depth.length ? grid.depth : undefined;

  const minX = extent?.minX ?? null;
  const maxX = extent?.maxX ?? null;
  const minY = extent?.minY ?? null;
  const maxY = extent?.maxY ?? null;

  const axisX = useMemo(
    () => computeAxisPositions(grid.x, columnCount, { min: minX, max: maxX, resolution: grid.resolutionX ?? null }),
    [columnCount, grid.resolutionX, grid.x, maxX, minX],
  );

  const axisY = useMemo(
    () => computeAxisPositions(grid.y, rowCount, { min: minY, max: maxY, resolution: grid.resolutionY ?? null }),
    [grid.resolutionY, grid.y, maxY, minY, rowCount],
  );

  const elevationStats = useMemo(() => computeMatrixStats(grid.elevation), [grid.elevation]);
  const colorScale: PlotlyDatum['colorscale'] = 'Portland';
  const colorRange = elevationStats;

  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; elevation: number | null; depth: number | null } | null>(null);
  const [graphInstance, setGraphInstance] = useState<any>(null);
  const graphInstanceRef = useRef<any>(null);

  const syncGraphInstance = useCallback((graphDiv: any) => {
    if (!graphDiv || graphInstanceRef.current === graphDiv) {
      return;
    }
    graphInstanceRef.current = graphDiv;
    setGraphInstance(graphDiv);
    setHoverInfo(null); // Reset to default metrics when surface plot reloads
  }, []);
  const defaultHoverInfo = useMemo(() => {
    if (!hasData) {
      return null;
    }

    const rowIndex = Math.max(0, Math.min(rowCount - 1, Math.floor(rowCount / 2)));
    const columnIndex = Math.max(0, Math.min(columnCount - 1, Math.floor(columnCount / 2)));

    const xCandidate = axisX[columnIndex];
    const yCandidate = axisY[rowIndex];

    if (!Number.isFinite(xCandidate) || !Number.isFinite(yCandidate)) {
      return null;
    }

    const elevationCandidate = getMatrixValue(grid.elevation, rowIndex, columnIndex);
    let depthCandidate = getMatrixValue(depthMatrix, rowIndex, columnIndex);

    if ((depthCandidate === null || !Number.isFinite(depthCandidate)) && typeof grid.rimElevation === 'number' && Number.isFinite(grid.rimElevation) && typeof elevationCandidate === 'number' && Number.isFinite(elevationCandidate)) {
      const derivedDepth = grid.rimElevation - elevationCandidate;
      if (Number.isFinite(derivedDepth)) {
        depthCandidate = derivedDepth < 0 ? 0 : derivedDepth;
      }
    }

    const normalizedDepth = typeof depthCandidate === 'number' && Number.isFinite(depthCandidate)
      ? depthCandidate
      : null;

    return {
      x: xCandidate as number,
      y: yCandidate as number,
      elevation: typeof elevationCandidate === 'number' && Number.isFinite(elevationCandidate) ? elevationCandidate : null,
      depth: normalizedDepth,
    } as const;
  }, [axisX, axisY, columnCount, depthMatrix, grid.elevation, grid.rimElevation, hasData, rowCount]);

  useEffect(() => {
    if (!defaultHoverInfo) {
      return;
    }

    setHoverInfo((previous) => (previous ?? defaultHoverInfo));
  }, [defaultHoverInfo]);

  const data = useMemo<PlotlyDatum[]>(() => {
    if (!hasData) {
      return [];
    }
  const colorMatrix = grid.elevation;
    return [
      {
        type: 'surface',
        x: axisX,
        y: axisY,
        z: grid.elevation,
        surfacecolor: colorMatrix,
        colorscale: colorScale,
        reversescale: false,
        showscale: true,
        colorbar: {
          title: 'Elevation (m)',
          tickfont: { color: '#e2e8f0' },
          titlefont: { color: '#e2e8f0' },
        },
        opacity: 0.95,
        hovertemplate: depthMatrix
          ? 'E: %{x:.2f} m<br>N: %{y:.2f} m<br>Elev: %{z:.2f} m<br>Depth: %{customdata:.2f} m<extra></extra>'
          : 'E: %{x:.2f} m<br>N: %{y:.2f} m<br>Elev: %{z:.2f} m<extra></extra>',
        hoverlabel: {
          bgcolor: 'rgba(0,0,0,0)',
          bordercolor: 'rgba(0,0,0,0)',
          font: { color: 'rgba(0,0,0,0)', size: 1, family: 'Inter, sans-serif' },
        },
        customdata: depthMatrix,
        cmin: colorRange?.min ?? undefined,
        cmax: colorRange?.max ?? undefined,
      },
    ];
  }, [axisX, axisY, colorRange?.max, colorRange?.min, colorScale, depthMatrix, grid.elevation, hasData]);

  const plotKey = useMemo(() => (
    `${rowCount}x${columnCount}-${axisX[0] ?? 'n'}-${axisX[axisX.length - 1] ?? 'n'}-${axisY[0] ?? 'n'}-${axisY[axisY.length - 1] ?? 'n'}-${colorRange?.min ?? 'n'}-${colorRange?.max ?? 'n'}`
  ), [axisX, axisY, colorRange?.max, colorRange?.min, columnCount, rowCount]);

  const handleHover = useCallback((event: PlotHoverEvent) => {
    const point = event.points?.[0];
    if (!point) {
      return;
    }

    const xCandidate = parseNumericValue(point.x as number | string | null | undefined);
    const yCandidate = parseNumericValue(point.y as number | string | null | undefined);
    let elevationCandidate = parseNumericValue(point.z as number | string | null | undefined);

    const { rowIndex, columnIndex } = inferGridIndices(point, rowCount, columnCount, axisX, axisY, xCandidate, yCandidate);

    let xValue: number | null = xCandidate;
    if ((typeof xValue !== 'number' || !Number.isFinite(xValue)) && columnIndex !== null && columnIndex < axisX.length) {
      const candidate = axisX[columnIndex];
      if (Number.isFinite(candidate)) {
        xValue = candidate;
      }
    }

    let yValue: number | null = yCandidate;
    if ((typeof yValue !== 'number' || !Number.isFinite(yValue)) && rowIndex !== null && rowIndex < axisY.length) {
      const candidate = axisY[rowIndex];
      if (Number.isFinite(candidate)) {
        yValue = candidate;
      }
    }

    if (typeof xValue !== 'number' || !Number.isFinite(xValue) || typeof yValue !== 'number' || !Number.isFinite(yValue)) {
      return;
    }

    if ((typeof elevationCandidate !== 'number' || !Number.isFinite(elevationCandidate)) && rowIndex !== null && columnIndex !== null) {
      elevationCandidate = getMatrixValue(grid.elevation, rowIndex, columnIndex);
    }

    let depthCandidate: number | null = getMatrixValue(depthMatrix, rowIndex, columnIndex);

    if (depthCandidate === null) {
      const rawDepth = Array.isArray(point.customdata)
        ? point.customdata[point.customdata.length - 1]
        : point.customdata ?? point.surfacecolor;
      const parsedDepth = parseNumericValue(rawDepth as number | string | null | undefined);
      if (parsedDepth !== null) {
        depthCandidate = parsedDepth;
      } else if (typeof point.surfacecolor === 'number' && Number.isFinite(point.surfacecolor)) {
        depthCandidate = point.surfacecolor;
      }
    }

    if ((depthCandidate === null || !Number.isFinite(depthCandidate)) && typeof grid.rimElevation === 'number' && Number.isFinite(grid.rimElevation) && typeof elevationCandidate === 'number' && Number.isFinite(elevationCandidate)) {
      const derivedDepth = grid.rimElevation - elevationCandidate;
      if (Number.isFinite(derivedDepth)) {
        depthCandidate = derivedDepth < 0 ? 0 : derivedDepth;
      }
    }

    const normalizedDepth = typeof depthCandidate === 'number' && Number.isFinite(depthCandidate)
      ? depthCandidate
      : null;

    const next = {
      x: xValue,
      y: yValue,
      elevation: typeof elevationCandidate === 'number' && Number.isFinite(elevationCandidate) ? elevationCandidate : null,
      depth: normalizedDepth,
    } as const;

    setHoverInfo(next);
  }, [axisX, axisY, columnCount, depthMatrix, grid.elevation, grid.rimElevation, rowCount]);

  useEffect(() => {
    if (!graphInstance || typeof graphInstance.on !== 'function') {
      return undefined;
    }

    const hoverListener = (event: PlotHoverEvent) => {
      handleHover(event);
    };

    graphInstance.on('plotly_hover', hoverListener);

    return () => {
      if (typeof graphInstance.removeListener === 'function') {
        graphInstance.removeListener('plotly_hover', hoverListener);
      } else if (typeof graphInstance.off === 'function') {
        graphInstance.off('plotly_hover', hoverListener);
      }
    };
  }, [graphInstance, handleHover]);

  const surfacePlotConfig = useMemo<PlotlyConfig>(
    () => ({
      ...plotConfig,
      modeBarButtonsToAdd: ['orbitRotation', 'hoverClosest3d', 'resetCameraLastSave3d'],
      modeBarButtonsToRemove: ['resetCameraDefault3d'],
    }),
    [],
  );

  const layout = useMemo<PlotlyLayout>(
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
          title: 'Elevation (m)',
          color: '#e2e8f0',
          gridcolor: 'rgba(148, 163, 184, 0.35)',
          zerolinecolor: 'rgba(148, 163, 184, 0.45)',
        },
        camera: {
          eye: { x: 1.35, y: 1.45, z: 1.25 },
          up: { x: 0, y: 0, z: 1 },
          center: { x: 0, y: 0, z: 0 },
        },
        aspectmode: 'data',
        aspectratio: { x: 1, y: 1, z: 0.5 },
        dragmode: 'orbit',
      },
      hovermode: 'closest',
      uirevision: 'surface-view',
    }),
    [],
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

  const displayInfo = hoverInfo ?? defaultHoverInfo ?? { x: null, y: null, elevation: null, depth: null };

  const infoItems = [
    { key: 'easting', label: 'E', value: displayInfo.x, unit: 'm', decimals: 2 },
    { key: 'northing', label: 'N', value: displayInfo.y, unit: 'm', decimals: 2 },
    { key: 'elevation', label: 'Elev', value: displayInfo.elevation, unit: 'm', decimals: 2 },
    { key: 'depth', label: 'Depth', value: displayInfo.depth, unit: 'm', decimals: 2 },
  ] as const;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ position: 'relative', width: '100%', height: 280 }}>
        <Plot
          key={plotKey}
          data={data}
          layout={layout}
          config={surfacePlotConfig}
          style={{ width: '100%', height: '100%' }}
          onHover={handleHover}
          onInitialized={(_, graphDiv) => syncGraphInstance(graphDiv)}
          onUpdate={(_, graphDiv) => syncGraphInstance(graphDiv)}
        />
      </Box>
      <Stack
        direction="row"
        spacing={2.5}
        sx={{
          mt: 1,
          px: 1.75,
          py: 1,
          borderRadius: 1.5,
          background: 'rgba(15, 23, 42, 0.55)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          backdropFilter: 'blur(6px)',
          color: '#f8fafc',
          flexWrap: 'wrap',
          rowGap: 1.25,
        }}
      >
        {infoItems.map((item) => (
          <Stack
            key={item.key}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 120 }}
          >
            <Typography sx={{ fontSize: '0.75rem', letterSpacing: 1.5, textTransform: 'uppercase', color: '#94a3b8' }}>
              {item.label}
            </Typography>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 500 }}>
              {formatNumber(item.value, item.decimals)} {item.unit}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
});
SurfacePlot.displayName = 'SurfacePlot';

const BlockMosaicPreview = memo(({ imagery, label }: { imagery: BlockImagerySnapshot | null; label: string }) => {
  const hasRgb = !!imagery?.imageBase64;
  const { tileBounds, blockBounds, blockPolygon } = imagery ?? {};

  const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

  const polygonPaths = useMemo(() => {
    if (!tileBounds || !blockPolygon || !blockPolygon.length) {
      return null;
    }

    const [tileMinLon, tileMinLat, tileMaxLon, tileMaxLat] = tileBounds;
    const lonSpan = tileMaxLon - tileMinLon;
    const latSpan = tileMaxLat - tileMinLat;

    if (lonSpan <= 0 || latSpan <= 0) {
      return null;
    }

    const toPoint = (coord: CoordinatePair): string | null => {
      const [lon, lat] = coord;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return null;
      }
      const relX = ((lon - tileMinLon) / lonSpan) * 100;
      const relY = ((tileMaxLat - lat) / latSpan) * 100;
      if (!Number.isFinite(relX) || !Number.isFinite(relY)) {
        return null;
      }
  return `${clamp(relX).toFixed(4)},${clamp(relY).toFixed(4)}`;
    };

    const rings = blockPolygon
      .map((ring) => {
        const path = ring
          .map((point) => toPoint(point))
          .filter((point): point is string => !!point);
        return path.length >= 3 ? path.join(' ') : null;
      })
      .filter((ring): ring is string => !!ring);

    return rings.length ? rings : null;
  }, [tileBounds, blockPolygon]);

  let overlaySx: Record<string, string | number> | null = null;

  if (!polygonPaths && tileBounds && blockBounds) {
    const [tileMinLon, tileMinLat, tileMaxLon, tileMaxLat] = tileBounds;
    const [blockMinLon, blockMinLat, blockMaxLon, blockMaxLat] = blockBounds;
    const lonSpan = tileMaxLon - tileMinLon;
    const latSpan = tileMaxLat - tileMinLat;

    if (lonSpan > 0 && latSpan > 0) {
      const leftPct = ((blockMinLon - tileMinLon) / lonSpan) * 100;
      const widthPct = ((blockMaxLon - blockMinLon) / lonSpan) * 100;
      const topPct = ((tileMaxLat - blockMaxLat) / latSpan) * 100;
      const heightPct = ((blockMaxLat - blockMinLat) / latSpan) * 100;

      overlaySx = {
        position: 'absolute',
        left: `${clamp(leftPct)}%`,
        top: `${clamp(topPct)}%`,
        width: `${clamp(widthPct)}%`,
        height: `${clamp(heightPct)}%`,
        border: '2px solid rgba(236, 201, 75, 0.95)',
        boxShadow: '0 0 12px rgba(236, 201, 75, 0.45)',
        borderRadius: 6,
        pointerEvents: 'none',
      };
    }
  }

  const imageSrc = hasRgb ? imagery?.imageBase64 ?? null : null;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        paddingTop: '100%',
        borderRadius: 1.5,
        overflow: 'hidden',
        border: imageSrc ? '1px solid rgba(148, 163, 184, 0.35)' : '1px dashed rgba(148, 163, 184, 0.35)',
        background: 'rgba(15, 23, 42, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(148, 163, 184, 0.75)',
        fontSize: '0.75rem',
        textAlign: 'center',
      }}
    >
      {imageSrc ? (
        <>
          <Box
            component="img"
            alt={`${label} satellite preview`}
            src={`data:image/png;base64,${imageSrc}`}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'saturate(1.05) contrast(1.05)',
            }}
          />
          {polygonPaths && (
            <Box
              component="svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              {polygonPaths.map((points, index) => (
                <polygon
                  key={`poly-${index}`}
                  points={points}
                  fill="rgba(236, 201, 75, 0.18)"
                  stroke="rgba(236, 201, 75, 0.92)"
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </Box>
          )}
        </>
      ) : (
        'Satellite preview unavailable'
      )}
      {!polygonPaths && overlaySx && <Box sx={overlaySx} />}
    </Box>
  );
});
BlockMosaicPreview.displayName = 'BlockMosaicPreview';

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
  const initialQuantAttemptRef = useRef(false);
  const quantitativeInFlightRef = useRef(false);
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

        const normalizedResults = safeParseJson<AnalysisResults>(record?.results, 'history.results');
        const normalizedQuantitative = safeParseJson<QuantitativeAnalysisSnapshot>(
          record?.quantitativeAnalysis,
          'history.quantitativeAnalysis',
        );

        const hydratedRecord: AnalysisHistoryRecord = {
          ...record,
          results: (normalizedResults
            ?? (typeof record?.results === 'object' && record?.results !== null
              ? (record.results as AnalysisResults)
              : undefined)) as AnalysisResults | undefined,
          quantitativeAnalysis: normalizedQuantitative
            ?? (typeof record?.quantitativeAnalysis === 'object' && record?.quantitativeAnalysis !== null
              ? record.quantitativeAnalysis as QuantitativeAnalysisSnapshot
              : undefined),
        };

        debugLog('History record loaded', {
          analysisId,
          hasResults: !!hydratedRecord.results,
          hasQuantitative: !!hydratedRecord.quantitativeAnalysis,
        });

        setHistoryRecord(hydratedRecord);
        if (hydratedRecord.results) {
          setResults(hydratedRecord.results);
          debugLog('Baseline detections hydrated', {
            analysisId,
            tileCount: Array.isArray(hydratedRecord.results.tiles)
              ? hydratedRecord.results.tiles.length
              : 0,
            detectionCount: (hydratedRecord.results as any)?.detectionCount
              ?? (hydratedRecord.results as any)?.statistics?.totalDetections
              ?? null,
          });
        }

        if (hydratedRecord.quantitativeAnalysis) {
          const normalizedStored = normalizeQuantitativeResponse(
            analysisId,
            hydratedRecord.quantitativeAnalysis,
            true,
          );

          const hasVisualization = normalizedStored.blocks.some((block) => {
            const grid = block.visualization?.grid;
            return Array.isArray(grid?.elevation)
              && grid.elevation.length > 0
              && Array.isArray(grid.elevation[0])
              && grid.elevation[0].length > 0;
          });

          debugLog('Persisted quantitative snapshot loaded', {
            analysisId,
            blockCount: normalizedStored.blocks.length,
            executedAt: normalizedStored.executedAt,
            hasVisualization,
          });

          setQuantitativeResult(normalizedStored);
          setPersistState('saved');
          const storedExecutedAt = normalizedStored.executedAt
            ?? toDateISOString(hydratedRecord.quantitativeAnalysis?.executedAt)
            ?? toDateISOString(hydratedRecord.updatedAt);
          setPersistedAt(storedExecutedAt);
          initialQuantAttemptRef.current = true;
        }

        if (hydratedRecord.results) {
          setLoading(false);
          if (!hydratedRecord.quantitativeAnalysis) {
            initialQuantAttemptRef.current = false;
            setShouldRecompute(true);
          }
          return;
        }
      } catch (apiError) {
        debugLog('History lookup failed, attempting live pipeline fallback', apiError);
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

        debugLog('Live pipeline payload loaded', {
          analysisId,
          tiles: Array.isArray(data?.tiles) ? data.tiles.length : 0,
          detections: (data?.detectionCount ?? data?.statistics?.totalDetections) ?? null,
        });

  setResults(data);
  setHistoryRecord((prev) => (prev ? { ...prev, results: data as AnalysisResults } : prev));
        initialQuantAttemptRef.current = false;
        setShouldRecompute(true);
      } catch (liveError: any) {
        console.error('❌ Unable to load quantitative data', liveError);
        debugLog('Live pipeline fetch failed', { analysisId, message: liveError?.message ?? 'Unknown error' });
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

    debugLog('Manual recompute requested', { analysisId, hasBaseline: !!results });

    if (!results) {
      setQuantitativeError('Baseline detections are not available yet. Reload the page once detections finish.');
      return;
    }

    setQuantitativeError(null);
    setPersistError(null);
    setPersistState('idle');
    setPersistedAt(null);
    bootstrapQuantTriggeredRef.current = true;
    initialQuantAttemptRef.current = true;
    setShouldRecompute(true);
  };

  useEffect(() => {
    if (!results) {
      return;
    }

    if (!quantitativeResult && !initialQuantAttemptRef.current) {
      initialQuantAttemptRef.current = true;
      setShouldRecompute(true);
    }
  }, [results, quantitativeResult]);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    if (!results) {
      return;
    }

    if (!shouldRecompute) {
      if (quantitativeResult) {
      if (requiresFreshQuantitative && !bootstrapQuantTriggeredRef.current) {
        bootstrapQuantTriggeredRef.current = true;
        setShouldRecompute(true);
      } else if (!requiresFreshQuantitative && bootstrapQuantTriggeredRef.current) {
        bootstrapQuantTriggeredRef.current = false;
      }
      }
      return;
    }

    if (quantitativeInFlightRef.current) {
      debugLog('Quantitative pipeline already running, skipping duplicate trigger', { analysisId });
      return;
    }

    let cancelled = false;

    const runQuantitativeAnalysis = async () => {
      quantitativeInFlightRef.current = true;
      setQuantitativeLoading(true);
      setQuantitativeError(null);
      setPersistError(null);
      setPersistState('idle');
      setPersistedAt(null);

      try {
        debugLog('Invoking quantitative pipeline', {
          analysisId,
          bootstrapTrigger: bootstrapQuantTriggeredRef.current,
          hasVisualization: quantitativeResult?.blocks?.some((block) => {
            const grid = block.visualization?.grid;
            return Array.isArray(grid?.elevation) && grid.elevation.length > 0;
          }) ?? false,
        });

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

        if (!cancelled) {
          setQuantitativeResult(normalized);
          setPersistedAt(normalized.executedAt ?? toDateISOString(new Date()));
          debugLog('Quantitative pipeline completed', {
            analysisId,
            blockCount: normalized.blocks.length,
            executedAt: normalized.executedAt,
          });
        }
      } catch (quantError: any) {
        console.error('❌ Quantitative analysis failed', quantError);
        debugLog('Quantitative pipeline failed', { analysisId, message: quantError?.message ?? 'Unknown error' });
        if (!cancelled) {
          const message = quantError?.message ?? 'Unable to compute volumetric metrics';
          setQuantitativeError(message);
          setPersistState('error');
          setPersistError(message);
        }
      } finally {
        quantitativeInFlightRef.current = false;
        if (!cancelled) {
          setQuantitativeLoading(false);
          setShouldRecompute(false);
          debugLog('Quantitative pipeline settled', {
            analysisId,
            shouldRecompute: false,
          });
        } else {
          debugLog('Quantitative pipeline run cancelled before completion', { analysisId });
        }
      }
    };

    runQuantitativeAnalysis();

    return () => {
      cancelled = true;
      quantitativeInFlightRef.current = false;
    };
  }, [analysisId, results, shouldRecompute, quantitativeResult, requiresFreshQuantitative]);

  useEffect(() => {
    if (!analysisId || !quantitativeResult) {
      return;
    }

    debugLog('Quantitative result snapshot updated', {
      analysisId,
      blockCount: quantitativeResult.blocks.length,
      persisted: quantitativeResult.isPersisted ?? false,
      executedAt: quantitativeResult.executedAt ?? null,
    });
  }, [analysisId, quantitativeResult]);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    debugLog('Quantitative loading state changed', {
      analysisId,
      quantitativeLoading,
      shouldRecompute,
    });
  }, [analysisId, quantitativeLoading, shouldRecompute]);

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

        debugLog('Persisting quantitative snapshot', {
          analysisId,
          blockCount: quantitativeResult.blocks.length,
        });

        await saveQuantitativeAnalysis(analysisId, payload);

        if (!cancelled) {
          setPersistState('saved');
          setPersistedAt(toDateISOString(payload.executedAt ?? new Date()));
          setQuantitativeResult((prev) => (prev ? { ...prev, isPersisted: true } : prev));
          debugLog('Quantitative snapshot persisted', {
            analysisId,
            executedAt: payload.executedAt ?? null,
          });
        }
      } catch (error: any) {
        if (!cancelled) {
          const message = error?.message ?? 'Failed to store quantitative analysis';
          setPersistState('error');
          setPersistError(message);
          debugLog('Persist quantitative snapshot failed', {
            analysisId,
            message,
          });
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

  const blockImageryMap = useMemo(() => {
    const map = new Map<string, BlockImagerySnapshot>();
    if (!results) {
      return map;
    }

    const normalizeTransform = (input: unknown): number[] | null => {
      if (!Array.isArray(input)) {
        return null;
      }
      const asNumbers = input
        .slice(0, 6)
        .map((value) => (typeof value === 'number' ? value : Number(value)))
        .filter((value) => Number.isFinite(value)) as number[];
      return asNumbers.length === 6 ? asNumbers : null;
    };

    const tiles = Array.isArray(results.tiles) ? results.tiles : [];
    tiles.forEach((tile: any) => {
      const imageBase64 = typeof tile?.image_base64 === 'string' ? tile.image_base64 : null;
      const probabilityBase64 = typeof tile?.probability_map_base64 === 'string' ? tile.probability_map_base64 : null;
      const tileBounds = normalizeBoundsTuple(tile?.bounds);
      const transform = normalizeTransform(tile?.transform ?? tile?.affine ?? null);
      const crs = typeof tile?.crs === 'string' ? tile.crs : null;
      const blocks = Array.isArray(tile?.mine_blocks) ? tile.mine_blocks : [];

      blocks.forEach((block: any) => {
        const props = block?.properties || {};
        const geometry = parseGeometryCandidate(block?.geometry ?? props.geometry ?? props.geom ?? null);
        const polygon = normalizePolygonRings(geometry);
        const blockBounds = normalizeBoundsTuple(props.bbox) ?? boundsFromPolygon(polygon);
        const keyCandidates = [
          props.persistent_id,
          props.persistentId,
          props.block_id,
          props.id,
          props.name,
        ]
          .map((value) => (typeof value === 'string' ? value : value != null ? String(value) : null))
          .filter((value): value is string => !!value);

        if (!keyCandidates.length) {
          return;
        }

        keyCandidates.forEach((key) => {
          if (!key || map.has(key)) {
            return;
          }

          map.set(key, {
            imageBase64,
            probabilityBase64,
            tileBounds,
            blockBounds,
            tileLabel: tile?.tile_label ?? tile?.tile_id ?? null,
            transform,
            crs,
            blockPolygon: polygon,
          });
        });
      });
    });

    return map;
  }, [results]);

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
    const normalizeTransformLocal = (input: unknown): number[] | null => {
      if (!Array.isArray(input)) {
        return null;
      }
      const asNumbers = input
        .slice(0, 6)
        .map((value) => (typeof value === 'number' ? value : Number(value)))
        .filter((value) => Number.isFinite(value)) as number[];
      return asNumbers.length === 6 ? asNumbers : null;
    };

    const resolveImagery = (candidates: Array<string | number | null | undefined>): BlockImagerySnapshot | null => {
      for (const candidate of candidates) {
        if (candidate === null || candidate === undefined) {
          continue;
        }
        const key = typeof candidate === 'string' ? candidate : String(candidate);
        if (!key) {
          continue;
        }
        const snapshot = blockImageryMap.get(key);
        if (snapshot) {
          return snapshot;
        }
      }
      return null;
    };

    const fallbackQuantitativeBlocks = (quantitativeResult?.blocks ?? []).map((block, index) => {
      const areaHa = typeof block.areaHectares === 'number'
        ? block.areaHectares
        : typeof block.areaSquareMeters === 'number'
          ? block.areaSquareMeters / 10_000
          : 0;

      const imagery = resolveImagery([
        block.persistentId,
        block.blockId,
        block.blockLabel,
      ]);

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
        imageBase64: imagery?.imageBase64 ?? null,
        probabilityMapBase64: imagery?.probabilityBase64 ?? null,
        bounds: imagery?.blockBounds ?? undefined,
        tileBounds: imagery?.tileBounds ?? null,
        tileTransform: imagery?.transform ?? null,
        tileCrs: imagery?.crs ?? null,
        blockPolygon: imagery?.blockPolygon ?? null,
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
      const geometry = parseGeometryCandidate(feature?.geometry ?? props.geometry ?? null);
      const polygon = normalizePolygonRings(geometry);
      const centroidArray = Array.isArray(props.label_position) && props.label_position.length >= 2
        ? props.label_position.map((value: any) => (typeof value === 'number' ? value : Number(value)))
        : undefined;
      const boundsArray = normalizeBoundsTuple(props.bbox) ?? boundsFromPolygon(polygon) ?? undefined;

      const metrics = quantitativeMetricMap.get(props.persistent_id || blockId) || quantitativeMetricMap.get(name);
      const imagery = resolveImagery([
        props.persistent_id,
        blockId,
        name,
      ]);

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
        imageBase64: imagery?.imageBase64 ?? null,
        probabilityMapBase64: imagery?.probabilityBase64 ?? null,
        tileBounds: imagery?.tileBounds ?? null,
        tileTransform: imagery?.transform ?? null,
        tileCrs: imagery?.crs ?? null,
        blockPolygon: imagery?.blockPolygon ?? polygon ?? null,
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
            const geometry = parseGeometryCandidate(block?.geometry ?? props.geometry ?? props.geom ?? null);
            const polygon = normalizePolygonRings(geometry);
            const centroidArray = Array.isArray(props.label_position) && props.label_position.length >= 2
              ? props.label_position.map((value: any) => (typeof value === 'number' ? value : Number(value)))
              : undefined;
            const boundsArray = normalizeBoundsTuple(props.bbox) ?? boundsFromPolygon(polygon) ?? undefined;

            const metrics = quantitativeMetricMap.get(props.persistent_id || blockId) || quantitativeMetricMap.get(displayLabel);
            const imagery = resolveImagery([
              props.persistent_id,
              blockId,
              displayLabel,
            ]) || {
              imageBase64: typeof tile?.image_base64 === 'string' ? tile.image_base64 : null,
              probabilityBase64: typeof tile?.probability_map_base64 === 'string' ? tile.probability_map_base64 : null,
              tileBounds: normalizeBoundsTuple(tile?.bounds),
              blockBounds: boundsArray ?? null,
              tileLabel: tileLabel,
              transform: normalizeTransformLocal(tile?.transform ?? tile?.affine ?? null),
              crs: typeof tile?.crs === 'string' ? tile.crs : null,
              blockPolygon: polygon ?? null,
            };

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
              imageBase64: imagery?.imageBase64 ?? null,
              probabilityMapBase64: imagery?.probabilityBase64 ?? null,
              tileBounds: imagery?.tileBounds ?? null,
              tileTransform: imagery?.transform ?? null,
              tileCrs: imagery?.crs ?? null,
              blockPolygon: imagery?.blockPolygon ?? polygon ?? null,
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
  }, [results, quantitativeMetricMap, quantitativeResult?.blocks, blockImageryMap]);

  const mineBlockRowIndex = useMemo(() => {
    const map = new Map<string, MineBlockRow>();
    mineBlockRows.forEach((row) => {
      const keys = [row.persistentId, row.id, row.label];
      keys.forEach((key) => {
        if (key === undefined || key === null) {
          return;
        }
        const normalized = typeof key === 'string' ? key : String(key);
        if (normalized) {
          map.set(normalized, row);
        }
      });
    });
    return map;
  }, [mineBlockRows]);

  const getBlockImagery = useCallback((block: QuantitativeBlockMetric): BlockImagerySnapshot | null => {
    const keys = [block.persistentId, block.blockId, block.blockLabel];
    let fallback: BlockImagerySnapshot | null = null;

    for (const candidate of keys) {
      if (candidate === null || candidate === undefined) {
        continue;
      }
      const key = typeof candidate === 'string' ? candidate : String(candidate);
      if (!key) {
        continue;
      }

      const snapshot = blockImageryMap.get(key);
      if (snapshot?.imageBase64) {
        return snapshot;
      }
      if (!fallback && snapshot) {
        fallback = snapshot;
      }

      const row = mineBlockRowIndex.get(key);
      if (row) {
        const rowSnapshot: BlockImagerySnapshot = {
          imageBase64: row.imageBase64 ?? null,
          probabilityBase64: row.probabilityMapBase64 ?? null,
          tileBounds: row.tileBounds ?? null,
          blockBounds: row.bounds ?? null,
          tileLabel: row.tileId ?? null,
          transform: row.tileTransform ?? null,
          crs: row.tileCrs ?? null,
          blockPolygon: row.blockPolygon ?? null,
        };
        if (rowSnapshot.imageBase64) {
          return rowSnapshot;
        }
        if (!fallback && (rowSnapshot.tileBounds || rowSnapshot.blockBounds)) {
          fallback = rowSnapshot;
        }
      }
    }

    return fallback;
  }, [blockImageryMap, mineBlockRowIndex]);

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
                        <TableCell sx={{ color: '#e2e8f0', backgroundColor: 'rgba(15, 23, 42, 0.8)', fontWeight: 700 }}>Satellite Mosaic</TableCell>
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
                        const extent = block.visualization?.extentUTM;
                        const imagery = getBlockImagery(block);
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
                            <TableCell sx={{ minWidth: 220, verticalAlign: 'top' }}>
                              <BlockMosaicPreview imagery={imagery} label={block.blockLabel ?? block.blockId ?? 'Mine block'} />
                            </TableCell>
                            <TableCell sx={{ minWidth: 320, verticalAlign: 'top' }}>
                              {grid ? <ContourPlot grid={grid} extent={extent} /> : (
                                <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.8rem' }}>
                                  Not available
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ minWidth: 320, verticalAlign: 'top' }}>
                              {grid ? <SurfacePlot grid={grid} extent={extent} /> : (
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
