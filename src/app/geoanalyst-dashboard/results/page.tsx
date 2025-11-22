'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Download,
  ArrowBack,
  ZoomIn,
  Fullscreen,
  FullscreenExit,
  DragIndicator,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { TileOverlayManager } from '@/components/geoanalyst/TileOverlayManager';
import { ResultsStatistics } from '@/components/geoanalyst/ResultsStatistics';
import { MineBlockTable } from '@/components/geoanalyst/MineBlockTable';
import { saveAnalysis, getAnalysisById } from '@/services/historyService';
import { useAuth } from '@/contexts/AuthContext';
import {
  deriveTileAreaMetrics,
  deriveConfidenceMetrics,
  normalizeConfidenceValue,
  parseNumeric,
} from '@/lib/analysisMetrics';
import { normalizeAnalysisResults } from '@/lib/normalizeAnalysisResults';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const GoldenText = styled(Typography)({
  background: 'linear-gradient(to right, #3b82f6, #1e40af, #3b82f6)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))'
});

// API Base URL from environment
const DEFAULT_API_URL = 'https://khananapi.jambagrad.com/api';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
const formatPercent = (value: number | null | undefined, fractionDigits = 1) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--';
  }

  return value.toFixed(fractionDigits);
};

const ResultsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisId = searchParams.get('id');
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [splitPosition, setSplitPosition] = useState(60); // 60% left, 40% right
  const [isDragging, setIsDragging] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const saveAttemptedRef = useRef(false); // Track save attempts to prevent duplicates
  const fetchAttemptedRef = useRef(false); // Track fetch attempts to prevent double-fetching
  
  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragFrameRef = useRef<number | null>(null);
  const results = useMemo(() => normalizeAnalysisResults(analysisData), [analysisData]);
  const analysisStatus = analysisData?.status ?? results?.status;

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);

    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }

    if (mapInstanceRef.current) {
      window.requestAnimationFrame(() => {
        mapInstanceRef.current?.invalidateSize();
      });
    }
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    if (dragFrameRef.current !== null) {
      return;
    }

    const { clientX } = event;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) {
        return;
      }

      const newPosition = ((clientX - containerRect.left) / containerRect.width) * 100;
      setSplitPosition(Math.max(40, Math.min(70, newPosition)));
    });
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) {
      return undefined;
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

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

    // Prevent double-fetching in React strict mode
    if (fetchAttemptedRef.current) {
      console.log('⏭️  Skipping duplicate fetch (already attempted)');
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    const fetchResults = async () => {
      try {
        console.log('\n📥 ==================== FETCHING RESULTS ====================');
        console.log(`📋 Analysis ID: ${analysisId}`);
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
        
        // Mark as attempting
        fetchAttemptedRef.current = true;
        
        console.log(`🔍 Fetching analysis results for ID: ${analysisId}`);

        // Only hit the local FastAPI process when running on localhost; remote builds rely on the proxy.
        const canUseLocalPython = typeof window !== 'undefined' && window.location.hostname === 'localhost';
        let response: Response | null = null;

        if (canUseLocalPython) {
          try {
            response = await fetch(`http://localhost:8000/api/v1/analysis/${analysisId}`);
          } catch (localError) {
            console.warn('⚠️  Local Python backend unreachable, skipping direct hit.', localError);
          }
        }

        if (!response || !response.ok) {
          if (response && !response.ok) {
            console.log('⚠️  Python backend unavailable, trying Node.js proxy...');
          }

          response = await fetch(`${API_BASE_URL}/python/analysis/${analysisId}`);
        }
        
        if (!response.ok) {
          console.log('⚠️  Live results not found, trying database...');
          // If live results not available, try fetching from database using service
          try {
            const savedAnalysis = await getAnalysisById(analysisId);
            console.log('✅ Loaded analysis from database');
            console.log('📊 Database data:', savedAnalysis);
            setAnalysisData(savedAnalysis.results);
            setLoading(false);
            setIsSaved(true); // Mark as already saved
            return;
          } catch (dbErr) {
            console.error('❌ Database fetch also failed:', dbErr);
          }
          
          throw new Error(`Failed to fetch results: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Loaded analysis from Python backend (live)');
        console.log('📊 Results data:', data);
        console.log('================================================================\n');
        setAnalysisData(data);
        setLoading(false);
      } catch (err: any) {
        console.error('❌ Error fetching results:', err);
        console.log('================================================================\n');
        setError(err.message);
        setLoading(false);
      }
    };

    fetchResults();
    
    // Cleanup function - reset refs when analysisId changes
    return () => {
      console.log('🧹 Cleanup: Resetting fetch/save refs for new analysis');
      fetchAttemptedRef.current = false;
      saveAttemptedRef.current = false;
    };
  }, [analysisId, isAuthenticated]);

  // Auto-save analysis to database when results are loaded
  useEffect(() => {
    const saveToDatabase = async () => {
      // Prevent double saves (React strict mode, re-renders, etc.)
      if (!results || !analysisId || isSaved || saveAttemptedRef.current) return;

      // Only save completed analyses
      if (analysisStatus && analysisStatus !== 'completed') {
        console.log(`⏭️  Skipping auto-save - analysis status: ${analysisStatus}`);
        return;
      }

      // Mark as attempting to prevent concurrent saves
      saveAttemptedRef.current = true;

      try {
        console.log('\n💾 ==================== AUTO-SAVE TO DATABASE ====================');
        console.log(`📋 Analysis ID: ${analysisId}`);
        console.log(`📊 Data to save:`, {
          status: analysisStatus,
          totalTiles: results.totalTiles,
          tilesWithMining: results.tilesWithMining,
          detectionCount: results.detectionCount,
          hasMergedBlocks: !!results.mergedBlocks,
          tileCount: results.tiles.length,
          hasSummaryAnalysisId: !!results.summary?.analysis_id
        });
        
        const savePayload = {
          analysisId,
          results,
          force: true, // Always use force=true for auto-save to handle any existing records
          metadata: {
            autoSaved: true,
            savedAt: new Date().toISOString(),
            source: 'results-page'
          }
        };
        
        console.log('📤 Sending save request...');
        const response = await saveAnalysis(savePayload);
        
        console.log('✅ Analysis auto-saved successfully');
        console.log(`   └─ Response:`, response.message);
        console.log('================================================================\n');
        setIsSaved(true);
      } catch (err: any) {
        console.log('\n⚠️  ==================== AUTO-SAVE ERROR ====================');
        console.error('❌ Failed to auto-save analysis');
        console.error('   └─ Error:', err.message);
        console.error('   └─ Response:', err.response?.data);
        console.log('================================================================\n');
        
        // Don't reset attempt flag - we already tried and failed
        // If it's a real error, user can manually retry
        saveAttemptedRef.current = true;
      }
    };

    saveToDatabase();
  }, [results, analysisId, isSaved, analysisStatus]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !results) return;

    const mapInstance = L.map(mapRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    });

    // Satellite imagery
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19,
    }).addTo(mapInstance);

    // Reference labels
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19,
      opacity: 0.5,
    }).addTo(mapInstance);

    mapInstanceRef.current = mapInstance;

    // Auto-zoom to tiles
    if (results.tiles && results.tiles.length > 0) {
      const allBounds = results.tiles.flatMap((t: any) => t.bounds || []);
      if (allBounds.length > 0) {
        const lats = allBounds.map((b: number[]) => b[1]);
        const lngs = allBounds.map((b: number[]) => b[0]);
        mapInstance.fitBounds([
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)]
        ], { padding: [50, 50] });
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [results]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      return;
    }

    const map = mapInstanceRef.current;
    map.invalidateSize();
    const timeout = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [fullscreen, splitPosition, !!results]);

  const summary = (results?.summary ?? {}) as Record<string, any>;
  const tileAreaMetrics = useMemo(() => deriveTileAreaMetrics(results?.tiles), [results?.tiles]);
  const confidenceMetrics = useMemo(() => deriveConfidenceMetrics(results), [results]);

  const summaryTotalTiles = results?.totalTiles ?? 0;
  const summaryTilesWithDetections = results?.tilesWithMining ?? 0;
  const summaryMineBlocks = results?.detectionCount ?? 0;

  const fallbackCoverage = summary.mining_percentage ?? results?.statistics?.coveragePercentage ?? results?.statistics?.coverage_percentage;
  const normalizedFallbackCoverage = typeof fallbackCoverage === 'number'
    ? (fallbackCoverage > 1 ? fallbackCoverage : fallbackCoverage * 100)
    : null;
  const summaryCoverage = tileAreaMetrics.coveragePct ?? normalizedFallbackCoverage ?? 0;

  const summaryMiningAreaM2 = tileAreaMetrics.totalMiningAreaM2 > 0
    ? tileAreaMetrics.totalMiningAreaM2
    : results?.totalMiningArea?.m2 ?? parseNumeric(summary.mining_area_m2) ?? 0;

  const summaryMiningAreaHa = summaryMiningAreaM2 / 10_000;
  const summaryConfidencePct = confidenceMetrics.averagePct ?? null;
  const summaryMaxConfidencePct = confidenceMetrics.maxPct ?? null;
  const summaryMinConfidencePct = confidenceMetrics.minPct ?? null;
  const confidenceSampleCount = confidenceMetrics.sampleCount;
  const confidenceSource = confidenceMetrics.source;

  const detectionShare = summaryTotalTiles > 0 ? (summaryTilesWithDetections / summaryTotalTiles) * 100 : 0;

  const safeSummaryCoverage = Number.isFinite(summaryCoverage) ? clampPercent(summaryCoverage) : 0;
  const safeSummaryConfidencePct = summaryConfidencePct !== null
    ? clampPercent(summaryConfidencePct)
    : undefined;
  const safeSummaryMaxConfidencePct = summaryMaxConfidencePct !== null
    ? clampPercent(summaryMaxConfidencePct)
    : undefined;
  const safeSummaryMinConfidencePct = summaryMinConfidencePct !== null
    ? clampPercent(summaryMinConfidencePct)
    : undefined;

  const coverageDisplay = safeSummaryCoverage;
  const miningAreaDisplay = Number.isFinite(summaryMiningAreaHa) ? summaryMiningAreaHa : 0;

  const insightLines = [
    `${summaryMineBlocks} consolidated blocks across ${summaryTilesWithDetections} detection tiles`,
    `${coverageDisplay.toFixed(2)}% of the mosaic flagged with ${miningAreaDisplay.toFixed(2)} ha of activity`,
  ];

  if (safeSummaryConfidencePct !== undefined) {
    const avgLabel = formatPercent(safeSummaryConfidencePct, 1);
    const maxLabel = safeSummaryMaxConfidencePct !== undefined && safeSummaryMaxConfidencePct !== safeSummaryConfidencePct
      ? formatPercent(safeSummaryMaxConfidencePct, 1)
      : null;
    const minLabel = safeSummaryMinConfidencePct !== undefined
      && safeSummaryMinConfidencePct !== safeSummaryConfidencePct
      && safeSummaryMinConfidencePct !== safeSummaryMaxConfidencePct
      ? formatPercent(safeSummaryMinConfidencePct, 1)
      : null;

    const descriptor = confidenceSampleCount > 0
      ? `${confidenceSampleCount} block sample${confidenceSampleCount === 1 ? '' : 's'}`
      : confidenceSource === 'summary'
        ? 'summary fallback'
        : 'model statistics';

    let confidenceLine = `Confidence averages ${avgLabel}%`;
    if (maxLabel) {
      confidenceLine += ` with a peak at ${maxLabel}%`;
    }
    if (minLabel) {
      confidenceLine += ` and a floor of ${minLabel}%`;
    }
    confidenceLine += ` across ${descriptor}.`;

    insightLines.push(confidenceLine);
  }

  insightLines.push('Confidence represents the detection model probability per mined block, normalized to a 0–100% range.');
  insightLines.push(`Detections concentrated in ${detectionShare.toFixed(1)}% of processed tiles (${summaryTotalTiles})`);

  const mineBlockRows = useMemo(() => {
    const mergedFeatures = Array.isArray(results?.mergedBlocks?.features)
      ? results.mergedBlocks.features
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
      };
    });

    const tileRows = Array.isArray(results?.tiles)
      ? results!.tiles.flatMap((tile: any, tileIdx: number) => {
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
            };
          });
        })
      : [];

    const combined = [...mergedRows, ...tileRows];
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
  }, [results]);

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
        <CircularProgress sx={{ color: '#3b82f6' }} size={60} />
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

  const handleOpenQuantitativeAnalysis = () => {
    if (!analysisId) {
      return;
    }
    router.push(`/geoanalyst-dashboard/results/quantitative?id=${analysisId}`);
  };
  const handleZoomToDetections = () => {
    if (!mapInstanceRef.current || !results?.tiles) return;
    
    const tilesWithDetections = results.tiles.filter((t: any) => t.miningDetected || t.mining_detected);
    if (tilesWithDetections.length === 0) return;

    const allBounds = tilesWithDetections.flatMap((t: any) => t.bounds || []);
    if (allBounds.length > 0) {
      const lats = allBounds.map((b: number[]) => b[1]);
      const lngs = allBounds.map((b: number[]) => b[0]);
      mapInstanceRef.current.fitBounds([
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ], { padding: [80, 80] });
    }
  };

  const handleDownloadReport = () => {
    // TODO: Implement GeoJSON export
    const geojson = {
      type: 'FeatureCollection',
      features: results?.tiles?.flatMap((t: any) => t.mine_blocks || []) || []
    };
    
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mining-analysis-${analysisId}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box ref={containerRef} sx={{ display: 'flex', height: '100vh', background: 'linear-gradient(to right, #1a1a2e, #16213e, #0f3460)' }}>
      {/* Left Panel - Statistics and Controls (draggable width) */}
      <Box sx={{ 
        width: fullscreen ? 0 : `${splitPosition}%`,
        minWidth: fullscreen ? 0 : '400px',
        overflowY: 'auto', 
        p: fullscreen ? 0 : 3, 
        transition: fullscreen ? 'all 0.3s' : 'none',
        background: 'linear-gradient(to bottom, rgba(26, 26, 46, 0.95), rgba(22, 33, 62, 0.95))',
        borderRight: fullscreen ? 'none' : '1px solid rgba(251, 191, 36, 0.2)'
      }}>
        {!fullscreen && (
          <Box>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
              <Button
                startIcon={<ArrowBack />}
                onClick={() => router.push('/geoanalyst-dashboard')}
                sx={{ mb: 2, color: '#3b82f6', textTransform: 'none' }}
              >
                Back to Dashboard
              </Button>
              
              <GoldenText variant="h5" fontWeight="bold" gutterBottom>
                Analysis Results
              </GoldenText>
              <Typography sx={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                Analysis ID: {analysisId}
              </Typography>
            </Box>

            {/* Statistics Component */}
            <ResultsStatistics 
              results={{ ...results, analysis_id: analysisId ?? undefined }}
              onOpenQuantitativeAnalysis={handleOpenQuantitativeAnalysis}
            />

            <Paper
              sx={{
                mt: 3,
                p: 2,
                background: 'rgba(26, 26, 46, 0.6)',
                border: '1px solid rgba(251, 191, 36, 0.15)',
              }}
              elevation={0}
            >
              <GoldenText variant="subtitle2" fontWeight="bold">
                Operational Insights
              </GoldenText>
              <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {insightLines.map((line, index) => (
                  <Typography key={index} sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.8rem' }}>
                    {line}
                  </Typography>
                ))}
              </Box>
            </Paper>

            <MineBlockTable rows={mineBlockRows} />
            {/* Action Buttons */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 3 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<ZoomIn />}
                onClick={handleZoomToDetections}
                sx={{
                  bgcolor: '#ef4444',
                  '&:hover': { bgcolor: '#dc2626' },
                  textTransform: 'none',
                  fontWeight: 'bold'
                }}
              >
                Zoom to All Detections
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownloadReport}
                sx={{
                  color: '#3b82f6',
                  borderColor: 'rgba(252, 211, 77, 0.5)',
                  '&:hover': {
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)'
                  },
                  textTransform: 'none',
                  fontWeight: 'bold'
                }}
              >
                Download GeoJSON Report
              </Button>
            </Box>

            <Paper
              sx={{
                mt: 3,
                p: 2,
                background: 'rgba(26, 26, 46, 0.6)',
                border: '1px solid rgba(251, 191, 36, 0.15)',
              }}
              elevation={0}
            >
              <GoldenText variant="subtitle2" fontWeight="bold">
                Compliance Overlay (Next Phase)
              </GoldenText>
              <Typography sx={{ color: 'rgba(252, 211, 77, 0.6)', fontSize: '0.75rem', mt: 1 }}>
                Upload authorised mining lease polygons to validate each detected block and flag variances automatically.
              </Typography>
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                  - Dedicated lane for <strong>Government Permit</strong> GeoJSON / SHP imports
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                  - Side-by-side comparison dashboard with legality badges per block
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                  - Exportable compliance summary for audit submissions
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}
      </Box>

      {/* Draggable Divider */}
      {!fullscreen && (
        <Box
          onMouseDown={handleMouseDown}
          sx={{
            width: '4px',
            cursor: 'col-resize',
            backgroundColor: isDragging ? 'rgba(251, 191, 36, 0.6)' : 'rgba(251, 191, 36, 0.3)',
            '&:hover': {
              backgroundColor: 'rgba(251, 191, 36, 0.6)',
            },
            transition: 'background-color 0.2s',
            position: 'relative',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <DragIndicator 
            sx={{ 
              color: 'rgba(251, 191, 36, 0.8)',
              fontSize: 16,
              transform: 'rotate(90deg)'
            }} 
          />
        </Box>
      )}

      {/* Right Panel - Map View */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {/* Map Container */}
        <Box ref={mapRef} sx={{ width: '100%', height: '100%' }} />
        
        {/* Tile Overlay Manager */}
        {mapInstanceRef.current && results?.tiles && (
          <TileOverlayManager
            key={analysisId ?? 'analysis-view'}
            map={mapInstanceRef.current}
            tiles={results.tiles}
            showSatelliteTiles={true}
            showProbabilityMaps={true}
            showMineBlocks={true}
            satelliteOpacity={0.8}
            heatmapOpacity={0.6}
          />
        )}

        {/* Fullscreen Toggle */}
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1000,
            p: 1,
            background: 'rgba(26, 26, 46, 0.95)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
          }}
        >
          <Tooltip title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}>
            <IconButton
              onClick={() => setFullscreen(!fullscreen)}
              sx={{ color: '#3b82f6' }}
            >
              {fullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Map Legend */}
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            zIndex: 1000,
            p: 2,
            background: 'rgba(26, 26, 46, 0.95)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            backdropFilter: 'blur(10px)',
            minWidth: 200
          }}
        >
          <Typography sx={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '0.875rem', mb: 1 }}>
            Map Legend
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: '#3b82f6', border: '1px solid #60a5fa' }} />
              <Typography sx={{ color: '#fff', fontSize: '0.75rem' }}>Satellite Tiles</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: '#a855f7', border: '1px solid #c084fc' }} />
              <Typography sx={{ color: '#fff', fontSize: '0.75rem' }}>Probability Heatmap</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: '#ef4444', border: '1px solid #fca5a5' }} />
              <Typography sx={{ color: '#fff', fontSize: '0.75rem' }}>Mine Blocks</Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default ResultsPage;

