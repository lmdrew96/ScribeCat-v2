/**
 * Shared formatting utilities
 * Contains common formatting functions used across the application
 */

/**
 * Format duration in MM:SS format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp in MM:SS format
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
