'use client';
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  TrendingUp,
  LocationOn,
  Layers,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const GoldenText = styled(Typography)({
  background: 'linear-gradient(to right, #fbbf24, #fcd34d, #fbbf24)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 2px 4px rgba(251, 191, 36, 0.3))'
});

const RedText = styled(Typography)({
  background: 'linear-gradient(to right, #fca5a5, #fecaca, #fca5a5)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 2px 4px rgba(252, 165, 165, 0.3))'
});

interface AnalysisResults {
  analysis_id: string;
  status: string;
  progress: number;
  aoi_bounds: [number, number, number, number];
  tiles: Array<{
    tile_id?: string | number;
    id?: string | number;
    bounds: number[][];
    mining_detected: boolean;
    mining_percentage: number;
    confidence: number;
    num_mine_blocks: number;
    total_area_m2: number;
    cloud_coverage?: number;
  }>;
  total_mining_pixels?: number;
  overall_mining_percentage?: number;
  total_mine_blocks?: number;
  total_mining_area_m2?: number;
}

interface ResultsStatisticsProps {
  results: AnalysisResults;
  onZoomToDetections?: () => void;
}

export const ResultsStatistics: React.FC<ResultsStatisticsProps> = ({ results, onZoomToDetections }) => {
  // Calculate aggregate statistics
  const totalTiles = results.tiles?.length || 0;
  const tilesWithDetections = results.tiles?.filter(t => t.mining_detected).length || 0;
  const avgMiningPercentage = totalTiles > 0 
    ? (results.tiles?.reduce((sum, t) => sum + (t.mining_percentage || 0), 0) || 0) / totalTiles
    : 0;
  const avgConfidence = totalTiles > 0
    ? (results.tiles?.reduce((sum, t) => sum + (t.confidence || 0), 0) || 0) / totalTiles
    : 0;
  
  // Calculate areas properly for 10m/pixel resolution
  // Each pixel = 100 m² (10m × 10m)
  const PIXEL_SIZE_M2 = 100; // 10m × 10m per pixel
  
  // Calculate total area by summing each tile's actual area
  const totalAreaM2 = results.tiles?.reduce((sum, t) => {
    return sum + (t.total_area_m2 || 0);
  }, 0) || 0;
  
  // Calculate mining area by summing actual mining area from each tile
  // Mining area = tile_area * (mining_percentage / 100)
  const totalMiningAreaM2 = results.tiles?.reduce((sum, t) => {
    const tileArea = t.total_area_m2 || 0;
    const miningPercent = t.mining_percentage || 0;
    return sum + (tileArea * miningPercent / 100);
  }, 0) || 0;
  
  // Calculate actual mining coverage percentage based on total areas
  const actualMiningCoverage = totalAreaM2 > 0 
    ? (totalMiningAreaM2 / totalAreaM2) * 100 
    : 0;
  
  const totalMineBlocks = results.tiles?.reduce((sum, t) => sum + (t.num_mine_blocks || 0), 0) || 0;

  // Determine detection status
  const miningDetected = tilesWithDetections > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Primary Detection Status */}
      <Card 
        sx={{ 
          background: miningDetected 
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))'
            : 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.1))',
          border: `2px solid ${miningDetected ? '#dc2626' : '#10b981'}`,
          borderRadius: 2,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Box>
              {miningDetected ? (
                <Warning sx={{ fontSize: 56, color: '#ef4444' }} />
              ) : (
                <CheckCircle sx={{ fontSize: 56, color: '#22c55e' }} />
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <GoldenText variant="h5" fontWeight="bold" gutterBottom>
                {miningDetected ? 'Mining Activity Detected' : 'No Mining Activity Detected'}
              </GoldenText>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 1 }}>
                {miningDetected 
                  ? `${tilesWithDetections} of ${totalTiles} tiles show mining signatures with ${avgConfidence.toFixed(1)}% average confidence`
                  : `All ${totalTiles} tiles analyzed show no mining activity`
                }
              </Typography>
              
              {miningDetected && (
                <Box>
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ color: '#fcd34d', fontSize: '0.875rem', fontWeight: 'bold' }}>
                        Mining Coverage
                      </Typography>
                      <Typography sx={{ color: '#fca5a5', fontSize: '0.875rem', fontWeight: 'bold' }}>
                        {actualMiningCoverage.toFixed(2)}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={Math.min(actualMiningCoverage, 100)}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#ef4444',
                          borderRadius: 3,
                        }
                      }}
                    />
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
        {/* Total Area */}
        <Box>
          <Card sx={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <LocationOn sx={{ fontSize: 20, color: '#fcd34d' }} />
                <Typography sx={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.85rem' }}>
                  Total Area
                </Typography>
              </Box>
              <GoldenText variant="h6" fontWeight="bold">
                {(totalAreaM2 / 10_000).toFixed(1)} ha
              </GoldenText>
              <Typography sx={{ color: 'rgba(252, 211, 77, 0.5)', fontSize: '0.75rem' }}>
                ({(totalAreaM2 / 1_000_000).toFixed(2)} km²)
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Tiles Analyzed */}
        <Box>
          <Card sx={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Layers sx={{ fontSize: 20, color: '#fcd34d' }} />
                <Typography sx={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.85rem' }}>
                  Tiles Analyzed
                </Typography>
              </Box>
              <GoldenText variant="h6" fontWeight="bold">
                {totalTiles}
              </GoldenText>
            </CardContent>
          </Card>
        </Box>

        {miningDetected && (
          <>
            {/* Mining Blocks */}
            <Box>
              <Card sx={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography sx={{ color: 'rgba(252, 165, 165, 0.7)', fontSize: '0.85rem', mb: 1 }}>
                    Mine Blocks
                  </Typography>
                  <RedText variant="h6" fontWeight="bold">
                    {totalMineBlocks}
                  </RedText>
                </CardContent>
              </Card>
            </Box>

            {/* Mining Area */}
            <Box>
              <Card sx={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography sx={{ color: 'rgba(252, 165, 165, 0.7)', fontSize: '0.85rem', mb: 1 }}>
                    Mining Area
                  </Typography>
                  <RedText variant="h6" fontWeight="bold">
                    {(totalMiningAreaM2 / 10_000).toFixed(1)} ha
                  </RedText>
                  <Typography sx={{ color: 'rgba(252, 165, 165, 0.5)', fontSize: '0.75rem' }}>
                    ({(totalMiningAreaM2 / 1_000_000).toFixed(3)} km²)
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </>
        )}
      </Box>

      {/* Tile Details Table */}
      {totalTiles > 0 && (
        <Paper sx={{ background: 'rgba(26, 26, 46, 0.6)', border: '1px solid rgba(251, 191, 36, 0.1)' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(251, 191, 36, 0.1)' }}>
            <GoldenText variant="subtitle2" fontWeight="bold">
              Tile Analysis Details
            </GoldenText>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ borderBottom: '1px solid rgba(251, 191, 36, 0.1)' }}>
                  <TableCell sx={{ color: '#fcd34d', fontWeight: 'bold' }}>Tile</TableCell>
                  <TableCell align="center" sx={{ color: '#fcd34d', fontWeight: 'bold' }}>Mining</TableCell>
                  <TableCell align="right" sx={{ color: '#fcd34d', fontWeight: 'bold' }}>Coverage</TableCell>
                  <TableCell align="right" sx={{ color: '#fcd34d', fontWeight: 'bold' }}>Blocks</TableCell>
                  <TableCell align="right" sx={{ color: '#fcd34d', fontWeight: 'bold' }}>Total Area</TableCell>
                  <TableCell align="right" sx={{ color: '#fcd34d', fontWeight: 'bold' }}>Mining Area</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.tiles?.map((tile, idx) => {
                  // Calculate tile area - prefer tile.total_area_m2 from backend, fallback to bounds calculation
                  let tileAreaM2 = tile.total_area_m2 || 0;
                  
                  // If not provided by backend, calculate from bounds
                  if (!tileAreaM2 && tile.bounds && Array.isArray(tile.bounds) && tile.bounds.length >= 4) {
                    // bounds format: [[lat1,lon1], [lat2,lon2], [lat3,lon3], [lat4,lon4]]
                    const lats = tile.bounds.map((coord: number[]) => coord[0]);
                    const lons = tile.bounds.map((coord: number[]) => coord[1]);
                    const latRange = Math.max(...lats) - Math.min(...lats);
                    const lonRange = Math.max(...lons) - Math.min(...lons);
                    
                    // Convert degrees to meters (rough approximation)
                    // 1 degree lat ≈ 111,000m, 1 degree lon ≈ 111,000m * cos(lat)
                    const avgLat = (Math.max(...lats) + Math.min(...lats)) / 2;
                    const latMeters = latRange * 111000;
                    const lonMeters = lonRange * 111000 * Math.cos(avgLat * Math.PI / 180);
                    tileAreaM2 = latMeters * lonMeters;
                  }
                  
                  const miningPercent = tile.mining_percentage || 0;
                  
                  // Calculate mining area as percentage of tile area
                  const tileMiningAreaM2 = (tileAreaM2 * miningPercent) / 100;
                  
                  return (
                    <TableRow 
                      key={idx}
                      sx={{ 
                        borderBottom: '1px solid rgba(251, 191, 36, 0.05)',
                        backgroundColor: tile.mining_detected ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                      }}
                    >
                      <TableCell sx={{ color: '#fff' }}>
                        #{idx + 1}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={tile.mining_detected ? 'Yes' : 'No'}
                          color={tile.mining_detected ? 'error' : 'success'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ color: tile.mining_detected ? '#fca5a5' : '#86efac' }}>
                        {tile.mining_percentage?.toFixed(2) || '0.00'}%
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#fff' }}>
                        {tile.num_mine_blocks || 0}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#fff' }}>
                        <Box>
                          <Typography sx={{ fontSize: '0.875rem' }}>
                            {(tileAreaM2 / 10_000).toFixed(2)} ha
                          </Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            ({(tileAreaM2 / 1_000_000).toFixed(4)} km²)
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ color: tile.mining_detected ? '#fca5a5' : 'rgba(255, 255, 255, 0.5)' }}>
                        <Box>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: tile.mining_detected ? 'bold' : 'normal' }}>
                            {(tileMiningAreaM2 / 10_000).toFixed(2)} ha
                          </Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            ({(tileMiningAreaM2 / 1_000_000).toFixed(4)} km²)
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Analysis Metadata */}
      <Paper sx={{ background: 'rgba(26, 26, 46, 0.6)', border: '1px solid rgba(251, 191, 36, 0.1)', p: 2 }}>
        <GoldenText variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
          Analysis Information
        </GoldenText>
        <Divider sx={{ borderColor: 'rgba(251, 191, 36, 0.1)', mb: 1.5 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
          <Box>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', mb: 0.5 }}>
              Analysis ID
            </Typography>
            <Typography sx={{ color: '#fcd34d', fontSize: '0.875rem', fontFamily: 'monospace' }}>
              {results.analysis_id?.slice(0, 8)}...
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', mb: 0.5 }}>
              Status
            </Typography>
            <Chip
              label={results.status?.toUpperCase() || 'COMPLETED'}
              color={results.status === 'completed' ? 'success' : 'default'}
              variant="outlined"
              size="small"
            />
          </Box>
          <Box>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', mb: 0.5 }}>
              Tiles with Detections
            </Typography>
            <Typography sx={{ color: '#fcd34d', fontWeight: 'bold' }}>
              {tilesWithDetections} / {totalTiles}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', mb: 0.5 }}>
              Avg Confidence
            </Typography>
            <Typography sx={{ color: '#fcd34d', fontWeight: 'bold' }}>
              {(avgConfidence * 100).toFixed(1)}%
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
