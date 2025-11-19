'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Chip,
  Alert,
  Card,
  CardContent,
  Divider,
  Fade,
  Slide,
  Zoom,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Pending,
  CloudDownload,
  ModelTraining,
  Analytics,
  Verified,
  Satellite,
  Speed,
  Timeline,
  Stop
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import apiClient from '@/services/apiClient';
import { stopAnalysis } from '@/services/historyService';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { TileOverlayManager } from './TileOverlayManager';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Animations
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(251, 191, 36, 0); }
  100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
`;

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const slideInUp = keyframes`
  from { transform: translateY(30px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

// Styled components matching dark royal blue theme
const ProgressContainer = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(to bottom, #1a1a2e, #16213e)',
  border: '1px solid rgba(251, 191, 36, 0.2)',
  padding: theme.spacing(4),
  borderRadius: theme.spacing(2),
  boxShadow: '0 8px 32px rgba(251, 191, 36, 0.2)',
  animation: `${slideInUp} 0.6s ease-out`
}));

const StyledLinearProgress = styled(LinearProgress)({
  height: 12,
  borderRadius: 6,
  backgroundColor: 'rgba(251, 191, 36, 0.1)',
  overflow: 'hidden',
  '& .MuiLinearProgress-bar': {
    background: 'linear-gradient(45deg, #fbbf24, #fcd34d, #f59e0b)',
    backgroundSize: '200% 100%',
    animation: `${shimmer} 2s infinite linear`,
    borderRadius: 6,
    boxShadow: '0 2px 8px rgba(251, 191, 36, 0.4)'
  }
});

const GoldenText = styled(Typography)({
  background: 'linear-gradient(to right, #fbbf24, #fcd34d, #fbbf24)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 2px 4px rgba(251, 191, 36, 0.3))'
});

const AnimatedCard = styled(Card)(({ theme }) => ({
  background: 'rgba(251, 191, 36, 0.1)',
  border: '1px solid rgba(251, 191, 36, 0.2)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 16px rgba(251, 191, 36, 0.3)'
  }
}));

const PulsingIcon = styled(Box)({
  animation: `${pulse} 2s infinite`
});

interface AnalysisStep {
  label: string;
  key: string;
  icon: React.ReactNode;
  progressRange: [number, number];
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  {
    label: 'Validating AOI',
    key: 'validating',
    icon: <Verified />,
    progressRange: [0, 15]
  },
  {
    label: 'Fetching Satellite Tiles',
    key: 'preprocessing',
    icon: <CloudDownload />,
    progressRange: [15, 65]
  },
  {
    label: 'Loading ML Model',
    key: 'processing',
    icon: <ModelTraining />,
    progressRange: [65, 80]
  },
  {
    label: 'Running Inference',
    key: 'ml_inference_tiles',
    icon: <Analytics />,
    progressRange: [80, 95]
  },
  {
    label: 'Generating Results',
    key: 'completed',
    icon: <CheckCircle />,
    progressRange: [95, 100]
  }
];

interface AnalysisProgressProps {
  analysisId: string;
  onComplete: (results: any) => void;
  onError: (error: string) => void;
}

interface AnalysisStatus {
  status: string;
  progress: number;
  message: string;
  current_step: string;
  total_tiles?: number;
  tiles_fetched?: number;
  area_km2?: number;
  tiles?: any[];
  error?: string;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  analysisId,
  onComplete,
  onError
}) => {
  const router = useRouter();
  const { setCurrentAnalysis, updateAnalysisProgress, updateAnalysisStatus, clearAnalysis } = useAnalysis();
  const [status, setStatus] = useState<AnalysisStatus>({
    status: 'processing',
    progress: 0,
    message: 'Initializing analysis...',
    current_step: 'initialization'
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [abortDialogOpen, setAbortDialogOpen] = useState(false);
  const [aborting, setAborting] = useState(false);
  
  // Map state
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const aoiLayerRef = useRef<L.Polygon | null>(null);

  useEffect(() => {
    // Initialize analysis in context
    setCurrentAnalysis({
      analysisId,
      status: 'processing',
      startTime: new Date(),
      progress: 0
    });
  }, [analysisId, setCurrentAnalysis]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const mapInstance = L.map(mapRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    });

    // Satellite imagery base layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19,
    }).addTo(mapInstance);

    // Reference labels layer
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19,
      opacity: 0.5,
    }).addTo(mapInstance);

    mapInstanceRef.current = mapInstance;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Auto-zoom to tiles as they arrive
  useEffect(() => {
    if (!mapInstanceRef.current || !status.tiles || status.tiles.length === 0) return;

    const map = mapInstanceRef.current;
    const allBounds = status.tiles.flatMap(t => t.bounds || []);
    
    if (allBounds.length > 0) {
      const lats = allBounds.map(b => b[1]);
      const lngs = allBounds.map(b => b[0]);
      
      const bounds = L.latLngBounds([
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ]);
      
      // Fit bounds with padding
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [status.tiles]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeInterval: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const response = await apiClient.get(`/python/analysis/${analysisId}`);
        
        const data: AnalysisStatus = response.data;
        setStatus(data);
        
        // Update context
        updateAnalysisProgress(data.progress, data.message);

        // Check if analysis is complete
        if (data.status === 'completed' || data.progress >= 100) {
          clearInterval(interval);
          clearInterval(timeInterval);
          updateAnalysisStatus('completed', data);
          setTimeout(() => onComplete(data), 1000);
        } else if (data.status === 'failed' || data.error) {
          clearInterval(interval);
          clearInterval(timeInterval);
          updateAnalysisStatus('failed');
          onError(data.error || 'Analysis failed');
        }
      } catch (error: any) {
        console.error('Error polling status:', error);
        
        // 401 means token expired - apiClient will automatically try to refresh
        // Don't show error message here, let the refresh happen silently
        if (error.status === 401) {
          console.log('🔄 Token expired, will retry...');
          return; // Let the next poll attempt the request
        }
        
        console.error('Error details:', error.response?.data || error.message);
        clearInterval(interval);
        clearInterval(timeInterval);
        onError(error.response?.data?.message || error.message || 'Failed to fetch analysis status');
      }
    };

    // Poll every 5 seconds (increased from 2 to avoid rate limiting)
    interval = setInterval(pollStatus, 5000);
    // Make initial call after a small delay
    setTimeout(() => pollStatus(), 500);

    // Update elapsed time every second
    timeInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, [analysisId, onComplete, onError]);

  const getCurrentStepIndex = () => {
    return ANALYSIS_STEPS.findIndex(step => step.key === status.current_step);
  };

  const getStepStatus = (index: number): 'completed' | 'active' | 'pending' => {
    const currentIndex = getCurrentStepIndex();
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'pending';
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAbortAnalysis = async () => {
    try {
      setAborting(true);
      
      // Call the stop API endpoint
      await stopAnalysis(analysisId);
      
      // Update context to mark as cancelled
      updateAnalysisStatus('cancelled');
      
      // Clear analysis after a brief delay
      setTimeout(() => {
        clearAnalysis();
        // Redirect to new analysis dashboard
        router.push('/geoanalyst-dashboard');
      }, 500);
    } catch (error) {
      console.error('Failed to stop analysis:', error);
      alert('Failed to stop analysis. Please try again.');
      setAborting(false);
    } finally {
      setAbortDialogOpen(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(to right, #1a1a2e, #16213e, #0f3460)', overflow: 'hidden' }}>
      {/* Left Panel - Progress Information */}
      <Box sx={{ 
        width: { xs: '100%', sm: 450, md: 500 }, 
        overflowY: 'auto', 
        overflowX: 'hidden',
        p: 2,
        flexShrink: 0,
        maxHeight: '100vh',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'rgba(251, 191, 36, 0.05)',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(251, 191, 36, 0.3)',
          borderRadius: '3px',
          '&:hover': {
            background: 'rgba(251, 191, 36, 0.5)',
          }
        }
      }}>
        <ProgressContainer elevation={0} sx={{ background: 'transparent', boxShadow: 'none', p: 0 }}>
          {/* Header with Abort Button */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <GoldenText variant="h5" fontWeight="bold" gutterBottom>
                Analysis in Progress
              </GoldenText>
              <Typography sx={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.875rem' }}>
                Analysis ID: {analysisId.slice(0, 8)}...
              </Typography>
            </Box>
            
            {/* Abort Button */}
            <Button
              fullWidth
              variant="contained"
              color="error"
              startIcon={<Stop />}
              onClick={() => setAbortDialogOpen(true)}
              disabled={aborting}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                py: 1.5,
                borderRadius: '8px',
                backgroundColor: '#ef4444',
                '&:hover': {
                  backgroundColor: '#dc2626',
                }
              }}
            >
              {aborting ? 'Stopping...' : 'Abort Analysis'}
            </Button>
          </Box>

        {/* Progress Bar */}
        <Fade in={true} timeout={800}>
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: '#fcd34d', fontWeight: 600 }}>
                Overall Progress
              </Typography>
              <Zoom in={true} style={{ transitionDelay: '300ms' }}>
                <Typography sx={{ 
                  color: '#fbbf24', 
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  textShadow: '0 0 10px rgba(251, 191, 36, 0.5)'
                }}>
                  {status.progress}%
                </Typography>
              </Zoom>
            </Box>
            <StyledLinearProgress variant="determinate" value={status.progress} />
            
            {/* Progress indicator dots */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              {[0, 25, 50, 75, 100].map((milestone) => (
                <Box
                  key={milestone}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: status.progress >= milestone ? '#fbbf24' : 'rgba(251, 191, 36, 0.3)',
                    transition: 'all 0.5s ease',
                    boxShadow: status.progress >= milestone ? '0 0 8px rgba(251, 191, 36, 0.8)' : 'none'
                  }}
                />
              ))}
            </Box>
          </Box>
        </Fade>

        {/* Current Status Message */}
        <Slide direction="up" in={true} timeout={600}>
          <Alert 
            severity="info"
            icon={
              <PulsingIcon>
                <Satellite sx={{ color: '#fcd34d', animation: `${rotate} 3s linear infinite` }} />
              </PulsingIcon>
            }
            sx={{
              mb: 4,
              backgroundColor: 'rgba(252, 211, 77, 0.1)',
              border: '1px solid rgba(252, 211, 77, 0.3)',
              color: '#ffffff',
              borderRadius: 3,
              '& .MuiAlert-icon': {
                color: '#fcd34d'
              },
              transition: 'all 0.3s ease'
            }}
          >
            <Typography sx={{ fontWeight: 500 }}>
              {status.message}
            </Typography>
          </Alert>
        </Slide>

        {/* Stepper */}
        <Stepper 
          activeStep={getCurrentStepIndex()} 
          orientation="vertical"
          sx={{ 
            mb: 3,
            '& .MuiStep-root': {
              py: 1,
            }
          }}
        >
          {ANALYSIS_STEPS.map((step, index) => {
            const stepStatus = getStepStatus(index);
            return (
              <Step key={step.key} sx={{ py: 0 }}>
                <StepLabel
                  StepIconComponent={() => (
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          stepStatus === 'completed'
                            ? '#fbbf24'
                            : stepStatus === 'active'
                            ? 'rgba(251, 191, 36, 0.3)'
                            : 'rgba(251, 191, 36, 0.1)',
                        border: `2px solid ${
                          stepStatus === 'active' ? '#fcd34d' : 'rgba(251, 191, 36, 0.3)'
                        }`,
                        color: stepStatus === 'completed' ? '#1a1a2e' : '#fcd34d',
                        fontSize: '0.75rem'
                      }}
                    >
                      {stepStatus === 'completed' ? (
                        <CheckCircle sx={{ fontSize: '1.2rem' }} />
                      ) : stepStatus === 'active' ? (
                        <CircularProgress size={16} sx={{ color: '#fcd34d' }} />
                      ) : (
                        <RadioButtonUnchecked sx={{ fontSize: '1.2rem' }} />
                      )}
                    </Box>
                  )}
                  sx={{
                    '& .MuiStepLabel-label': {
                      color: stepStatus === 'completed' ? '#fbbf24' : '#ffffff',
                      fontWeight: stepStatus === 'active' ? 600 : 400,
                      fontSize: '0.875rem'
                    }
                  }}
                >
                  {step.label}
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>

        {/* Statistics */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2, mb: 4 }}>
          <Fade in={true} timeout={800} style={{ transitionDelay: '200ms' }}>
            <AnimatedCard>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Speed sx={{ color: '#fcd34d', fontSize: '1.5rem', mb: 1 }} />
                <Typography sx={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.75rem' }}>
                  Elapsed Time
                </Typography>
                <Typography sx={{ 
                  color: '#fcd34d', 
                  fontSize: '1.4rem', 
                  fontWeight: 'bold',
                  fontFamily: 'monospace'
                }}>
                  {formatTime(elapsedTime)}
                </Typography>
              </CardContent>
            </AnimatedCard>
          </Fade>

          {status.area_km2 && (
            <Fade in={true} timeout={800} style={{ transitionDelay: '400ms' }}>
              <AnimatedCard>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Verified sx={{ color: '#fcd34d', fontSize: '1.5rem', mb: 1 }} />
                  <Typography sx={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.75rem' }}>
                    AOI Area
                  </Typography>
                  <Typography sx={{ color: '#fcd34d', fontSize: '1.4rem', fontWeight: 'bold' }}>
                    {status.area_km2} km²
                  </Typography>
                </CardContent>
              </AnimatedCard>
            </Fade>
          )}

          {status.total_tiles && (
            <Fade in={true} timeout={800} style={{ transitionDelay: '600ms' }}>
              <AnimatedCard>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <CloudDownload sx={{ color: '#fcd34d', fontSize: '1.5rem', mb: 1 }} />
                  <Typography sx={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.75rem' }}>
                    Total Tiles
                  </Typography>
                  <Typography sx={{ color: '#fcd34d', fontSize: '1.4rem', fontWeight: 'bold' }}>
                    {status.total_tiles}
                  </Typography>
                </CardContent>
              </AnimatedCard>
            </Fade>
          )}

          {status.tiles_fetched !== undefined && (
            <Fade in={true} timeout={800} style={{ transitionDelay: '800ms' }}>
              <AnimatedCard>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Timeline sx={{ color: '#fcd34d', fontSize: '1.5rem', mb: 1 }} />
                  <Typography sx={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.75rem' }}>
                    Tiles Progress
                  </Typography>
                  <Typography sx={{ color: '#fcd34d', fontSize: '1.4rem', fontWeight: 'bold' }}>
                    {status.tiles_fetched} / {status.total_tiles}
                  </Typography>
                  <Box sx={{ width: '100%', mt: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={status.total_tiles ? (status.tiles_fetched / status.total_tiles) * 100 : 0}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: 'rgba(251, 191, 36, 0.2)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#fbbf24',
                          borderRadius: 2
                        }
                      }}
                    />
                  </Box>
                </CardContent>
              </AnimatedCard>
            </Fade>
          )}
        </Box>

        {/* Info */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography sx={{ color: 'rgba(252, 211, 77, 0.6)', fontSize: '0.875rem' }}>
            Please do not close this window. The analysis may take several minutes depending on the AOI size.
          </Typography>
        </Box>
        </ProgressContainer>
      </Box>

      {/* Right Panel - Map View */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {/* Map Container */}
        <Box ref={mapRef} sx={{ width: '100%', height: '100vh' }} />
        
        {/* Tile Overlay Manager */}
        {mapInstanceRef.current && (
          <TileOverlayManager
            map={mapInstanceRef.current}
            tiles={status.tiles || []}
            showSatelliteTiles={true}
            showProbabilityMaps={status.progress >= 80}  // Show heatmaps after ML starts
            showMineBlocks={status.progress >= 80}       // Show polygons after ML starts
            satelliteOpacity={0.8}
            heatmapOpacity={0.6}
          />
        )}

        {/* Tile Count Overlay */}
        {status.tiles && status.tiles.length > 0 && (
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
              backdropFilter: 'blur(10px)'
            }}
          >
            <Typography sx={{ color: '#fcd34d', fontWeight: 'bold', fontSize: '0.875rem' }}>
              Real-Time Tile Display
            </Typography>
            <Typography sx={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.75rem' }}>
              {status.tiles.length} tiles loaded
            </Typography>
            {status.tiles.filter(t => t.miningDetected || t.mining_detected).length > 0 && (
              <Chip
                size="small"
                label={`⚠️ ${status.tiles.filter(t => t.miningDetected || t.mining_detected).length} detections`}
                sx={{
                  mt: 1,
                  bgcolor: 'rgba(239, 68, 68, 0.2)',
                  color: '#fca5a5',
                  fontSize: '0.75rem'
                }}
              />
            )}
          </Paper>
        )}
      </Box>

      {/* Abort Confirmation Dialog */}
      <Dialog
        open={abortDialogOpen}
        onClose={() => !aborting && setAbortDialogOpen(false)}
      >
        <DialogTitle sx={{ fontSize: '1.2rem', fontWeight: 600, color: '#dc2626' }}>
          Abort Analysis?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 2, color: '#555' }}>
            Are you sure you want to stop this analysis? Any progress will be lost and cannot be recovered.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setAbortDialogOpen(false)}
            disabled={aborting}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAbortAnalysis}
            variant="contained"
            color="error"
            disabled={aborting}
            sx={{ textTransform: 'none' }}
          >
            {aborting ? 'Stopping...' : 'Stop Analysis'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
