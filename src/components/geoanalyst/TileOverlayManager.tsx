'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Box, Slider, Typography, Stack, Switch, FormControlLabel, Paper, Chip } from '@mui/material';
import { TileData } from '@/types/geoanalyst';

interface TileOverlayManagerProps {
  map: L.Map | null;
  tiles: TileData[];
  showSatelliteTiles?: boolean;
  showProbabilityMaps?: boolean;
  showMineBlocks?: boolean;
  satelliteOpacity?: number;
  heatmapOpacity?: number;
  onOpacityChange?: (layer: 'satellite' | 'heatmap', opacity: number) => void;
}

export const TileOverlayManager: React.FC<TileOverlayManagerProps> = ({
  map,
  tiles,
  showSatelliteTiles = true,
  showProbabilityMaps = true,
  showMineBlocks = true,
  satelliteOpacity = 0.8,
  heatmapOpacity = 0.6,
  onOpacityChange
}) => {
  const satelliteTileLayersRef = useRef<Map<string, L.ImageOverlay>>(new Map());
  const heatmapLayersRef = useRef<Map<string, L.ImageOverlay>>(new Map());
  const polygonLayersRef = useRef<Map<string, L.FeatureGroup>>(new Map());
  const [localSatelliteOpacity, setLocalSatelliteOpacity] = useState(satelliteOpacity);
  const [localHeatmapOpacity, setLocalHeatmapOpacity] = useState(heatmapOpacity);
  const [showSatellite, setShowSatellite] = useState(showSatelliteTiles);
  const [showHeatmap, setShowHeatmap] = useState(showProbabilityMaps);
  const [showPolygons, setShowPolygons] = useState(showMineBlocks);
  const [stats, setStats] = useState({ total: 0, withImages: 0, withHeatmaps: 0, withDetections: 0 });

  // Sync local opacity state with props
  useEffect(() => {
    setLocalSatelliteOpacity(satelliteOpacity);
  }, [satelliteOpacity]);

  useEffect(() => {
    setLocalHeatmapOpacity(heatmapOpacity);
  }, [heatmapOpacity]);

  // Calculate bounds from tile bounds array
  const calculateBounds = (bounds: number[][]): [[number, number], [number, number]] => {
    // bounds is [[lon, lat], [lon, lat], ...] array of corner coordinates
    const lats = bounds.map(b => b[1]);
    const lngs = bounds.map(b => b[0]);
    
    const south = Math.min(...lats);
    const north = Math.max(...lats);
    const west = Math.min(...lngs);
    const east = Math.max(...lngs);
    
    // Return in Leaflet format: [[south, west], [north, east]]
    return [[south, west], [north, east]];
  };

  // Update stats whenever tiles change
  useEffect(() => {
    const total = tiles.length;
    const withImages = tiles.filter(t => t.image_base64).length;
    const withHeatmaps = tiles.filter(t => t.probability_map_base64).length;
    const withDetections = tiles.filter(t => t.mining_detected || t.miningDetected).length;
    setStats({ total, withImages, withHeatmaps, withDetections });
  }, [tiles]);

  // Add/update satellite tile overlays
  useEffect(() => {
    if (!map || !showSatellite) {
      // Remove all satellite tiles if hidden
      satelliteTileLayersRef.current.forEach(layer => map?.removeLayer(layer));
      return;
    }

    tiles.forEach((tile) => {
      if (!tile.image_base64 || !tile.bounds || tile.bounds.length < 4) return;

      // Ensure map exists and is a valid Leaflet map
      if (!map || typeof map.addLayer !== 'function') {
        console.error(`❌ Map is invalid for satellite tile ${tile.index}:`, map);
        return;
      }

      const tileId = String(tile.id || tile.tile_id || `tile-${tile.index}`);
      const existingLayer = satelliteTileLayersRef.current.get(tileId);

      // Calculate proper bounds for Leaflet ImageOverlay
      const bounds = calculateBounds(tile.bounds);
      const imageUrl = `data:image/png;base64,${tile.image_base64}`;

      if (existingLayer) {
        // Update existing layer
        try {
          existingLayer.setUrl(imageUrl);
          const leafletBounds = L.latLngBounds(bounds);
          
          if (leafletBounds && leafletBounds.isValid()) {
            existingLayer.setBounds(leafletBounds);
            existingLayer.setOpacity(localSatelliteOpacity);
            if (!map.hasLayer(existingLayer)) {
              map.addLayer(existingLayer);
            }
          }
        } catch (error) {
          console.error(`❌ Error updating satellite tile ${tile.index}:`, error);
        }
      } else {
        // Create new layer
        try {
          const leafletBounds = L.latLngBounds(bounds);
          
          if (!leafletBounds || !leafletBounds.isValid()) {
            console.warn(`⚠️ Invalid bounds for satellite tile ${tile.index}:`, bounds);
            return;
          }

          const imageOverlay = L.imageOverlay(imageUrl, leafletBounds, {
            opacity: localSatelliteOpacity,
            interactive: false,
            crossOrigin: 'anonymous',
          });

          if (!imageOverlay) {
            console.error(`❌ Failed to create satellite tile overlay for tile ${tile.index}`);
            return;
          }

          // Add tooltip with tile info
          try {
            imageOverlay.bindTooltip(
              `Tile ${tile.index}<br/>` +
              `Bands: ${tile.bands?.join(', ') || tile.bands_used?.join(', ') || 'RGB'}<br/>` +
              `Cloud: ${tile.cloudCoverage || tile.cloud_coverage || 0}%<br/>` +
              `Time: ${tile.timestamp}`,
              { permanent: false, direction: 'top' }
            );
          } catch (tooltipError) {
            console.warn(`⚠️ Failed to bind tooltip for satellite tile ${tile.index}:`, tooltipError);
          }

          // Safely add to map
          try {
            if (map && map.getContainer() && typeof map.addLayer === 'function') {
              map.addLayer(imageOverlay);
              satelliteTileLayersRef.current.set(tileId, imageOverlay);
            } else {
              console.warn(`⚠️ Map not ready for satellite tile ${tile.index}`);
            }
          } catch (addError) {
            console.error(`❌ Failed to add satellite tile to map for tile ${tile.index}:`, addError);
          }
        } catch (error) {
          console.error(`❌ Error creating satellite tile overlay for tile ${tile.index}:`, error);
        }
      }
    });

    // Clean up removed tiles
    const currentTileIds = new Set(tiles.map(t => String(t.id || t.tile_id || `tile-${t.index}`)));
    satelliteTileLayersRef.current.forEach((layer, id) => {
      if (!currentTileIds.has(id)) {
        try {
          if (map && map.hasLayer(layer)) {
            map.removeLayer(layer);
          }
        } catch (error) {
          console.warn(`⚠️ Error removing satellite tile layer ${id}:`, error);
        }
        satelliteTileLayersRef.current.delete(id);
      }
    });
  }, [map, tiles, showSatellite, localSatelliteOpacity]);

  // Add/update probability map (heatmap) overlays
  useEffect(() => {
    if (!map || !showHeatmap) {
      // Remove all heatmaps if hidden
      heatmapLayersRef.current.forEach(layer => map?.removeLayer(layer));
      return;
    }

    tiles.forEach((tile) => {
      if (!tile.probability_map_base64 || !tile.bounds || tile.bounds.length < 4) return;

      const tileId = String(tile.id || tile.tile_id || `tile-${tile.index}`);
      const existingLayer = heatmapLayersRef.current.get(tileId);

      // Calculate proper bounds for Leaflet ImageOverlay
      const bounds = calculateBounds(tile.bounds);
      const heatmapUrl = `data:image/png;base64,${tile.probability_map_base64}`;

      if (existingLayer) {
        // Update existing layer
        try {
          existingLayer.setUrl(heatmapUrl);
          const leafletBounds = L.latLngBounds(bounds);
          
          if (!leafletBounds || !leafletBounds.isValid()) {
            console.warn(`⚠️ Invalid bounds for tile ${tile.index}:`, bounds);
            return;
          }
          
          existingLayer.setBounds(leafletBounds);
          existingLayer.setOpacity(localHeatmapOpacity);
          
          // Ensure map exists and is a valid Leaflet map
          if (map && map.getContainer() && typeof map.addLayer === 'function' && !map.hasLayer(existingLayer)) {
            map.addLayer(existingLayer);
          }
        } catch (error) {
          console.error(`❌ Error updating heatmap for tile ${tileId}:`, error);
        }
      } else {
        // Create new heatmap overlay
        try {
          const leafletBounds = L.latLngBounds(bounds);
          
          // Validate bounds before creating overlay
          if (!leafletBounds || !leafletBounds.isValid()) {
            console.warn(`⚠️ Invalid bounds for tile ${tile.index}:`, bounds);
            return;
          }
          
          const heatmapOverlay = L.imageOverlay(heatmapUrl, leafletBounds, {
            opacity: localHeatmapOpacity,
            interactive: false,
            crossOrigin: 'anonymous',
          });

          // Validate that overlay was created and has addTo method
          if (!heatmapOverlay) {
            console.error(`❌ Failed to create heatmap overlay for tile ${tile.index}`);
            return;
          }

          // Ensure map exists and is a valid Leaflet map
          if (!map || typeof map.addLayer !== 'function') {
            console.error(`❌ Map is invalid for tile ${tile.index}:`, map);
            return;
          }

          // Add tooltip with prediction info
          const miningDetected = tile.miningDetected || tile.mining_detected || false;
          const miningPercentage = tile.miningPercentage || tile.mining_percentage || 0;
          const miningInfo = miningDetected 
            ? `⚠️ MINING DETECTED<br/>Coverage: ${miningPercentage.toFixed(1)}%<br/>Confidence: ${(tile.confidence * 100).toFixed(1)}%<br/>Blocks: ${tile.num_mine_blocks || 0}`
            : `✓ No mining detected`;
          
          try {
            heatmapOverlay.bindTooltip(
              `Tile ${tile.index}<br/>${miningInfo}`,
              { permanent: false, direction: 'top' }
            );
          } catch (tooltipError) {
            console.warn(`⚠️ Failed to bind tooltip for tile ${tile.index}:`, tooltipError);
          }

          // Safely add to map using addLayer instead of addTo
          try {
            if (map && map.getContainer() && typeof map.addLayer === 'function') {
              map.addLayer(heatmapOverlay);
              heatmapLayersRef.current.set(tileId, heatmapOverlay);
            } else {
              console.warn(`⚠️ Map not ready for heatmap overlay ${tile.index}`);
            }
          } catch (addError) {
            console.error(`❌ Failed to add heatmap to map for tile ${tile.index}:`, addError);
          }
        } catch (error) {
          console.error(`❌ Error creating heatmap for tile ${tile.index}:`, error);
        }
      }
    });

    // Clean up removed tiles
    const currentTileIds = new Set(tiles.map(t => String(t.id || t.tile_id || `tile-${t.index}`)));
    heatmapLayersRef.current.forEach((layer, id) => {
      if (!currentTileIds.has(id)) {
        map.removeLayer(layer);
        heatmapLayersRef.current.delete(id);
      }
    });
  }, [map, tiles, showHeatmap, localHeatmapOpacity]);

  // Add/update mine block polygons
  useEffect(() => {
    if (!map || !showPolygons) {
      // Remove all polygons if hidden
      polygonLayersRef.current.forEach(layer => map?.removeLayer(layer));
      return;
    }

    tiles.forEach((tile) => {
      if (!tile.mine_blocks || tile.mine_blocks.length === 0) return;

      const tileId = String(tile.id || tile.tile_id || `tile-${tile.index}`);
      const existingLayer = polygonLayersRef.current.get(tileId);

      // Remove existing layer if present
      if (existingLayer) {
        map.removeLayer(existingLayer);
      }

      // Create new feature group for this tile's polygons
      const featureGroup = L.featureGroup();

      tile.mine_blocks.forEach((block, idx) => {
        try {
          // Convert GeoJSON coordinates to Leaflet format
          const coordinates = block.geometry.coordinates.map((ring: any) => {
            if (Array.isArray(ring[0]) && Array.isArray(ring[0][0])) {
              // MultiPolygon
              return ring.map((r: number[][]) => r.map(coord => [coord[1], coord[0]] as [number, number]));
            } else {
              // Polygon
              return ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
            }
          });

          const polygon = L.polygon(coordinates[0], {
            color: '#ef4444',
            weight: 2,
            fillColor: '#fca5a5',
            fillOpacity: 0.3,
            interactive: true,
          });

          // Add popup with block information
          const area_ha = (block.properties.area_m2 || 0) / 10000;
          const confidence = (block.properties.avg_confidence * 100).toFixed(1);
          
          polygon.bindPopup(
            `<div style="font-family: sans-serif;">
              <h3 style="margin: 0 0 8px 0; color: #ef4444;">⚠️ ${block.properties.name || `Block ${idx + 1}`}</h3>
              <div><strong>Area:</strong> ${area_ha.toFixed(4)} hectares</div>
              <div><strong>Confidence:</strong> ${confidence}%</div>
              <div><strong>Tile:</strong> ${tileId}</div>
              ${block.properties.is_merged ? '<div style="color: #f59e0b;"><strong>Merged Block</strong></div>' : ''}
            </div>`
          );

          polygon.addTo(featureGroup);
        } catch (err) {
          console.error(`Failed to render block ${idx} in tile ${tileId}:`, err);
        }
      });

      // Safely add feature group to map
      // Ensure map exists and is a valid Leaflet map
      if (!map || typeof map.addLayer !== 'function') {
        console.error(`❌ Map is invalid for tile ${tileId}:`, map);
        return;
      }

      if (featureGroup && typeof featureGroup.addLayer === 'function' && featureGroup.getLayers().length > 0) {
        try {
          if (map && map.getContainer() && typeof map.addLayer === 'function') {
            map.addLayer(featureGroup);
            polygonLayersRef.current.set(tileId, featureGroup);
          } else {
            console.warn(`⚠️ Map not ready for polygon layer ${tileId}`);
          }
        } catch (error) {
          console.error(`❌ Failed to add polygon layer to map for tile ${tileId}:`, error);
        }
      } else {
        console.warn(`⚠️ No valid polygons to display for tile ${tileId}`);
      }
    });

    // Clean up removed tiles
    const currentTileIds = new Set(tiles.map(t => String(t.id || t.tile_id || `tile-${t.index}`)));
    polygonLayersRef.current.forEach((layer, id) => {
      if (!currentTileIds.has(id)) {
        map.removeLayer(layer);
        polygonLayersRef.current.delete(id);
      }
    });
  }, [map, tiles, showPolygons]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map) {
        satelliteTileLayersRef.current.forEach(layer => map.removeLayer(layer));
        heatmapLayersRef.current.forEach(layer => map.removeLayer(layer));
        polygonLayersRef.current.forEach(layer => map.removeLayer(layer));
      }
      satelliteTileLayersRef.current.clear();
      heatmapLayersRef.current.clear();
      polygonLayersRef.current.clear();
    };
  }, [map]);

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        position: 'absolute', 
        top: 16, 
        right: 16, 
        zIndex: 1000, 
        p: 2, 
        minWidth: 280,
        maxWidth: 320,
        background: 'rgba(26, 26, 46, 0.95)',
        border: '1px solid rgba(251, 191, 36, 0.2)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, color: '#fcd34d', fontWeight: 'bold' }}>
        Layer Controls
      </Typography>

      {/* Statistics */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
          <Chip size="small" label={`${stats.total} tiles`} sx={{ bgcolor: 'rgba(251, 191, 36, 0.1)', color: '#fcd34d' }} />
          <Chip size="small" label={`${stats.withImages} images`} sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }} />
          <Chip size="small" label={`${stats.withHeatmaps} heatmaps`} sx={{ bgcolor: 'rgba(168, 85, 247, 0.1)', color: '#c084fc' }} />
          <Chip size="small" label={`${stats.withDetections} detections`} sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }} />
        </Stack>
      </Box>

      {/* Toggle Switches */}
      <Stack spacing={1} sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch 
              checked={showSatellite} 
              onChange={(e) => setShowSatellite(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#fbbf24' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#fbbf24' }
              }}
            />
          }
          label={<Typography sx={{ color: '#fcd34d', fontSize: '0.875rem' }}>Satellite Tiles</Typography>}
        />
        <FormControlLabel
          control={
            <Switch 
              checked={showHeatmap} 
              onChange={(e) => setShowHeatmap(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#a855f7' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#a855f7' }
              }}
            />
          }
          label={<Typography sx={{ color: '#c084fc', fontSize: '0.875rem' }}>Probability Heatmap</Typography>}
        />
        <FormControlLabel
          control={
            <Switch 
              checked={showPolygons} 
              onChange={(e) => setShowPolygons(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#ef4444' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#ef4444' }
              }}
            />
          }
          label={<Typography sx={{ color: '#fca5a5', fontSize: '0.875rem' }}>Mine Blocks</Typography>}
        />
      </Stack>

      {/* Opacity Sliders */}
      {showSatellite && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: '#fcd34d', fontSize: '0.75rem', mb: 1 }}>
            Satellite Opacity: {(localSatelliteOpacity * 100).toFixed(0)}%
          </Typography>
          <Slider
            value={localSatelliteOpacity}
            onChange={(_, value) => {
              const newOpacity = value as number;
              setLocalSatelliteOpacity(newOpacity);
              onOpacityChange?.('satellite', newOpacity);
            }}
            min={0}
            max={1}
            step={0.05}
            sx={{
              color: '#fbbf24',
              '& .MuiSlider-thumb': { bgcolor: '#fcd34d' },
              '& .MuiSlider-track': { bgcolor: '#fbbf24' },
              '& .MuiSlider-rail': { bgcolor: 'rgba(251, 191, 36, 0.2)' }
            }}
          />
        </Box>
      )}

      {showHeatmap && (
        <Box>
          <Typography sx={{ color: '#c084fc', fontSize: '0.75rem', mb: 1 }}>
            Heatmap Opacity: {(localHeatmapOpacity * 100).toFixed(0)}%
          </Typography>
          <Slider
            value={localHeatmapOpacity}
            onChange={(_, value) => {
              const newOpacity = value as number;
              setLocalHeatmapOpacity(newOpacity);
              onOpacityChange?.('heatmap', newOpacity);
            }}
            min={0}
            max={1}
            step={0.05}
            sx={{
              color: '#a855f7',
              '& .MuiSlider-thumb': { bgcolor: '#c084fc' },
              '& .MuiSlider-track': { bgcolor: '#a855f7' },
              '& .MuiSlider-rail': { bgcolor: 'rgba(168, 85, 247, 0.2)' }
            }}
          />
        </Box>
      )}
    </Paper>
  );
};

export default TileOverlayManager;
