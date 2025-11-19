'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Tooltip,
  Stack,
  Alert,
  CircularProgress,
  Checkbox
} from '@mui/material';
import {
  Visibility,
  Edit,
  Delete,
  Search,
  CheckCircle,
  Error,
  HourglassEmpty,
  Cancel,
  DeleteSweep
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
  getAnalysisHistory,
  getAnalysisStats,
  getAnalysisById,
  updateAnalysis,
  deleteAnalysis,
  bulkDeleteAnalyses,
  type AnalysisHistoryRecord,
  type HistoryStats,
  type HistoryListParams
} from '@/services/historyService';

const AnalysisHistoryPage: React.FC = () => {
  const [analyses, setAnalyses] = useState<AnalysisHistoryRecord[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'startTime' | 'duration' | 'detectionCount'>('startTime');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Dialogs
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisHistoryRecord | null>(null);
  
  // Edit form
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState('');

  // Load data
  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, searchQuery, statusFilter, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: HistoryListParams = {
        page: page + 1,
        limit: rowsPerPage,
        sortBy,
        sortOrder: 'desc'
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter as any;
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      // Add retry logic with exponential backoff for transient errors
      let retries = 0;
      const maxRetries = 3;
      
      const executeWithRetry = async () => {
        try {
          const [historyData, statsData] = await Promise.all([
            getAnalysisHistory(params),
            getAnalysisStats()
          ]);

          setAnalyses(historyData.analyses);
          setTotalCount(historyData.total);
          setStats(statsData);
        } catch (err: any) {
          // If it's a 429 (rate limited) or 503 (service unavailable), retry
          if ((err.response?.status === 429 || err.response?.status === 503) && retries < maxRetries) {
            retries++;
            const delay = Math.pow(2, retries) * 1000; // Exponential backoff
            console.log(`⏱️ Rate limited or service unavailable, retrying in ${delay}ms (attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return executeWithRetry();
          }
          
          // If it's a 401 (unauthorized), the apiClient will handle token refresh
          if (err.response?.status === 401) {
            setError('Your session has expired. Please refresh the page.');
            return;
          }
          
          throw err;
        }
      };

      await executeWithRetry();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load analysis history';
      setError(errorMsg);
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (analysisId: string) => {
    try {
      let retries = 0;
      const maxRetries = 3;
      
      const fetchWithRetry = async (): Promise<any> => {
        try {
          return await getAnalysisById(analysisId, false);
        } catch (err: any) {
          if ((err.response?.status === 429 || err.response?.status === 503) && retries < maxRetries) {
            retries++;
            const delay = Math.pow(2, retries) * 1000;
            console.log(`⏱️ Rate limited, retrying in ${delay}ms (attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry();
          }
          throw err;
        }
      };

      const details = await fetchWithRetry();
      setSelectedAnalysis(details);
      setViewDialogOpen(true);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load analysis details';
      setError(errorMsg);
    }
  };

  const handleEdit = (analysis: AnalysisHistoryRecord) => {
    setSelectedAnalysis(analysis);
    setEditNotes(analysis.userNotes || '');
    setEditTags(analysis.tags?.join(', ') || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedAnalysis) return;

    try {
      const tags = editTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      await updateAnalysis(selectedAnalysis.analysisId, {
        userNotes: editNotes,
        tags
      });

      setEditDialogOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update analysis');
    }
  };

  const handleDelete = (analysis: AnalysisHistoryRecord) => {
    setSelectedAnalysis(analysis);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedAnalysis) return;

    try {
      await deleteAnalysis(selectedAnalysis.analysisId);
      setDeleteDialogOpen(false);
      setSelectedAnalysis(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete analysis');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      await bulkDeleteAnalyses(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete analyses');
    }
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(analyses.map(a => a.analysisId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (analysisId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(analysisId)) {
      newSelected.delete(analysisId);
    } else {
      newSelected.add(analysisId);
    }
    setSelectedIds(newSelected);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle sx={{ color: 'success.main', fontSize: 16 }} />;
      case 'failed':
        return <Error sx={{ color: 'error.main', fontSize: 16 }} />;
      case 'processing':
        return <HourglassEmpty sx={{ color: 'warning.main', fontSize: 16 }} />;
      case 'cancelled':
        return <Cancel sx={{ color: 'text.disabled', fontSize: 16 }} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string): "success" | "error" | "warning" | "default" => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'processing':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDuration = (seconds?: number | string) => {
    if (!seconds) return 'N/A';
    
    // Convert to number if string
    const totalSeconds = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
    
    if (isNaN(totalSeconds) || totalSeconds < 0) {
      return 'N/A';
    }
    
    if (totalSeconds === 0) {
      return '0s';
    }
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    const parts: string[] = [];
    
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (secs > 0 || parts.length === 0) {
      parts.push(`${secs}s`);
    }
    
    return parts.join(' ');
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Analysis History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View and manage your past geospatial analyses
        </Typography>
      </Box>

      {/* Statistics Cards */}
      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Total Analyses
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {stats.totalAnalyses}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Completed
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {stats.completedAnalyses}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Total Detections
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary.main">
                {stats.totalDetections}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Avg. Duration
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {formatDuration(stats.averageDuration)}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by ID or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              label="Sort By"
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <MenuItem value="startTime">Date</MenuItem>
              <MenuItem value="duration">Duration</MenuItem>
              <MenuItem value="detectionCount">Detections</MenuItem>
            </Select>
          </FormControl>
          <Box>
            {selectedIds.size > 0 && (
              <Button
                variant="outlined"
                color="error"
                fullWidth
                startIcon={<DeleteSweep />}
                onClick={handleBulkDelete}
              >
                Delete ({selectedIds.size})
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedIds.size > 0 && selectedIds.size < analyses.length}
                  checked={analyses.length > 0 && selectedIds.size === analyses.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Analysis ID</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Detections</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : analyses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No analyses found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              analyses.map((analysis) => (
                <TableRow key={analysis.analysisId} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(analysis.analysisId)}
                      onChange={() => handleSelectOne(analysis.analysisId)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(analysis.status) || undefined}
                      label={analysis.status}
                      color={getStatusColor(analysis.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {analysis.analysisId.substring(0, 8)}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {format(new Date(analysis.startTime), 'MMM dd, yyyy')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(analysis.startTime), 'HH:mm:ss')}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDuration(analysis.duration)}</TableCell>
                  <TableCell>
                    {analysis.results?.detectionCount || 0}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {analysis.tags?.slice(0, 2).map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                      {analysis.tags && analysis.tags.length > 2 && (
                        <Chip label={`+${analysis.tags.length - 2}`} size="small" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(analysis.analysisId)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEdit(analysis)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(analysis)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </TableContainer>

      {/* View Details Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Analysis Details</Typography>
            <Button 
              variant="outlined" 
              size="small"
              onClick={() => {
                if (selectedAnalysis?.analysisId) {
                  window.open(`/geoanalyst-dashboard/results?id=${selectedAnalysis.analysisId}`, '_blank');
                }
              }}
            >
              View Full Results
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedAnalysis && (
            <Box sx={{ pt: 2 }}>
              <Stack spacing={3}>
                {/* Basic Info */}
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Analysis ID
                        </Typography>
                        <Typography variant="body2" fontFamily="monospace">
                          {selectedAnalysis.analysisId}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Status
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            icon={getStatusIcon(selectedAnalysis.status) || undefined}
                            label={selectedAnalysis.status}
                            color={getStatusColor(selectedAnalysis.status)}
                            size="small"
                          />
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Start Time
                        </Typography>
                        <Typography variant="body2">
                          {selectedAnalysis.startTime ? format(new Date(selectedAnalysis.startTime), 'PPpp') : 'N/A'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Duration
                        </Typography>
                        <Typography variant="body2">
                          {formatDuration(selectedAnalysis.duration)}
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </Paper>

                {/* Statistics Grid */}
                {selectedAnalysis.results && (
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                      Analysis Statistics
                    </Typography>
                    {(() => {
                      // Calculate totals from tiles
                      const tiles = selectedAnalysis.results.tiles || [];
                      const totalAreaM2 = tiles.reduce((sum: number, tile: any) => {
                        return sum + (tile.total_area_m2 || 0);
                      }, 0);
                      
                      // Use stored totalMiningArea if available, otherwise calculate from tiles
                      let totalMiningAreaM2 = 0;
                      if (selectedAnalysis.results.totalMiningArea?.m2) {
                        totalMiningAreaM2 = selectedAnalysis.results.totalMiningArea.m2;
                      } else {
                        // Fallback: calculate from individual tile mining areas
                        totalMiningAreaM2 = tiles.reduce((sum: number, tile: any) => {
                          const tileArea = tile.total_area_m2 || 0;
                          const miningPercent = tile.mining_percentage || 0;
                          return sum + (tileArea * miningPercent / 100);
                        }, 0);
                      }
                      
                      return (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="caption" color="text.secondary">
                                Total Area
                              </Typography>
                              <Typography variant="h5" color="primary">
                                {(totalAreaM2 / 10000).toFixed(1)} ha
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ({(totalAreaM2 / 1000000).toFixed(2)} km²)
                              </Typography>
                            </CardContent>
                          </Card>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="caption" color="text.secondary">
                                Tiles Analyzed
                              </Typography>
                              <Typography variant="h5">
                                {selectedAnalysis.results.totalTiles || 0}
                              </Typography>
                            </CardContent>
                          </Card>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="caption" color="text.secondary">
                                Mine Blocks
                              </Typography>
                              <Typography variant="h5" color="error">
                                {selectedAnalysis.results.detectionCount || 0}
                              </Typography>
                            </CardContent>
                          </Card>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="caption" color="text.secondary">
                                Mining Area
                              </Typography>
                              <Typography variant="h6" color="error">
                                {(totalMiningAreaM2 / 10000).toFixed(1)} ha
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ({(totalMiningAreaM2 / 1000000).toFixed(4)} km²)
                              </Typography>
                            </CardContent>
                          </Card>
                        </Box>
                      );
                    })()}
                  </Paper>
                )}

                {/* Tile Details Table */}
                {selectedAnalysis.results?.tiles && selectedAnalysis.results.tiles.length > 0 && (
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                      Tile-wise Analysis ({selectedAnalysis.results.tiles.length} tiles)
                    </Typography>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Tile</TableCell>
                            <TableCell align="center">Mining</TableCell>
                            <TableCell align="right">Coverage %</TableCell>
                            <TableCell align="right">Blocks</TableCell>
                            <TableCell align="right">Total Area</TableCell>
                            <TableCell align="right">Mining Area</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedAnalysis.results.tiles.map((tile: any, idx: number) => {
                            const tileAreaM2 = tile.total_area_m2 || 0;
                            const miningPercent = tile.mining_percentage || 0;
                            const tileMiningAreaM2 = (tileAreaM2 * miningPercent) / 100;
                            
                            return (
                              <TableRow key={idx} hover>
                                <TableCell>#{idx + 1}</TableCell>
                                <TableCell align="center">
                                  <Chip
                                    size="small"
                                    label={tile.mining_detected ? 'Yes' : 'No'}
                                    color={tile.mining_detected ? 'error' : 'success'}
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  {miningPercent.toFixed(2)}%
                                </TableCell>
                                <TableCell align="right">
                                  {tile.num_mine_blocks || 0}
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2">
                                    {(tileAreaM2 / 10000).toFixed(2)} ha
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ({(tileAreaM2 / 1000000).toFixed(4)} km²)
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" color={tile.mining_detected ? 'error' : 'text.secondary'}>
                                    {(tileMiningAreaM2 / 10000).toFixed(2)} ha
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ({(tileMiningAreaM2 / 1000000).toFixed(4)} km²)
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                )}

                {/* Mine Blocks Preview */}
                {(selectedAnalysis.results?.mergedBlocks || selectedAnalysis.results?.tiles) && (
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                      Detected Mine Blocks
                    </Typography>
                    {(() => {
                      // Try merged blocks first
                      if (selectedAnalysis.results?.mergedBlocks?.features && 
                          selectedAnalysis.results.mergedBlocks.features.length > 0) {
                        const mergedFeatures = selectedAnalysis.results.mergedBlocks.features;
                        return (
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {mergedFeatures.length} blocks detected 
                              (merged from {selectedAnalysis.results.mergedBlocks.metadata?.original_block_count || 0} original detections)
                            </Typography>
                            <TableContainer sx={{ maxHeight: 300 }}>
                              <Table size="small" stickyHeader>
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Block ID</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell align="right">Area (ha)</TableCell>
                                    <TableCell align="right">Confidence</TableCell>
                                    <TableCell align="center">Type</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {mergedFeatures.slice(0, 10).map((feature: any, idx: number) => (
                                    <TableRow key={idx} hover>
                                      <TableCell>
                                        <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                                          {feature.properties.block_id}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>{feature.properties.name}</TableCell>
                                      <TableCell align="right">
                                        {((feature.properties.area_m2 || 0) / 10000).toFixed(2)}
                                      </TableCell>
                                      <TableCell align="right">
                                        {((feature.properties.avg_confidence || 0) * 100).toFixed(1)}%
                                      </TableCell>
                                      <TableCell align="center">
                                        <Chip
                                          size="small"
                                          label={feature.properties.is_merged ? 'Merged' : 'Single'}
                                          color={feature.properties.is_merged ? 'primary' : 'default'}
                                          variant="outlined"
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                            {mergedFeatures.length > 10 && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Showing first 10 of {mergedFeatures.length} blocks
                              </Typography>
                            )}
                          </Box>
                        );
                      }
                      
                      // Fallback to individual tile blocks
                      const tileBlocks: any[] = [];
                      selectedAnalysis.results?.tiles?.forEach((tile: any, tileIdx: number) => {
                        if (tile.mine_blocks && Array.isArray(tile.mine_blocks)) {
                          tile.mine_blocks.forEach((block: any, blockIdx: number) => {
                            // Handle both GeoJSON format and flat object format
                            const props = block.properties || block;
                            
                            // Extract fields with multiple fallbacks
                            const blockId = props.block_id || props.blockId || `T${tileIdx + 1}B${blockIdx + 1}`;
                            const name = props.name || blockId;
                            const area_m2 = props.area_m2 || props.areaM2 || 0;
                            const confidence = props.confidence || props.avg_confidence || props.avgConfidence || 0;
                            const tileId = tile.tile_id || tile.tileId || tile.id || `T${tileIdx + 1}`;
                            
                            tileBlocks.push({
                              blockId,
                              name,
                              area_m2,
                              confidence,
                              tileId,
                              geometry: block.geometry,
                              properties: props
                            });
                          });
                        }
                      });
                      
                      if (tileBlocks.length > 0) {
                        return (
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {tileBlocks.length} blocks detected across {selectedAnalysis.results?.tiles?.filter((t: any) => t.mine_blocks?.length > 0).length || 0} tiles
                            </Typography>
                            <TableContainer sx={{ maxHeight: 300 }}>
                              <Table size="small" stickyHeader>
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Block ID</TableCell>
                                    <TableCell>Tile</TableCell>
                                    <TableCell align="right">Area (ha)</TableCell>
                                    <TableCell align="right">Confidence</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {tileBlocks.slice(0, 10).map((block: any, idx: number) => (
                                    <TableRow key={idx} hover>
                                      <TableCell>
                                        <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                                          {block.blockId}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Chip size="small" label={block.tileId} variant="outlined" />
                                      </TableCell>
                                      <TableCell align="right">
                                        <Typography variant="body2" fontWeight="bold">
                                          {(block.area_m2 / 10000).toFixed(2)}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">
                                        <Typography variant="body2" color="success.main">
                                          {(block.confidence * 100).toFixed(1)}%
                                        </Typography>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                            {tileBlocks.length > 10 && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Showing first 10 of {tileBlocks.length} blocks
                              </Typography>
                            )}
                          </Box>
                        );
                      }
                      
                      // No blocks found
                      return (
                        <Typography variant="body2" color="text.secondary">
                          No mine blocks detected
                        </Typography>
                      );
                    })()}
                  </Paper>
                )}

                {/* Notes and Tags */}
                {(selectedAnalysis.userNotes || (selectedAnalysis.tags && selectedAnalysis.tags.length > 0)) && (
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Stack spacing={2}>
                      {selectedAnalysis.userNotes && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Notes
                          </Typography>
                          <Typography variant="body2">{selectedAnalysis.userNotes}</Typography>
                        </Box>
                      )}
                      {selectedAnalysis.tags && selectedAnalysis.tags.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Tags
                          </Typography>
                          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {selectedAnalysis.tags.map((tag, idx) => (
                              <Chip key={idx} label={tag} size="small" />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Analysis</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={4}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
            <TextField
              fullWidth
              label="Tags (comma-separated)"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              helperText="e.g., mining, high-priority, region-1"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this analysis? This action cannot be undone.
          </Typography>
          {selectedAnalysis && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Analysis ID: {selectedAnalysis.analysisId}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AnalysisHistoryPage;
