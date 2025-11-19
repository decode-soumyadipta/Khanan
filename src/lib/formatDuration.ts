/**
 * Format duration in seconds to human-readable format
 * @param seconds - Duration in seconds (number or string)
 * @returns Formatted string like "2m 30s" or "1h 15m"
 */
export const formatDuration = (seconds: number | string | undefined): string => {
  if (!seconds) return 'N/A';
  
  const totalSeconds = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
  
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return 'N/A';
  }
  
  if (totalSeconds === 0) {
    return '0s';
  }
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.round((totalSeconds % 60) * 100) / 100; // Round to 2 decimal places
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (secs > 0 || parts.length === 0) {
    // Format seconds to 2 decimal places if it has decimals, otherwise show as integer
    const secsStr = secs % 1 === 0 ? `${Math.floor(secs)}s` : `${secs.toFixed(2)}s`;
    parts.push(secsStr);
  }
  
  return parts.join(' ');
};

/**
 * Get average duration from an array of durations
 * @param durations - Array of durations in seconds
 * @returns Average duration formatted as string
 */
export const getAverageDuration = (durations: (number | string | undefined)[]): string => {
  const validDurations = durations
    .filter((d): d is number | string => d !== undefined && d !== null)
    .map(d => typeof d === 'string' ? parseInt(d, 10) : d)
    .filter(d => !isNaN(d) && d >= 0);
  
  if (validDurations.length === 0) {
    return 'N/A';
  }
  
  const total = validDurations.reduce((sum, d) => sum + d, 0);
  const average = Math.round(total / validDurations.length);
  
  return formatDuration(average);
};
