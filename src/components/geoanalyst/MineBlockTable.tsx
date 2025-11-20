import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip
} from '@mui/material';
import { styled } from '@mui/material/styles';

interface MineBlockRow {
  id: string;
  label: string;
  tileId?: string;
  areaHa: number;
  confidencePct?: number | null;
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

interface MineBlockTableProps {
  rows: MineBlockRow[];
}

const GoldenText = styled(Typography)({
  background: 'linear-gradient(to right, #fbbf24, #fcd34d, #fbbf24)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 2px 4px rgba(251, 191, 36, 0.3))'
});

const formatNumber = (value: number | undefined | null, fractionDigits = 2) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0.00';
  }

  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const formatCoordinate = (value: number | undefined, fractionDigits = 4) => {
  if (value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(fractionDigits);
};

const formatBounds = (bounds?: [number, number, number, number]) => {
  if (!bounds) {
    return '—';
  }
  const [minLon, minLat, maxLon, maxLat] = bounds;
  return `SW ${formatCoordinate(minLat)}, ${formatCoordinate(minLon)} → NE ${formatCoordinate(maxLat)}, ${formatCoordinate(maxLon)}`;
};

export const MineBlockTable: React.FC<MineBlockTableProps> = ({ rows }) => {
  if (!rows.length) {
    return null;
  }

  const hasQuantMetrics = rows.some((row) =>
    row.volumeCubicMeters !== undefined
    || row.maxDepthMeters !== undefined
    || row.meanDepthMeters !== undefined
    || row.rimElevationMeters !== undefined
  );

  return (
    <Paper
      sx={{
        mt: 3,
        background: 'rgba(26, 26, 46, 0.6)',
        border: '1px solid rgba(251, 191, 36, 0.15)'
      }}
      elevation={0}
    >
      <Box sx={{ p: 2, pb: 1 }}>
        <GoldenText variant="subtitle2" fontWeight="bold">
          Mine Block Details
        </GoldenText>
        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', mt: 0.75 }}>
          Consolidated GeoJSON features merged from high-confidence detections.
        </Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 280 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#fcd34d', fontWeight: 'bold', background: 'rgba(15, 52, 96, 0.6)' }}>Block</TableCell>
              <TableCell sx={{ color: '#fcd34d', fontWeight: 'bold', background: 'rgba(15, 52, 96, 0.6)' }} align="right">
                Area (ha)
              </TableCell>
              <TableCell sx={{ color: '#fcd34d', fontWeight: 'bold', background: 'rgba(15, 52, 96, 0.6)' }} align="right">
                Confidence
              </TableCell>
              {hasQuantMetrics && (
                <>
                  <TableCell sx={{ color: '#fcd34d', fontWeight: 'bold', background: 'rgba(15, 52, 96, 0.6)' }} align="right">
                    Rim Elev. (m)
                  </TableCell>
                  <TableCell sx={{ color: '#fcd34d', fontWeight: 'bold', background: 'rgba(15, 52, 96, 0.6)' }} align="right">
                    Max Depth (m)
                  </TableCell>
                  <TableCell sx={{ color: '#fcd34d', fontWeight: 'bold', background: 'rgba(15, 52, 96, 0.6)' }} align="right">
                    Mean Depth (m)
                  </TableCell>
                  <TableCell sx={{ color: '#fcd34d', fontWeight: 'bold', background: 'rgba(15, 52, 96, 0.6)' }} align="right">
                    Volume (m³)
                  </TableCell>
                </>
              )}
              <TableCell sx={{ color: '#fcd34d', fontWeight: 'bold', background: 'rgba(15, 52, 96, 0.6)' }} align="right">
                Tile
              </TableCell>
              <TableCell sx={{ color: '#fcd34d', fontWeight: 'bold', background: 'rgba(15, 52, 96, 0.6)' }} align="center">
                Source
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'rgba(15,52,96,0.25)' } }}>
                <TableCell sx={{ color: '#fff' }}>
                  <Typography sx={{ fontWeight: 600, color: '#fcd34d', fontSize: '0.85rem' }}>
                      {row.label}
                  </Typography>
                  {row.persistentId && (
                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', mt: 0.1 }}>
                      ID:{' '}
                      <Box component="span" sx={{ fontFamily: 'monospace', color: '#93c5fd' }}>
                        {row.persistentId}
                      </Box>
                    </Typography>
                  )}
                  {row.blockIndex !== undefined && (
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem' }}>
                      Sequence: {row.blockIndex}
                    </Typography>
                  )}
                  {row.centroidLat !== undefined && row.centroidLon !== undefined && (
                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>
                      Centroid: {formatCoordinate(row.centroidLat)}, {formatCoordinate(row.centroidLon)}
                    </Typography>
                  )}
                  {row.bounds && (
                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>
                      Bounds: {formatBounds(row.bounds)}
                    </Typography>
                  )}
                  {row.isMerged && (
                    <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem' }}>
                      Merged footprint
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ color: '#fff' }} align="right">
                  {formatNumber(row.areaHa, 2)}
                </TableCell>
                <TableCell sx={{ color: '#fff' }} align="right">
                  {row.confidencePct !== undefined && row.confidencePct !== null
                    ? `${formatNumber(row.confidencePct, 1)}%`
                    : '—'}
                </TableCell>
                {hasQuantMetrics && (
                  <>
                    <TableCell sx={{ color: '#fff' }} align="right">
                      {row.rimElevationMeters !== undefined && row.rimElevationMeters !== null
                        ? formatNumber(row.rimElevationMeters, 1)
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ color: '#fff' }} align="right">
                      {row.maxDepthMeters !== undefined && row.maxDepthMeters !== null
                        ? formatNumber(row.maxDepthMeters, 2)
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ color: '#fff' }} align="right">
                      {row.meanDepthMeters !== undefined && row.meanDepthMeters !== null
                        ? formatNumber(row.meanDepthMeters, 2)
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ color: '#fff' }} align="right">
                      {row.volumeCubicMeters !== undefined && row.volumeCubicMeters !== null
                        ? formatNumber(row.volumeCubicMeters, 1)
                        : '—'}
                    </TableCell>
                  </>
                )}
                <TableCell sx={{ color: '#fff' }} align="right">
                  {row.tileId ? row.tileId : '—'}
                </TableCell>
                <TableCell align="center">
                  <Chip
                    size="small"
                    label={row.source}
                    sx={{
                      bgcolor: row.source === 'Merged' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: row.source === 'Merged' ? '#fcd34d' : '#60a5fa',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default MineBlockTable;
