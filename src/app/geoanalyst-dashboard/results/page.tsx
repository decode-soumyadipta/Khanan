'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle,
  Warning,
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
import { saveAnalysis, getAnalysisById } from '@/services/historyService';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const GoldenText = styled(Typography)({
  background: 'linear-gradient(to right, #fbbf24, #fcd34d, #fbbf24)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 2px 4px rgba(251, 191, 36, 0.3))'
});

// API Base URL from environment
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface MineBlock {
  blockId: string;
  tileIndex: number;
  area: number;
  confidence: number;
  centroid?: [number, number];
  geometry?: any;
}

const ResultsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [splitPosition, setSplitPosition] = useState(60); // 60% left, 40% right
  const [isDragging, setIsDragging] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const saveAttemptedRef = useRef(false); // Track save attempts to prevent duplicates
  const fetchAttemptedRef = useRef(false); // Track fetch attempts to prevent double-fetching
  
  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedMarkerRef = useRef<L.Marker | null>(null);

  // Extract mine blocks from results
  const mineBlocks: MineBlock[] = React.useMemo(() => {
    if (!results?.tiles) return [];
    
    const blocks: MineBlock[] = [];
    results.tiles.forEach((tile: any, tileIdx: number) => {
      if (tile.mineBlocks || tile.mine_blocks) {
        const tileBlocks = tile.mineBlocks || tile.mine_blocks;
        tileBlocks.forEach((block: any, blockIdx: number) => {
          blocks.push({
            blockId: `T${tile.tileIndex || tileIdx}B${blockIdx + 1}`,
            tileIndex: tile.tileIndex || tileIdx,
            area: block.area || 0,
            confidence: block.confidence || 0,
            centroid: block.centroid,
            geometry: block.geometry,
          });
        });
      }
    });
    return blocks;
  }, [results]);

  // Handle dragging for split view
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Clamp between 40% and 70%
    setSplitPosition(Math.max(40, Math.min(70, newPosition)));
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle block selection
  const handleBlockClick = useCallback((blockId: string) => {
    setSelectedBlockId(blockId === selectedBlockId ? null : blockId);
    
    // Zoom to block on map
    const block = mineBlocks.find(b => b.blockId === blockId);
    if (block && block.centroid && mapInstanceRef.current) {
      mapInstanceRef.current.setView([block.centroid[1], block.centroid[0]], 15, { animate: true });
      
      // Add temporary marker
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.remove();
      }
      
      const marker = L.marker([block.centroid[1], block.centroid[0]], {
        icon: L.divIcon({
          className: 'selected-block-marker',
          html: `<div style="background: #fbbf24; border: 3px solid #fff; width: 20px; height: 20px; border-radius: 50%; box-shadow: 0 0 10px rgba(251,191,36,0.8);"></div>`,
        })
      }).addTo(mapInstanceRef.current);
      
      selectedMarkerRef.current = marker;
    }
  }, [selectedBlockId, mineBlocks]);

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

    const fetchResults = async () => {
      try {
        console.log('\n📥 ==================== FETCHING RESULTS ====================');
        console.log(`📋 Analysis ID: ${analysisId}`);
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
        
        // Mark as attempting
        fetchAttemptedRef.current = true;
        
        console.log(`🔍 Fetching analysis results for ID: ${analysisId}`);
        
        // Try Python backend first (in-memory, real-time results)
        let response = await fetch(`http://localhost:8000/api/v1/analysis/${analysisId}`);
        
        if (!response.ok) {
          console.log('⚠️  Python backend unavailable, trying Node.js proxy...');
          // Fallback to Node.js backend
          response = await fetch(`${API_BASE_URL}/python/analysis/${analysisId}`);
        }
        
        if (!response.ok) {
          console.log('⚠️  Live results not found, trying database...');
          // If live results not available, try fetching from database using service
          try {
            const savedAnalysis = await getAnalysisById(analysisId);
            console.log('✅ Loaded analysis from database');
            console.log('📊 Database data:', savedAnalysis);
            setResults(savedAnalysis.results);
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
        setResults(data);
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
  }, [analysisId]);

  // Auto-save analysis to database when results are loaded
  useEffect(() => {
    const saveToDatabase = async () => {
      // Prevent double saves (React strict mode, re-renders, etc.)
      if (!results || !analysisId || isSaved || saveAttemptedRef.current) return;

      // Only save completed analyses
      if (results.status && results.status !== 'completed') {
        console.log(`⏭️  Skipping auto-save - analysis status: ${results.status}`);
        return;
      }

      // Mark as attempting to prevent concurrent saves
      saveAttemptedRef.current = true;

      try {
        console.log('\n💾 ==================== AUTO-SAVE TO DATABASE ====================');
        console.log(`📋 Analysis ID: ${analysisId}`);
        console.log(`📊 Data to save:`, {
          status: results.status,
          totalTiles: results.total_tiles || results.tiles?.length,
          tilesWithMining: results.tiles?.filter((t: any) => t.mining_detected || t.miningDetected)?.length,
          totalMineBlocks: results.total_mine_blocks || results.merged_block_count,
          mergedBlockCount: results.merged_block_count,
          hasMergedBlocks: !!results.merged_blocks,
          tileCount: results.tiles?.length,
          hasAnalysisId: !!results.analysis_id
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
  }, [results, analysisId, isSaved]);

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

  const miningDetected = results?.mining_detected || results?.total_mining_pixels > 0 || 
                         (results?.tiles && results.tiles.some((t: any) => t.miningDetected || t.mining_detected));
  const detectionPercentage = results?.overall_mining_percentage || 0;
  const totalTilesWithDetections = results?.tiles?.filter((t: any) => t.miningDetected || t.mining_detected).length || 0;

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
                sx={{ mb: 2, color: '#fcd34d', textTransform: 'none' }}
              >
                Back to Dashboard
              </Button>
              
              <GoldenText variant="h5" fontWeight="bold" gutterBottom>
                Analysis Results
              </GoldenText>
              <Typography sx={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.875rem' }}>
                Analysis ID: {analysisId?.slice(0, 8)}...
              </Typography>
            </Box>

            {/* Statistics Component */}
            <ResultsStatistics 
              results={{...results, analysis_id: analysisId}}
              onZoomToDetections={handleZoomToDetections}
            />

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
                  color: '#fcd34d',
                  borderColor: 'rgba(252, 211, 77, 0.5)',
                  '&:hover': {
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)'
                  },
                  textTransform: 'none',
                  fontWeight: 'bold'
                }}
              >
                Download GeoJSON Report
              </Button>
            </Box>
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
              sx={{ color: '#fcd34d' }}
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
          <Typography sx={{ color: '#fcd34d', fontWeight: 'bold', fontSize: '0.875rem', mb: 1 }}>
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

