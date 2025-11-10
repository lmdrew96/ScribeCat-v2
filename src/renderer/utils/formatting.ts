/**
 * Shared formatting utilities
 * Contains common formatting functions used across the application
 */

/**
 * Format duration in MM:SS format
 * Handles NaN and Infinity gracefully
 * @param seconds - Duration in seconds
 * @returns Formatted string in MM:SS format (e.g., "5:23")
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp in MM:SS format (alias for formatDuration for backwards compatibility)
 * @deprecated Use formatDuration() instead - they are identical
 */
export function formatTimestamp(seconds: number): string {
  return formatDuration(seconds);
}

/**
 * Format duration in human-readable format with hours
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "2h 15m 30s", "45m 12s", or "23s")
 */
export function formatDurationWithHours(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) {
    return '0s';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Format timestamp with hours support (HH:MM:SS or MM:SS)
 * @param seconds - Timestamp in seconds
 * @returns Formatted string (e.g., "2:15:30" or "45:12")
 */
export function formatTimestampWithHours(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) {
    return '00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format course title by removing course number and code
 */
export function formatCourseTitle(courseTitle: string): string {
  // Strategy 1: If there's a colon, take everything after the first colon
  if (courseTitle.includes(':')) {
    const parts = courseTitle.split(':');
    const afterColon = parts.slice(1).join(':').trim();
    if (afterColon) return afterColon;
  }

  // Strategy 2: Remove common course number patterns at the start
  const formatted = courseTitle.replace(/^[A-Z]{2,4}[-\s]?\d{3,4}[\s:-]*/, '').trim();
  return formatted || courseTitle;
}
