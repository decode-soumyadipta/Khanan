'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  Chip,
  Stack,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress
} from '@mui/material';
import {
  Edit,
  CheckCircle,
  Cancel,
  Info,
  PlayArrow,
  Map as MapIcon,
  Search,
  MyLocation,
  Refresh
} from '@mui/icons-material';

import { AOI } from '@/types/geoanalyst';
import type { Polygon } from 'geojson';
import { createAOI, startAnalysis as startBackendAnalysis } from '@/services/geoanalyst/api';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { AnalysisProgress } from './AnalysisProgress';

type LeafletDefaultIconPrototype = {
  _getIconUrl?: () => string;
};

type MapWithCleanup = L.Map & {
  _drawingCleanup?: () => void;
};

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

type SearchSuggestion = {
  id: string;
  primary: string;
  secondary?: string;
  lat: number;
  lon: number;
  source: 'dataset' | 'osm';
};

type MineLocation = {
  id: string;
  name: string;
  state: string;
  type: string;
  lat: number;
  lon: number;
  aliases?: string[];
  tags?: string[];
};

const INDIA_MINE_LOCATIONS: MineLocation[] = [
  {
    id: 'gevra',
    name: 'Gevra Mega Open Cast Mine',
    state: 'Chhattisgarh',
    type: 'Open Cast Coal Mine',
    lat: 22.3607,
    lon: 82.7127,
    aliases: ['Gevra OC', 'Korba Coalfields'],
    tags: ['coal', 'open cast', 'south eastern coalfields'],
  },
  {
    id: 'dipka',
    name: 'Dipka Open Cast Mine',
    state: 'Chhattisgarh',
    type: 'Open Cast Coal Mine',
    lat: 22.3698,
    lon: 82.6572,
    aliases: ['Dipka OC', 'SECL Dipka'],
    tags: ['coal', 'korba cluster'],
  },
  {
    id: 'kusmunda',
    name: 'Kusmunda Mine',
    state: 'Chhattisgarh',
    type: 'Open Cast Coal Mine',
    lat: 22.3511,
    lon: 82.7046,
    aliases: ['Kusmunda OC'],
    tags: ['coal', 'korba industrial'],
  },
  {
    id: 'talcher',
    name: 'Talcher Coalfields',
    state: 'Odisha',
    type: 'Coal Mining Cluster',
    lat: 20.9501,
    lon: 85.2336,
    aliases: ['Hingula Mines', 'MCL Talcher'],
    tags: ['mcl', 'coal', 'hingula'],
  },
  {
    id: 'kothagudem',
    name: 'Singareni Collieries (Kothagudem)',
    state: 'Telangana',
    type: 'Underground & Open Cast Coal Mines',
    lat: 17.5531,
    lon: 80.6264,
    aliases: ['SCCL', 'Kothagudem Collieries'],
    tags: ['coal', 'singareni'],
  },
  {
    id: 'neyveli',
    name: 'Neyveli Lignite Mine',
    state: 'Tamil Nadu',
    type: 'Lignite Mine',
    lat: 11.5456,
    lon: 79.4771,
    aliases: ['NLC Neyveli'],
    tags: ['lignite', 'thermal'],
  },
  {
    id: 'raniganj',
    name: 'Raniganj Coalfields',
    state: 'West Bengal',
    type: 'Coal Mining Cluster',
    lat: 23.6232,
    lon: 87.1325,
    aliases: ['Eastern Coalfields'],
    tags: ['coal', 'raniganj'],
  },
  {
    id: 'jharia',
    name: 'Jharia Coalfield',
    state: 'Jharkhand',
    type: 'Underground Coal Mine',
    lat: 23.7768,
    lon: 86.4174,
    aliases: ['Dhanbad Coal Belt'],
    tags: ['coal', 'underground'],
  },
  {
    id: 'bailadila',
    name: 'Bailadila Iron Ore Complex',
    state: 'Chhattisgarh',
    type: 'Iron Ore Mine',
    lat: 18.7064,
    lon: 81.2357,
    aliases: ['NMDC Bailadila'],
    tags: ['iron ore', 'nmdc'],
  },
  {
    id: 'jaduguda',
    name: 'Jaduguda Uranium Mine',
    state: 'Jharkhand',
    type: 'Uranium Mine',
    lat: 22.6543,
    lon: 86.3514,
    aliases: ['UCIL Jaduguda'],
    tags: ['uranium', 'rare earth'],
  },
];

interface EnhancedMapComponentProps {
  onAOICreated?: (aoi: AOI) => void;
}

const EnhancedMapComponent: React.FC<EnhancedMapComponentProps> = ({ onAOICreated }) => {
  const router = useRouter();
  const { currentAnalysis } = useAnalysis();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const currentPolygonRef = useRef<L.Polygon | null>(null);
  const tempMarkersRef = useRef<L.CircleMarker[]>([]);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  
  // State management
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Array<[number, number]>>([]);
  const [aoiBounds, setAoiBounds] = useState({ north: 0, south: 0, east: 0, west: 0 });
  const [aoiArea, setAoiArea] = useState<string>('0');
  const [aoiLocked, setAoiLocked] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [locationPinned, setLocationPinned] = useState(false);
  
  // Location search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef('');
  const skipNextSearchRef = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

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
    }).addTo(mapInstance);

    const featureGroup = L.featureGroup().addTo(mapInstance);
    drawnItemsRef.current = featureGroup;
    mapInstanceRef.current = mapInstance;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Location search with curated mine suggestions and remote enrichment
  useEffect(() => {
    const query = searchQuery.trim();

    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
      setIsSearching(false);
    }

    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      lastQueryRef.current = '';
      return;
    }

    lastQueryRef.current = query;

    const normalizedQuery = query.toLowerCase();
    const mineMatches = INDIA_MINE_LOCATIONS
      .map((location) => {
        const searchPool = [
          location.name,
          location.state,
          location.type,
          ...(location.aliases || []),
          ...(location.tags || []),
        ]
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        const hasMatch = searchPool.some((value) => value.includes(normalizedQuery));
        if (!hasMatch) return null;

        const priority = searchPool.reduce((score, value) => {
          if (!value.includes(normalizedQuery)) return score;
          const index = value.indexOf(normalizedQuery);
          return Math.min(score, index === 0 ? 0 : 1);
        }, Number.POSITIVE_INFINITY);

        return { location, priority };
      })
      .filter((item): item is { location: MineLocation; priority: number } => item !== null)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 6)
      .map(({ location }) => ({
        id: `mine-${location.id}`,
        primary: location.name,
  secondary: `${location.state} - ${location.type}`,
        lat: location.lat,
        lon: location.lon,
        source: 'dataset' as const,
      }));

    setSearchResults(mineMatches);
    setShowResults(mineMatches.length > 0);

    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    const fetchRemoteSuggestions = async () => {
      setIsSearching(true);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
          {
            headers: {
              Accept: 'application/json',
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }

        const data: LocationResult[] = await response.json();

        if (controller.signal.aborted || lastQueryRef.current !== query) {
          return;
        }

        const remoteSuggestions = data
          .filter((result) => {
            const country = result.address?.country?.toLowerCase();
            return !country || country.includes('india');
          })
          .map((result) => {
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

            const secondaryText = result.display_name
              .split(',')
              .slice(1, 3)
              .map((part) => part.trim())
              .filter(Boolean)
              .join(', ');

            const suggestion: SearchSuggestion = {
              id: `osm-${result.place_id}`,
              primary: result.display_name.split(',')[0],
              secondary: secondaryText || undefined,
              lat,
              lon,
              source: 'osm',
            };

            return suggestion;
          })
          .filter((item): item is SearchSuggestion => item !== null);

        setSearchResults((prev) => {
          const unique = new Map(prev.map((item) => [item.id, item]));
          remoteSuggestions.forEach((suggestion) => {
            if (!unique.has(suggestion.id)) {
              unique.set(suggestion.id, suggestion);
            }
          });
          return Array.from(unique.values()).slice(0, 10);
        });
        setShowResults((prev) => prev || remoteSuggestions.length > 0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Search error:', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    const debounceTimer = window.setTimeout(fetchRemoteSuggestions, 300);

    return () => {
      if (searchAbortControllerRef.current === controller) {
        searchAbortControllerRef.current = null;
      }
      controller.abort();
      window.clearTimeout(debounceTimer);
    };
  }, [searchQuery]);

  const handleLocationSelect = (suggestion: SearchSuggestion) => {
    const { lat, lon, primary, secondary, source } = suggestion;
    const lng = lon;

    if (mapInstanceRef.current) {
      // Remove previous marker
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
      }

      // Create custom marker icon
      const customIcon = L.divIcon({
        className: 'custom-search-marker',
        html: `
          <div style="position: relative;">
            <div style="
              width: 30px;
              height: 30px;
              background: linear-gradient(135deg, #3b82f6, #1e40af);
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 4px 12px rgba(59,130,246,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current);
      marker
        .bindPopup(
          `<b>${primary}</b>${secondary ? `<br/><span>${secondary}</span>` : ''}${
            source === 'dataset' ? '<br/><em>Mine registry reference</em>' : ''
          }`
        )
        .openPopup();
      searchMarkerRef.current = marker;

      // Zoom to location
      const targetZoom = source === 'dataset' ? 13 : 14;
      mapInstanceRef.current.flyTo([lat, lng], targetZoom, { duration: 1.1 });
    }

    skipNextSearchRef.current = true;
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
    lastQueryRef.current = primary;
    setIsSearching(false);
    setSearchResults([]);
    setShowResults(false);
    setSearchQuery(primary);
    setLocationPinned(true);
  };

  const startDrawing = () => {
    if (!mapInstanceRef.current) return;

    setIsDrawing(true);
    setDrawingPoints([]);
    setAoiLocked(false);
    
    // Clear existing polygon and markers
    if (currentPolygonRef.current) {
      currentPolygonRef.current.remove();
      currentPolygonRef.current = null;
    }
    tempMarkersRef.current.forEach(m => m.remove());
    tempMarkersRef.current = [];

    const map = mapInstanceRef.current as MapWithCleanup;
    map.getContainer().style.cursor = 'crosshair';

    const onMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setDrawingPoints(prev => {
        const newPoints = [...prev, [lat, lng] as [number, number]];
        
        // Add visible marker for this point
        const marker = L.circleMarker([lat, lng], {
          radius: 6,
          fillColor: '#f59e0b',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(map);
        tempMarkersRef.current.push(marker);

        // Draw/update polygon if we have at least 2 points
        if (newPoints.length >= 2) {
          if (currentPolygonRef.current) {
            currentPolygonRef.current.setLatLngs(newPoints);
          } else {
            const polygon = L.polygon(newPoints, {
              color: '#f59e0b',
              weight: 3,
              fillColor: '#f59e0b',
              fillOpacity: 0.2
            }).addTo(map);
            currentPolygonRef.current = polygon;
          }

          // Calculate and update area in real-time
          if (newPoints.length >= 3) {
            const area = calculatePolygonArea(newPoints);
            setAoiArea(area.toFixed(2));
          }
        }

        return newPoints;
      });
    };

    const onMapRightClick = () => {
      finishDrawing();
    };

    map.on('click', onMapClick);
    map.on('contextmenu', onMapRightClick);

    // Store cleanup function
    map._drawingCleanup = () => {
      map.off('click', onMapClick);
      map.off('contextmenu', onMapRightClick);
      map.getContainer().style.cursor = '';
    };
  };

  const finishDrawing = () => {
    if (!mapInstanceRef.current || drawingPoints.length < 3) {
      alert('Add at least 3 points to form the AOI.');
      return;
    }

    const map = mapInstanceRef.current as MapWithCleanup;
    if (map._drawingCleanup) {
      map._drawingCleanup();
    }

    setIsDrawing(false);

    // Calculate bounds
    const lats = drawingPoints.map(p => p[0]);
    const lngs = drawingPoints.map(p => p[1]);
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };
    setAoiBounds(bounds);

    // Calculate area
    const area = calculatePolygonArea(drawingPoints);
    setAoiArea(area.toFixed(2));
  };

  const calculatePolygonArea = (points: Array<[number, number]>): number => {
    if (points.length < 3) return 0;

    // Shoelace formula for area calculation
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i][1] * points[j][0];
      area -= points[j][1] * points[i][0];
    }
    area = Math.abs(area / 2);

    // Convert to km² (rough approximation: 1 degree ≈ 111 km)
    return area * 111 * 111;
  };

  const lockAOI = () => {
    if (drawingPoints.length < 3) {
      alert('Finish drawing before locking the AOI.');
      return;
    }
    setAoiLocked(true);
  };

  const clearAOI = () => {
    // Clear polygon
    if (currentPolygonRef.current) {
      currentPolygonRef.current.remove();
      currentPolygonRef.current = null;
    }

    // Clear markers
    tempMarkersRef.current.forEach(m => m.remove());
    tempMarkersRef.current = [];

    // Reset state
    setDrawingPoints([]);
    setIsDrawing(false);
    setAoiLocked(false);
    setAnalysisStarted(false);
    setAoiBounds({ north: 0, south: 0, east: 0, west: 0 });
    setAoiArea('0');

    if (mapInstanceRef.current) {
      (mapInstanceRef.current as MapWithCleanup)._drawingCleanup?.();
    }
  };

  const startAnalysis = async () => {
    if (!aoiLocked) {
      alert('Lock the AOI before sending analysis.');
      return;
    }

    try {
      setAnalysisStarted(true);

      // Create AOI object
      // GeoJSON polygon must be closed (first point = last point)
      const closedCoordinates = drawingPoints.map(p => [p[1], p[0]]); // [lng, lat]
      closedCoordinates.push(closedCoordinates[0]); // Close the polygon
      
      const aoiData: AOI = {
        id: `aoi-${Date.now()}`,
        geometry: {
          type: 'Polygon',
          coordinates: [closedCoordinates]
        },
        properties: {
          name: `AOI ${new Date().toLocaleDateString()}`,
          created_at: new Date().toISOString(),
          area_km2: parseFloat(aoiArea)
        },
        bounding_box: aoiBounds
      };

      console.log('📍 Creating AOI...', aoiData);

      // Step 1: Create AOI in backend
      // Note: Don't send created_at - let Python backend generate it
      const createResponse = await createAOI(
        aoiData.geometry, 
        {
          name: aoiData.properties.name,
          description: 'User-drawn AOI from map',
          area_km2: aoiData.properties.area_km2
        }
      );
      console.log('✅ AOI created:', createResponse);

      const aoiId = createResponse.id;

      // Step 2: Start analysis
      console.log('🚀 Starting analysis for AOI:', aoiId);
      const polygonGeometry: Polygon = {
        type: 'Polygon',
        coordinates: aoiData.geometry.coordinates as Polygon['coordinates']
      };

      const analysisResponse = await startBackendAnalysis(aoiId, polygonGeometry);
      console.log('✅ Analysis started:', analysisResponse);

      // Callback to parent component
      if (onAOICreated) {
        onAOICreated({
          ...aoiData,
          id: aoiId
        });
      }

      // Navigate to analysis progress page
      router.push(`/geoanalyst-dashboard/analysis?id=${analysisResponse.analysis_id}`);

    } catch (error: unknown) {
      console.error('❌ Analysis error:', error);
      setAnalysisStarted(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Analysis request failed:\n${errorMessage}\n\nCheck the analysis service status.`);
    }
  };

  // Show ongoing analysis if one exists
  if (currentAnalysis?.status === 'processing') {
    return (
      <AnalysisProgress
        analysisId={currentAnalysis.analysisId}
        onComplete={() => {
          // Analysis completed, context will be updated by AnalysisProgress
          // User will see results and can navigate to history
        }}
        onError={(error) => {
          // Analysis failed, context will be updated by AnalysisProgress
          console.error('Analysis error:', error);
        }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100%' }}>
      {/* Control Panel */}
      <Paper
        elevation={6}
        sx={{
          width: 420,
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
          background: 'linear-gradient(135deg, rgba(247, 250, 252, 0.92) 0%, rgba(245, 248, 251, 0.88) 50%, rgba(243, 247, 251, 0.9) 100%)',
          borderRight: '1px solid rgba(59, 130, 246, 0.12)',
          color: '#1e3a8a'
        }}
      >
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, minHeight: '100%' }}>
          {/* Mission Header */}
          <Box
            sx={{
              p: 2.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(245, 247, 250, 0.98) 0%, rgba(237, 242, 247, 0.96) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 18px 45px rgba(59, 130, 246, 0.1)'
            }}
          >
            <Typography
              variant="overline"
              sx={{
                letterSpacing: 2,
                color: 'rgba(100, 116, 139, 0.9)',
                textTransform: 'uppercase'
              }}
            >
              NTRO | DIRECTORATE OF MINING SURVEILLANCE
            </Typography>
            <Typography variant="h6" sx={{ color: '#1e40af', fontWeight: 700, mt: 0.5 }}>
              Geo-Analyst Operations Console
            </Typography>
            <Box
              component="ul"
              sx={{
                mt: 1,
                pl: 3,
                color: 'rgba(51, 65, 85, 0.85)',
                fontSize: '0.82rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                columnGap: 1,
                rowGap: 0.25
              }}
            >
              <Box component="li" sx={{ listStyleType: 'disc', m: 0 }}>Pin site</Box>
              <Box component="li" sx={{ listStyleType: 'disc', m: 0 }}>Draw AOI</Box>
              <Box component="li" sx={{ listStyleType: 'disc', m: 0 }}>Lock review</Box>
              <Box component="li" sx={{ listStyleType: 'disc', m: 0 }}>Send report</Box>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
              <Chip
                icon={<MyLocation sx={{ fontSize: 18 }} />}
                label={locationPinned ? 'Location ready' : 'Pin location'}
                variant="outlined"
                sx={{
                  borderColor: locationPinned ? 'rgba(59, 130, 246, 0.65)' : 'rgba(59, 130, 246, 0.35)',
                  color: locationPinned ? '#1e40af' : 'rgba(30, 64, 175, 0.75)',
                  backgroundColor: locationPinned ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  '& .MuiChip-icon': {
                    color: locationPinned ? '#1e40af' : 'rgba(59, 130, 246, 0.65)'
                  },
                  '& .MuiChip-label': {
                    fontWeight: 600,
                    letterSpacing: 0.3
                  }
                }}
              />
              <Chip
                icon={
                  aoiLocked ? (
                    <CheckCircle sx={{ fontSize: 18 }} />
                  ) : isDrawing ? (
                    <Edit sx={{ fontSize: 18 }} />
                  ) : drawingPoints.length >= 3 ? (
                    <CheckCircle sx={{ fontSize: 18 }} />
                  ) : (
                    <MapIcon sx={{ fontSize: 18 }} />
                  )
                }
                label={
                  aoiLocked
                    ? 'AOI locked'
                    : isDrawing
                    ? 'Drawing AOI'
                    : drawingPoints.length >= 3
                    ? 'Lock AOI'
                    : 'Draw AOI'
                }
                variant="outlined"
                sx={{
                  borderColor: aoiLocked
                    ? 'rgba(59, 130, 246, 0.65)'
                    : isDrawing
                    ? 'rgba(59, 130, 246, 0.5)'
                    : drawingPoints.length >= 3
                    ? 'rgba(59, 130, 246, 0.4)'
                    : 'rgba(59, 130, 246, 0.3)',
                  color: aoiLocked
                    ? '#1e40af'
                    : isDrawing
                    ? '#1e40af'
                    : drawingPoints.length >= 3
                    ? '#1e3a8a'
                    : 'rgba(30, 64, 175, 0.7)',
                  backgroundColor: aoiLocked
                    ? 'rgba(59, 130, 246, 0.12)'
                    : isDrawing
                    ? 'rgba(59, 130, 246, 0.08)'
                    : drawingPoints.length >= 3
                    ? 'rgba(59, 130, 246, 0.06)'
                    : 'transparent',
                  '& .MuiChip-icon': {
                    color: aoiLocked
                      ? '#1e40af'
                      : isDrawing
                      ? '#3b82f6'
                      : drawingPoints.length >= 3
                      ? '#1e40af'
                      : 'rgba(59, 130, 246, 0.65)'
                  },
                  '& .MuiChip-label': {
                    fontWeight: 600,
                    letterSpacing: 0.3
                  }
                }}
              />
              <Chip
                icon={analysisStarted ? <PlayArrow sx={{ fontSize: 18 }} /> : <Info sx={{ fontSize: 18 }} />}
                label={analysisStarted ? 'Analysis running' : 'Ready for analysis'}
                variant="outlined"
                sx={{
                  borderColor: analysisStarted ? 'rgba(59, 130, 246, 0.65)' : 'rgba(59, 130, 246, 0.35)',
                  color: analysisStarted ? '#1e40af' : 'rgba(51, 65, 85, 0.7)',
                  backgroundColor: analysisStarted ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  '& .MuiChip-icon': {
                    color: analysisStarted ? '#1e40af' : 'rgba(59, 130, 246, 0.6)'
                  },
                  '& .MuiChip-label': {
                    fontWeight: 600,
                    letterSpacing: 0.3
                  }
                }}
              />
            </Stack>
          </Box>

          {/* Location Search */}
          <Box sx={{ position: 'relative' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: 'rgba(30, 64, 175, 0.85)' }}>
              Select site
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Search district, coalfield, or mine"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    {isSearching ? (
                      <CircularProgress size={18} sx={{ color: '#ea580c' }} />
                    ) : (
                      <Search sx={{ color: 'rgba(217, 119, 6, 0.75)' }} />
                    )}
                  </Box>
                )
              }}
              sx={{
                '& .MuiInputBase-root': {
                  backgroundColor: 'rgba(255, 250, 235, 0.6)',
                  borderRadius: 2,
                  color: '#5a4a3a',
                  border: '1px solid rgba(217, 119, 6, 0.35)',
                  boxShadow: '0 6px 24px rgba(217, 119, 6, 0.12)',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  border: 'none'
                },
                '& .MuiInputBase-input::placeholder': {
                  color: 'rgba(100, 116, 139, 0.55)'
                },
                '& .MuiInputBase-root.Mui-focused': {
                  border: '1px solid rgba(59, 130, 246, 0.65)',
                  boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.15)'
                }
              }}
            />

            {showResults && searchResults.length > 0 && (
              <Paper
                elevation={6}
                sx={{
                  position: 'absolute',
                  zIndex: 1000,
                  width: '100%',
                  maxHeight: 320,
                  overflowY: 'auto',
                  mt: 0.75,
                  borderRadius: 2,
                  border: '1px solid rgba(217, 119, 6, 0.25)',
                  background: 'linear-gradient(145deg, rgba(255, 250, 235, 0.95), rgba(255, 245, 220, 0.92))',
                  backdropFilter: 'blur(14px)',
                  boxShadow: '0 18px 40px rgba(217, 119, 6, 0.18)'
                }}
              >
                <List dense disablePadding>
                  {searchResults.map((result) => (
                    <ListItem key={result.id} disablePadding divider>
                      <ListItemButton
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleLocationSelect(result);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Space' || event.key === 'Spacebar') {
                            event.preventDefault();
                            handleLocationSelect(result);
                          }
                        }}
                        sx={{
                          alignItems: 'flex-start',
                          py: 1.25,
                          px: 2,
                          '&:hover': {
                            backgroundColor: 'rgba(217, 119, 6, 0.08)'
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography fontSize="0.875rem" fontWeight={600} sx={{ color: '#5a4a3a' }}>
                                {result.primary}
                              </Typography>
                              <Chip
                                size="small"
                                label={result.source === 'dataset' ? 'Registry' : 'OSM'}
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                  borderRadius: 1.5,
                                  border: result.source === 'dataset'
                                    ? '1px solid rgba(59, 130, 246, 0.6)'
                                    : '1px solid rgba(59, 130, 246, 0.45)',
                                  backgroundColor: result.source === 'dataset'
                                    ? 'rgba(59, 130, 246, 0.18)'
                                    : 'rgba(237, 242, 247, 0.85)',
                                  color: result.source === 'dataset'
                                    ? '#1e40af'
                                    : '#1e3a8a',
                                  '& .MuiChip-label': { px: 1.25, fontWeight: 600 }
                                }}
                              />
                            </Stack>
                          }
                          secondary={result.secondary}
                          secondaryTypographyProps={{ fontSize: '0.75rem', color: 'rgba(139, 92, 24, 0.7)' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>

          <Divider
            textAlign="left"
            sx={{
              borderColor: 'rgba(59, 130, 246, 0.2)',
              '&::before, &::after': {
                borderColor: 'rgba(217, 119, 6, 0.2)'
              }
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(30, 64, 175, 0.8)',
                letterSpacing: 2,
                fontWeight: 600
              }}
            >
              Key steps
            </Typography>
          </Divider>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              background: 'rgba(237, 242, 247, 0.4)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}
          >
            <Box
              component="ol"
              sx={{
                pl: 3,
                color: 'rgba(51, 65, 85, 0.85)',
                '& li': {
                  mb: 0.8,
                  fontSize: '0.82rem',
                  lineHeight: 1.5
                }
              }}
            >
              <li>Select the site.</li>
              <li>Draw and close the AOI.</li>
              <li>Lock and send analysis.</li>
            </Box>
          </Paper>

          {/* Drawing Controls */}
          <Stack spacing={1.5}>
            {!isDrawing && !aoiLocked && (
              <Button
                fullWidth
                variant="contained"
                startIcon={<Edit />}
                onClick={startDrawing}
                sx={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                  color: '#ffffff',
                  boxShadow: '0 10px 25px rgba(37, 99, 235, 0.35)',
                  '&:hover': { background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)' }
                }}
              >
                Draw AOI
              </Button>
            )}

            {isDrawing && (
              <>
                <Chip
                  label={`Drawing: ${drawingPoints.length} pts`}
                  color="warning"
                  icon={<Edit />}
                  sx={{ bgcolor: 'rgba(59, 130, 246, 0.15)', color: '#1e40af' }}
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<CheckCircle />}
                    onClick={finishDrawing}
                    disabled={drawingPoints.length < 3}
                    sx={{
                      background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
                      color: '#f0fdf4',
                      boxShadow: '0 10px 25px rgba(34, 197, 94, 0.35)',
                      '&:hover': { background: 'linear-gradient(135deg, #16a34a 0%, #166534 100%)' },
                      '&.Mui-disabled': {
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: 'rgba(240, 253, 244, 0.6)'
                      }
                    }}
                  >
                    Close polygon
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Cancel />}
                    onClick={clearAOI}
                    sx={{
                      color: '#c65911',
                      borderColor: 'rgba(217, 119, 6, 0.5)',
                      '&:hover': { borderColor: '#c65911', backgroundColor: 'rgba(217, 119, 6, 0.08)' }
                    }}
                  >
                    Abort
                  </Button>
                </Stack>
              </>
            )}

            {!isDrawing && drawingPoints.length >= 3 && !aoiLocked && (
              <Button
                fullWidth
                variant="contained"
                startIcon={<CheckCircle />}
                onClick={lockAOI}
                sx={{
                  background: 'linear-gradient(135deg, #d97706 0%, #c65911 100%)',
                  color: '#ffffff',
                  boxShadow: '0 10px 25px rgba(217, 119, 6, 0.35)',
                  '&:hover': { background: 'linear-gradient(135deg, #c65911 0%, #b45309 100%)' }
                }}
              >
                Lock AOI
              </Button>
            )}
          </Stack>

          {/* AOI Info Display */}
          {drawingPoints.length >= 3 && (
            <>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  mt: 2,
                  background: 'rgba(255, 250, 235, 0.3)',
                  border: '1px solid rgba(217, 119, 6, 0.2)'
                }}
              >
                <Typography variant="caption" sx={{ color: 'rgba(217, 119, 6, 0.85)' }}>
                  AOI PARAMETERS
                </Typography>
                <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                  <Typography variant="body2" sx={{ color: '#5a4a3a', fontSize: '0.8rem' }}>
                    <strong>North:</strong> {aoiBounds.north.toFixed(6)}°
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#5a4a3a', fontSize: '0.8rem' }}>
                    <strong>South:</strong> {aoiBounds.south.toFixed(6)}°
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#5a4a3a', fontSize: '0.8rem' }}>
                    <strong>East:</strong> {aoiBounds.east.toFixed(6)}°
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#5a4a3a', fontSize: '0.8rem' }}>
                    <strong>West:</strong> {aoiBounds.west.toFixed(6)}°
                  </Typography>
                </Box>
                <Divider sx={{ my: 1, borderColor: 'rgba(217, 119, 6, 0.15)' }} />
                <Typography variant="body2" sx={{ color: '#c65911', fontSize: '0.85rem' }}>
                  <strong>Computed area:</strong> {aoiArea} km²
                </Typography>
              </Paper>

              {aoiLocked && (
                <Chip
                  label="AOI locked"
                  color="success"
                  sx={{
                    mt: 2,
                    width: '100%',
                    backgroundColor: 'rgba(22, 101, 52, 0.35)',
                    color: '#bbf7d0'
                  }}
                />
              )}
            </>
          )}

          {/* Action Buttons */}
          <Box
            sx={{
              position: 'sticky',
              bottom: 16,
              zIndex: 20,
              mt: 2,
              background: 'linear-gradient(180deg, rgba(245, 247, 250, 0.95) 0%, rgba(237, 242, 247, 0.92) 100%)',
              borderRadius: 2,
              border: '1px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 18px 36px rgba(59, 130, 246, 0.1)',
              p: 1.5
            }}
          >
            <Stack spacing={1.2}>
              {aoiLocked && (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrow />}
                  onClick={startAnalysis}
                  disabled={analysisStarted}
                  sx={{
                    background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                    color: '#ffffff',
                    boxShadow: '0 12px 28px rgba(30, 64, 175, 0.35)',
                    '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' },
                    '&.Mui-disabled': {
                      background: 'rgba(59, 130, 246, 0.25)',
                      color: 'rgba(237, 242, 247, 0.65)'
                    }
                  }}
                >
                  {analysisStarted ? 'Analysis sent...' : 'Send analysis'}
                </Button>
              )}

              {(drawingPoints.length > 0 || aoiLocked) && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={clearAOI}
                  sx={{
                    color: '#c65911',
                    borderColor: 'rgba(217, 119, 6, 0.5)',
                    '&:hover': {
                      borderColor: '#c65911',
                      backgroundColor: 'rgba(217, 119, 6, 0.08)'
                    }
                  }}
                >
                  Reset AOI
                </Button>
              )}
            </Stack>
          </Box>
        </Box>
      </Paper>

      {/* Map Container */}
      <Box ref={mapRef} sx={{ flex: 1, height: '100%' }} />
    </Box>
  );
};

export default EnhancedMapComponent;
