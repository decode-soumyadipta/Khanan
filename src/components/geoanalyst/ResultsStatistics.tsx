'use client';
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { deriveTileAreaMetrics, deriveConfidenceMetrics, parseNumeric } from '@/lib/analysisMetrics';

const GoldenText = styled(Typography)({
  background: 'linear-gradient(to right, #fbbf24, #fcd34d, #fbbf24)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 2px 4px rgba(251, 191, 36, 0.3))'
});

interface AnalysisSummary {
  analysis_id?: string;
  total_tiles?: number;
  tiles_with_detections?: number;
  mining_detected?: boolean;
  mine_block_count?: number;
  mining_pixels?: number;
  total_pixels?: number;
  mining_percentage?: number;
  mining_area_m2?: number;
  confidence?: number;
  mask_shape?: [number, number];
  bounds?: number[][];
  crs?: string;
}

interface MineBlockFeature {
  properties?: Record<string, unknown>;
}

interface AnalysisTile {
  tile_id?: string;
  status?: string;
  bounds?: number[][];
  mining_detected?: boolean;
  miningDetected?: boolean;
  mining_percentage?: number;
  miningPercentage?: number;
  num_mine_blocks?: number;
  confidence?: number;
  total_area_m2?: number;
  mine_blocks?: MineBlockFeature[];
  mineBlocks?: MineBlockFeature[];
  mask_shape?: [number, number];
}

interface DetectionResults {
  analysis_id?: string;
  status?: string;
  summary?: AnalysisSummary;
  tiles?: AnalysisTile[];
  statistics?: {
    avgConfidence?: number;
    maxConfidence?: number;
    minConfidence?: number;
    coveragePercentage?: number;
  };
}

interface ResultsStatisticsProps {
  results: DetectionResults;
  onOpenQuantitativeAnalysis?: () => void;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const formatNumber = (value: number | undefined | null, fractionDigits = 0) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0';
  }

  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

export const ResultsStatistics: React.FC<ResultsStatisticsProps> = ({ results, onOpenQuantitativeAnalysis }) => {
  const tiles = results.tiles ?? [];
  const mosaicTile = tiles.find(tile => tile.status === 'mosaic' || tile.tile_id === 'mosaic');
  const tileAreaMetrics = deriveTileAreaMetrics(tiles as any);

  const totalTiles = tiles.length;
  const tilesWithDetections = tiles.filter(tile => tile.mining_detected || tile.miningDetected).length;
  const totalMineBlocks = tiles.reduce((sum, tile) => sum + (tile.num_mine_blocks ?? 0), 0);
  const confidenceMetrics = deriveConfidenceMetrics(results);

  const summary = results.summary ?? {};
  const summaryTotalTiles = summary.total_tiles ?? totalTiles;
  const summaryTilesWithDetections = summary.tiles_with_detections ?? tilesWithDetections;
  const summaryMineBlocks = summary.mine_block_count ?? totalMineBlocks;
  const statistics = results.statistics as Record<string, unknown> | undefined;
  const fallbackCoverageValue = parseNumeric(summary.mining_percentage)
    ?? parseNumeric(statistics?.['coveragePercentage'])
    ?? parseNumeric(statistics?.['coverage_percentage']);
  const fallbackCoverage = fallbackCoverageValue ?? undefined;
  const normalizedFallbackCoverage = typeof fallbackCoverage === 'number'
    ? (fallbackCoverage > 1 ? fallbackCoverage : fallbackCoverage * 100)
    : null;
  const summaryCoverage = tileAreaMetrics.coveragePct ?? normalizedFallbackCoverage ?? 0;

  const summaryMiningAreaM2FromSummary = parseNumeric(summary.mining_area_m2);
  const summaryMiningAreaM2 = tileAreaMetrics.totalMiningAreaM2 > 0
    ? tileAreaMetrics.totalMiningAreaM2
    : (summaryMiningAreaM2FromSummary ?? 0);

  const avgConfidencePct = confidenceMetrics.averagePct;
  const maxConfidencePct = confidenceMetrics.maxPct;
  const minConfidencePct = confidenceMetrics.minPct;
  const confidenceSampleCount = confidenceMetrics.sampleCount;
  const confidenceSource = confidenceMetrics.source;
  const summaryMiningPixels = summary.mining_pixels;
  const summaryTotalPixels = summary.total_pixels;
  const maskShape = summary.mask_shape ?? mosaicTile?.mask_shape;
  const bounds = summary.bounds ?? mosaicTile?.bounds;

  const safeCoveragePct = clampPercent(summaryCoverage ?? 0);
  const safeConfidenceAvgPct = typeof avgConfidencePct === 'number' && avgConfidencePct !== null
    ? clampPercent(avgConfidencePct)
    : null;
  const safeConfidenceMaxPct = typeof maxConfidencePct === 'number' && maxConfidencePct !== null
    ? clampPercent(maxConfidencePct)
    : null;
  const safeConfidenceMinPct = typeof minConfidencePct === 'number' && minConfidencePct !== null
    ? clampPercent(minConfidencePct)
    : null;

  const confidenceBadgeParts: string[] = [];
  if (safeConfidenceAvgPct !== null) {
    confidenceBadgeParts.push(`${formatNumber(safeConfidenceAvgPct, 1)} % avg`);
  } else {
    confidenceBadgeParts.push('--');
  }
  if (safeConfidenceMaxPct !== null && safeConfidenceMaxPct !== safeConfidenceAvgPct) {
    confidenceBadgeParts.push(`Peak ${formatNumber(safeConfidenceMaxPct, 1)} %`);
  }
  if (
    safeConfidenceMinPct !== null
    && safeConfidenceMinPct !== safeConfidenceAvgPct
    && safeConfidenceMinPct !== safeConfidenceMaxPct
  ) {
    confidenceBadgeParts.push(`Min ${formatNumber(safeConfidenceMinPct, 1)} %`);
  }

  const resolutionLabel = Array.isArray(maskShape) && maskShape.length === 2
    ? `${maskShape[1]} x ${maskShape[0]}`
    : 'N/A';

  let spanLabel = 'N/A';
  if (Array.isArray(bounds) && bounds.length >= 2) {
    const lons = bounds.map(point => point[0]);
    const lats = bounds.map(point => point[1]);
    const lonSpan = Math.max(...lons) - Math.min(...lons);
    const latSpan = Math.max(...lats) - Math.min(...lats);
    spanLabel = `${lonSpan.toFixed(4)}deg x ${latSpan.toFixed(4)}deg`;
  }

  const metrics = [
    { label: 'TILES', value: formatNumber(summaryTotalTiles) },
    { label: 'DETECTIONS', value: formatNumber(summaryTilesWithDetections) },
    { label: 'BLOCKS', value: formatNumber(summaryMineBlocks) },
    { label: 'AREA (HA)', value: formatNumber(summaryMiningAreaM2 / 10_000, 2) },
    { label: 'COVERAGE %', value: formatNumber(safeCoveragePct, 2) },
    {
      label: 'CONF AVG %',
      value: safeConfidenceAvgPct !== null ? formatNumber(safeConfidenceAvgPct, 1) : '--',
    },
    {
      label: 'CONF MAX %',
      value: safeConfidenceMaxPct !== null ? formatNumber(safeConfidenceMaxPct, 1) : '--',
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Paper
        sx={{
          p: 2,
          background: 'rgba(12, 18, 28, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
        }}
        elevation={0}
      >
        <GoldenText variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
          SUMMARY
        </GoldenText>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 1.5,
          }}
        >
          {metrics.map(metric => (
            <Box
              key={metric.label}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                borderRadius: 1.5,
                p: 1.5,
              }}
            >
              <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.7rem' }}>
                {metric.label}
              </Typography>
              <Typography sx={{ color: '#e2e8f0', fontSize: '1.2rem', fontFamily: 'monospace' }}>
                {metric.value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Paper
        sx={{
          p: 2,
          background: 'rgba(12, 18, 28, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
        }}
        elevation={0}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Box>
            <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.7rem', mb: 0.5 }}>
              COVERAGE
            </Typography>
            <LinearProgress
              variant="determinate"
              value={safeCoveragePct}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: 'rgba(51, 65, 85, 0.6)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#38bdf8',
                  borderRadius: 3,
                },
              }}
            />
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', mt: 0.5, fontFamily: 'monospace' }}>
              {formatNumber(safeCoveragePct, 2)} %
            </Typography>
          </Box>

          <Box>
            <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.7rem', mb: 0.5 }}>
              CONFIDENCE
            </Typography>
            <LinearProgress
              variant="determinate"
              value={safeConfidenceAvgPct ?? 0}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: 'rgba(51, 65, 85, 0.6)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#22c55e',
                  borderRadius: 3,
                },
              }}
            />
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', mt: 0.5, fontFamily: 'monospace' }}>
              {confidenceBadgeParts.join(' | ')}
            </Typography>
            <Typography sx={{ color: 'rgba(148, 163, 184, 0.7)', fontSize: '0.7rem', mt: 0.25 }}>
              {confidenceSampleCount > 0
                ? `${confidenceSampleCount} block sample${confidenceSampleCount === 1 ? '' : 's'} | ${confidenceSource === 'summary' ? 'summary fallback' : 'model probabilities'}`
                : 'No block samples supplied; using summary statistic.'}
            </Typography>
          </Box>

          {summaryMiningPixels !== undefined && summaryTotalPixels !== undefined && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(148, 163, 184, 0.8)', fontSize: '0.7rem' }}>
              <Typography>PIXELS</Typography>
              <Typography fontFamily="monospace" sx={{ color: '#e2e8f0' }}>
                {formatNumber(summaryMiningPixels)} / {formatNumber(summaryTotalPixels)}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      <Paper
        sx={{
          p: 2,
          background: 'rgba(12, 18, 28, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
        }}
        elevation={0}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1.5 }}>
          <Box>
            <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.7rem', mb: 0.5 }}>
              ANALYSIS ID
            </Typography>
            <Typography sx={{ color: '#e2e8f0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {results.analysis_id ?? 'N/A'}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.7rem', mb: 0.5 }}>
              MASK SIZE
            </Typography>
            <Typography sx={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
              {resolutionLabel}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.7rem', mb: 0.5 }}>
              BOUNDS DELTA
            </Typography>
            <Typography sx={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
              {spanLabel}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ color: 'rgba(148, 163, 184, 0.75)', fontSize: '0.7rem', mb: 0.5 }}>
              CRS
            </Typography>
            <Typography sx={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
              {summary.crs ?? 'EPSG:4326'}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {onOpenQuantitativeAnalysis && (
        <Paper
          onClick={onOpenQuantitativeAnalysis}
          sx={{
            p: 1.5,
            background: 'rgba(148, 163, 184, 0.12)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            cursor: 'pointer',
            textAlign: 'center',
            userSelect: 'none',
          }}
          elevation={0}
        >
          <Typography sx={{ color: '#e2e8f0', fontWeight: 600, letterSpacing: 1 }}>
            QUANTITATIVE ANALYSIS
          </Typography>
          <Typography sx={{ color: 'rgba(226, 232, 240, 0.75)', fontSize: '0.75rem', mt: 0.5 }}>
            Launch DEM-aligned depth and volume metrics
          </Typography>
        </Paper>
      )}
    </Box>
  );
};
